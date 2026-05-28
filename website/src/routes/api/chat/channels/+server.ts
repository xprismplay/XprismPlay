import { auth } from '$lib/auth';
import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { user, chatChannel, chatMessage, friendship } from '$lib/server/db/schema';
import { eq, and, or, desc, inArray } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { hasFlag } from '$lib/data/flags';

export const GET: RequestHandler = async ({ request }) => {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) throw error(401, 'Not authenticated');

	const userId = Number(session.user.id);

	// Get user flags to check if admin/head admin
	const [userData] = await db
		.select({ flags: user.flags })
		.from(user)
		.where(eq(user.id, userId))
		.limit(1);
	if (!userData) throw error(404, 'User not found');

	const isAdmin = hasFlag(userData.flags, 'IS_ADMIN', 'IS_HEAD_ADMIN');
	const isHeadAdmin = hasFlag(userData.flags, 'IS_HEAD_ADMIN');

	// Base query condition for channels: DMs where user is a participant
	const conditions = [
		and(
			eq(chatChannel.type, 'DIRECT'),
			or(eq(chatChannel.user1Id, userId), eq(chatChannel.user2Id, userId))
		)
	];

	if (isAdmin) conditions.push(eq(chatChannel.type, 'ADMIN_GLOBAL'));
	if (isHeadAdmin) conditions.push(eq(chatChannel.type, 'HEAD_ADMIN'));

	if (isHeadAdmin) {
		// Head Admins can see ALL DIRECT channels!
		conditions.push(eq(chatChannel.type, 'DIRECT'));
	}

	const channels = await db
		.select()
		.from(chatChannel)
		.where(or(...conditions));

	// For DMs, fetch the other user's info to display
	const userIdsToFetch = new Set<number>();
	channels.forEach((c) => {
		if (c.type === 'DIRECT') {
			if (c.user1Id) userIdsToFetch.add(c.user1Id);
			if (c.user2Id) userIdsToFetch.add(c.user2Id);
		}
	});

	let usersInfo = new Map();
	if (userIdsToFetch.size > 0) {
		const fetchedUsers = await db
			.select({
				id: user.id,
				username: user.username,
				image: user.image
			})
			.from(user)
			.where(inArray(user.id, Array.from(userIdsToFetch)));

		fetchedUsers.forEach((u) => usersInfo.set(u.id, u));
	}

	// Fetch or create Global Public Chat
	let [globalChat] = await db
		.select()
		.from(chatChannel)
		.where(
			and(
				eq(chatChannel.type, 'DIRECT'),
				eq(chatChannel.user1Id, null),
				eq(chatChannel.user2Id, null)
			)
		)
		.limit(1);

	if (!globalChat) {
		const newGlobal = await db
			.insert(chatChannel)
			.values({
				type: 'DIRECT',
				user1Id: null,
				user2Id: null
			})
			.returning();
		globalChat = newGlobal[0];
	}

	const processedChannels = channels.map((c) => {
		let name = '';
		let image = null;

		if (c.type === 'DIRECT') {
			if (c.user1Id === null && c.user2Id === null) {
				name = 'Global Group Chat';
				image = null; // or some icon
			} else {
				// Determine the 'other' user to display, or show both if Head Admin is snooping
				const isParticipant = c.user1Id === userId || c.user2Id === userId;

				if (isParticipant) {
					const otherId = c.user1Id === userId ? c.user2Id : c.user1Id;
					const otherUser = usersInfo.get(otherId);
					name = otherUser ? `@${otherUser.username}` : 'Unknown User';
					image = otherUser ? otherUser.image : null;
				} else {
					// Head Admin snooping
					const u1 = usersInfo.get(c.user1Id);
					const u2 = usersInfo.get(c.user2Id);
					name = `${u1 ? '@' + u1.username : 'Unknown'} & ${u2 ? '@' + u2.username : 'Unknown'}`;
				}
			}
		} else if (c.type === 'ADMIN_GLOBAL') {
			name = 'Global Admin Chat';
		} else if (c.type === 'HEAD_ADMIN') {
			name = 'Head Admin Chat';
		}

		return {
			...c,
			name,
			image
		};
	});

	// If globalChat wasn't in `channels` because the user didn't fetch it explicitly in the OR conditions
	// Actually, the OR condition `or(eq(chatChannel.user1Id, userId), ...)` wouldn't fetch it!
	// So we need to prepend it to processedChannels if not already there.
	if (!processedChannels.some((c) => c.id === globalChat.id)) {
		processedChannels.unshift({
			...globalChat,
			name: 'Global Group Chat',
			image: null
		});
	}

	return json({ channels: processedChannels });
};

export const POST: RequestHandler = async ({ request }) => {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) throw error(401, 'Not authenticated');

	const userId = Number(session.user.id);
	const { targetUserId } = await request.json();

	if (!targetUserId) throw error(400, 'targetUserId is required');

	if (userId === targetUserId) throw error(400, 'Cannot chat with yourself');

	// Check if they are friends (only friends can start a DM, unless Head Admin)
	const [userData] = await db
		.select({ flags: user.flags })
		.from(user)
		.where(eq(user.id, userId))
		.limit(1);
	const isHeadAdmin = hasFlag(userData.flags, 'IS_HEAD_ADMIN');

	if (!isHeadAdmin) {
		const isFriends = await db
			.select()
			.from(friendship)
			.where(
				or(
					and(eq(friendship.user1Id, userId), eq(friendship.user2Id, targetUserId)),
					and(eq(friendship.user1Id, targetUserId), eq(friendship.user2Id, userId))
				)
			)
			.limit(1);

		if (isFriends.length === 0) throw error(403, 'You can only chat with friends');
	}

	const user1Id = Math.min(userId, targetUserId);
	const user2Id = Math.max(userId, targetUserId);

	// Get or create channel
	let channel = await db
		.select()
		.from(chatChannel)
		.where(
			and(
				eq(chatChannel.type, 'DIRECT'),
				eq(chatChannel.user1Id, user1Id),
				eq(chatChannel.user2Id, user2Id)
			)
		)
		.limit(1);

	if (channel.length === 0) {
		const newChannel = await db
			.insert(chatChannel)
			.values({
				type: 'DIRECT',
				user1Id,
				user2Id
			})
			.returning();
		return json({ channel: newChannel[0] });
	}

	return json({ channel: channel[0] });
};
