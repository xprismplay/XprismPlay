import { auth } from '$lib/auth';
import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { directMessage, user, userBlock } from '$lib/server/db/schema';
import { eq, or, and, desc, gte, count } from 'drizzle-orm';
import { redis } from '$lib/server/redis';
import { isNameAppropriate } from '$lib/server/moderation';

const MAX_CONTENT_LENGTH = 1000;
const RATE_LIMIT_PER_MINUTE = 20;
const MESSAGE_PAGE_SIZE = 50;

export async function GET({ params, request }) {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) throw error(401, 'Not authenticated');

	const myId = Number(session.user.id);
	const targetId = parseInt(params.userId);

	if (isNaN(targetId) || targetId === myId) throw error(400, 'Invalid user ID');

	const [targetUser] = await db
		.select({
			id: user.id,
			name: user.name,
			username: user.username,
			image: user.image,
			nameColor: user.nameColor,
			prestigeLevel: user.prestigeLevel
		})
		.from(user)
		.where(eq(user.id, targetId))
		.limit(1);

	if (!targetUser) throw error(404, 'User not found');

	const messages = await db
		.select({
			id: directMessage.id,
			senderId: directMessage.senderId,
			receiverId: directMessage.receiverId,
			content: directMessage.content,
			isRead: directMessage.isRead,
			createdAt: directMessage.createdAt
		})
		.from(directMessage)
		.where(
			or(
				and(eq(directMessage.senderId, myId), eq(directMessage.receiverId, targetId)),
				and(eq(directMessage.senderId, targetId), eq(directMessage.receiverId, myId))
			)
		)
		.orderBy(desc(directMessage.createdAt))
		.limit(MESSAGE_PAGE_SIZE);

	messages.reverse();

	return json({
		messages: messages.map((m) => ({
			...m,
			createdAt: m.createdAt.toISOString(),
			isMine: m.senderId === myId
		})),
		partner: targetUser
	});
}

export async function POST({ params, request }) {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) throw error(401, 'Not authenticated');

	const myId = Number(session.user.id);
	const targetId = parseInt(params.userId);

	if (isNaN(targetId) || targetId === myId) throw error(400, 'Invalid user ID');

	const body = await request.json();
	const content = typeof body?.content === 'string' ? body.content.trim() : '';

	if (content.length === 0 || content.length > MAX_CONTENT_LENGTH) {
		throw error(400, `Content must be 1–${MAX_CONTENT_LENGTH} characters`);
	}

	if (!(await isNameAppropriate(content))) {
		throw error(400, 'Content contains inappropriate content');
	}

	const [targetUser] = await db
		.select({ id: user.id })
		.from(user)
		.where(eq(user.id, targetId))
		.limit(1);

	if (!targetUser) throw error(404, 'User not found');

	const [blockCheck] = await db
		.select({ id: userBlock.id })
		.from(userBlock)
		.where(
			or(
				and(eq(userBlock.blockerId, targetId), eq(userBlock.blockedId, myId)),
				and(eq(userBlock.blockerId, myId), eq(userBlock.blockedId, targetId))
			)
		)
		.limit(1);

	if (blockCheck) throw error(403, 'Cannot send message to this user');

	const oneMinuteAgo = new Date(Date.now() - 60_000);
	const [{ recentCount }] = await db
		.select({ recentCount: count() })
		.from(directMessage)
		.where(and(eq(directMessage.senderId, myId), gte(directMessage.createdAt, oneMinuteAgo)));

	if (Number(recentCount) >= RATE_LIMIT_PER_MINUTE) {
		throw error(429, 'Too many messages. Please wait a moment.');
	}

	const [sender] = await db
		.select({
			id: user.id,
			name: user.name,
			username: user.username,
			image: user.image,
			nameColor: user.nameColor,
			prestigeLevel: user.prestigeLevel
		})
		.from(user)
		.where(eq(user.id, myId))
		.limit(1);

	const [newMessage] = await db
		.insert(directMessage)
		.values({ senderId: myId, receiverId: targetId, content })
		.returning();

	const dmPayload = {
		type: 'dm_new_message',
		message: {
			id: newMessage.id,
			senderId: newMessage.senderId,
			receiverId: newMessage.receiverId,
			content: newMessage.content,
			isRead: newMessage.isRead,
			createdAt: newMessage.createdAt.toISOString(),
			sender
		}
	};

	await redis.publish(`dm:${targetId}`, JSON.stringify(dmPayload));

	return json({
		success: true,
		message: {
			...newMessage,
			createdAt: newMessage.createdAt.toISOString(),
			isMine: true,
			sender
		}
	});
}

export async function PATCH({ params, request }) {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) throw error(401, 'Not authenticated');

	const myId = Number(session.user.id);
	const targetId = parseInt(params.userId);

	if (isNaN(targetId)) throw error(400, 'Invalid user ID');

	await db
		.update(directMessage)
		.set({ isRead: true })
		.where(
			and(
				eq(directMessage.senderId, targetId),
				eq(directMessage.receiverId, myId),
				eq(directMessage.isRead, false)
			)
		);

	return json({ success: true });
}