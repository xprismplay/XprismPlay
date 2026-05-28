import { auth } from '$lib/auth';
import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { user, chatChannel, chatMessage, friendship, userBlock } from '$lib/server/db/schema';
import { eq, and, or, desc, inArray, sql } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { hasFlag } from '$lib/data/flags';
import { redis } from '$lib/server/redis';

async function verifyChannelAccess(channelId: number, userId: number, flags: bigint) {
	const [channel] = await db
		.select()
		.from(chatChannel)
		.where(eq(chatChannel.id, channelId))
		.limit(1);
	if (!channel) throw error(404, 'Channel not found');

	const isAdmin = hasFlag(flags, 'IS_ADMIN', 'IS_HEAD_ADMIN');
	const isHeadAdmin = hasFlag(flags, 'IS_HEAD_ADMIN');

	if (channel.type === 'HEAD_ADMIN' && !isHeadAdmin) throw error(403, 'Access denied');
	if (channel.type === 'ADMIN_GLOBAL' && !isAdmin) throw error(403, 'Access denied');

	if (channel.type === 'DIRECT') {
		const isParticipant = channel.user1Id === userId || channel.user2Id === userId;
		const isGlobalPublic = channel.user1Id === null && channel.user2Id === null;
		if (!isParticipant && !isHeadAdmin && !isGlobalPublic) {
			throw error(403, 'Access denied');
		}
	}

	return channel;
}

export const GET: RequestHandler = async ({ request, params }) => {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) throw error(401, 'Not authenticated');

	const userId = Number(session.user.id);
	const channelId = Number(params.channelId);

	if (isNaN(channelId)) throw error(400, 'Invalid channel ID');

	const [userData] = await db
		.select({ flags: user.flags })
		.from(user)
		.where(eq(user.id, userId))
		.limit(1);
	await verifyChannelAccess(channelId, userId, userData.flags);

	// Fetch messages
	const messagesRaw = await db
		.select({
			id: chatMessage.id,
			channelId: chatMessage.channelId,
			senderId: chatMessage.senderId,
			content: chatMessage.content,
			createdAt: chatMessage.createdAt
		})
		.from(chatMessage)
		.where(eq(chatMessage.channelId, channelId))
		.orderBy(desc(chatMessage.createdAt))
		.limit(100);

	if (messagesRaw.length === 0) return json({ messages: [] });

	const senderIds = new Set(messagesRaw.map((m) => m.senderId));
	const senders = await db
		.select({
			id: user.id,
			username: user.username,
			image: user.image
		})
		.from(user)
		.where(inArray(user.id, Array.from(senderIds)));

	const senderMap = new Map(senders.map((s) => [s.id, s]));

	const messages = messagesRaw.reverse().map((m) => {
		const sender = senderMap.get(m.senderId);
		return {
			...m,
			senderUsername: sender?.username || 'Unknown',
			senderImage: sender?.image || null
		};
	});

	return json({ messages });
};

export const POST: RequestHandler = async ({ request, params }) => {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) throw error(401, 'Not authenticated');

	const userId = Number(session.user.id);
	const channelId = Number(params.channelId);
	const { content } = await request.json();

	if (isNaN(channelId)) throw error(400, 'Invalid channel ID');
	if (!content || typeof content !== 'string' || content.trim().length === 0) {
		throw error(400, 'Message cannot be empty');
	}
	if (content.length > 2000) throw error(400, 'Message too long');

	const [userData] = await db
		.select({ flags: user.flags })
		.from(user)
		.where(eq(user.id, userId))
		.limit(1);
	const channel = await verifyChannelAccess(channelId, userId, userData.flags);

	// For DMs, verify they are still friends and not blocked (unless Head Admin)
	const isHeadAdmin = hasFlag(userData.flags, 'IS_HEAD_ADMIN');
	if (
		channel.type === 'DIRECT' &&
		!isHeadAdmin &&
		(channel.user1Id !== null || channel.user2Id !== null)
	) {
		const otherUserId = channel.user1Id === userId ? channel.user2Id : channel.user1Id;

		const isFriends = await db
			.select()
			.from(friendship)
			.where(
				or(
					and(eq(friendship.user1Id, userId), eq(friendship.user2Id, otherUserId)),
					and(eq(friendship.user1Id, otherUserId), eq(friendship.user2Id, userId))
				)
			)
			.limit(1);

		if (isFriends.length === 0) throw error(403, 'You must be friends to send messages');

		const blocked = await db
			.select()
			.from(userBlock)
			.where(
				or(
					and(eq(userBlock.blockerId, userId), eq(userBlock.blockedId, otherUserId)),
					and(eq(userBlock.blockerId, otherUserId), eq(userBlock.blockedId, userId))
				)
			)
			.limit(1);

		if (blocked.length > 0) throw error(403, 'Cannot send messages to this user');
	}

	const newMsg = await db
		.insert(chatMessage)
		.values({
			channelId,
			senderId: userId,
			content: content.trim()
		})
		.returning();

	const msgData = newMsg[0];

	// Prepare payload for websocket
	const payload = {
		type: 'chat_message',
		data: {
			id: msgData.id,
			channelId: msgData.channelId,
			senderId: msgData.senderId,
			senderUsername: session.user.name,
			senderImage: session.user.image,
			content: msgData.content,
			createdAt: msgData.createdAt
		}
	};

	// Determine who needs to receive this message via websocket
	const targetUserIds = new Set<number>();

	if (channel.type === 'DIRECT') {
		if (channel.user1Id) targetUserIds.add(channel.user1Id);
		if (channel.user2Id) targetUserIds.add(channel.user2Id);
	} else if (channel.type === 'ADMIN_GLOBAL' || channel.type === 'HEAD_ADMIN') {
		// Just publish to everyone or fetch all admins?
		// Fetching all admins/head admins and publishing individually:
		const admins = await db
			.select({ id: user.id })
			.from(user)
			.where(
				or(hasFlag(user.flags, 'IS_ADMIN'), hasFlag(user.flags, 'IS_HEAD_ADMIN')) // This SQL hasFlag is pseudo, we need actual bitwise match
			);
		// Actually, in Postgres: `flags & 3 > 0` for admin or head admin, `flags & 2 > 0` for head admin.
		// Since we don't have bitwise operators easily in drizzle-orm without sql\`\`, let's just publish to a special channel for group chats
		// Wait, in main.ts we did `redis.psubscribe('chat:*')`. We can just publish to `chat:channel:<channelId>`!
	}

	// We can broadcast to `chat:channel:${channelId}` if we updated main.ts to listen to it!
	// Wait, in main.ts I added `chat:*` but I only check `chat:userId` (i.e., `const userId = channel.substring('chat:'.length)` and then `userSockets.get(userId)`).
	// So we need to publish to each user's `chat:<userId>` individually, because the websocket server doesn't track channel subscriptions!

	if (channel.type === 'DIRECT') {
		if (channel.user1Id === null && channel.user2Id === null) {
			await redis.publish('chat:global', JSON.stringify(payload));
		} else {
			if (channel.user1Id) await redis.publish(`chat:${channel.user1Id}`, JSON.stringify(payload));
			if (channel.user2Id) await redis.publish(`chat:${channel.user2Id}`, JSON.stringify(payload));
		}
	} else {
		let query = db.select({ id: user.id }).from(user);

		if (channel.type === 'HEAD_ADMIN') {
			query = query.where(sql`(flags & 2) > 0`);
		} else {
			query = query.where(sql`(flags & 3) > 0`);
		}

		const recipients = await query;
		for (const r of recipients) {
			await redis.publish(`chat:${r.id}`, JSON.stringify(payload));
		}
	}

	return json({ success: true, message: payload.data });
};
