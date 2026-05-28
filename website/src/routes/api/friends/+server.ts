import { auth } from '$lib/auth';
import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { user, friendRequest, friendship, userBlock } from '$lib/server/db/schema';
import { eq, and, or } from 'drizzle-orm';
import { createNotification } from '$lib/server/notification';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ request }) => {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) throw error(401, 'Not authenticated');

	const userId = Number(session.user.id);

	// Get friends
	const friendships = await db
		.select()
		.from(friendship)
		.where(or(eq(friendship.user1Id, userId), eq(friendship.user2Id, userId)));

	const friendIds = friendships.map((f) => (f.user1Id === userId ? f.user2Id : f.user1Id));
	let friendsList = [];
	if (friendIds.length > 0) {
		const friendUsers = await db
			.select({
				id: user.id,
				username: user.username,
				image: user.image
			})
			.from(user)
			.where(or(...friendIds.map((id) => eq(user.id, id))));
		friendsList = friendUsers;
	}

	// Get pending requests (received)
	const pendingRequestsRaw = await db
		.select({
			id: friendRequest.id,
			senderId: friendRequest.senderId,
			createdAt: friendRequest.createdAt
		})
		.from(friendRequest)
		.where(and(eq(friendRequest.receiverId, userId), eq(friendRequest.status, 'PENDING')));

	let pendingRequests = [];
	if (pendingRequestsRaw.length > 0) {
		const senderIds = pendingRequestsRaw.map((r) => r.senderId);
		const senders = await db
			.select({
				id: user.id,
				username: user.username,
				image: user.image
			})
			.from(user)
			.where(or(...senderIds.map((id) => eq(user.id, id))));
		pendingRequests = pendingRequestsRaw.map((req) => ({
			...req,
			sender: senders.find((s) => s.id === req.senderId)
		}));
	}

	// Get pending requests (sent)
	const sentRequestsRaw = await db
		.select({
			id: friendRequest.id,
			receiverId: friendRequest.receiverId,
			createdAt: friendRequest.createdAt
		})
		.from(friendRequest)
		.where(and(eq(friendRequest.senderId, userId), eq(friendRequest.status, 'PENDING')));

	let sentRequests = [];
	if (sentRequestsRaw.length > 0) {
		const receiverIds = sentRequestsRaw.map((r) => r.receiverId);
		const receivers = await db
			.select({
				id: user.id,
				username: user.username,
				image: user.image
			})
			.from(user)
			.where(or(...receiverIds.map((id) => eq(user.id, id))));
		sentRequests = sentRequestsRaw.map((req) => ({
			...req,
			receiver: receivers.find((s) => s.id === req.receiverId)
		}));
	}

	return json({ friends: friendsList, pendingRequests, sentRequests });
};

export const POST: RequestHandler = async ({ request }) => {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) throw error(401, 'Not authenticated');

	const userId = Number(session.user.id);
	const { action, targetId } = await request.json();

	if (!action || !targetId) throw error(400, 'Invalid parameters');

	if (userId === targetId) throw error(400, 'Cannot perform action on yourself');

	// Check blocks
	const blocked = await db
		.select()
		.from(userBlock)
		.where(
			or(
				and(eq(userBlock.blockerId, userId), eq(userBlock.blockedId, targetId)),
				and(eq(userBlock.blockerId, targetId), eq(userBlock.blockedId, userId))
			)
		)
		.limit(1);

	if (blocked.length > 0) {
		throw error(400, 'Cannot perform this action due to a block');
	}

	if (action === 'SEND') {
		// Check if already friends
		const existingFriendship = await db
			.select()
			.from(friendship)
			.where(
				or(
					and(eq(friendship.user1Id, userId), eq(friendship.user2Id, targetId)),
					and(eq(friendship.user1Id, targetId), eq(friendship.user2Id, userId))
				)
			)
			.limit(1);

		if (existingFriendship.length > 0) throw error(400, 'Already friends');

		// Check if request already exists
		const existingRequest = await db
			.select()
			.from(friendRequest)
			.where(
				or(
					and(eq(friendRequest.senderId, userId), eq(friendRequest.receiverId, targetId)),
					and(eq(friendRequest.senderId, targetId), eq(friendRequest.receiverId, userId))
				)
			)
			.limit(1);

		if (existingRequest.length > 0) {
			if (existingRequest[0].status === 'PENDING') {
				if (existingRequest[0].receiverId === userId) {
					throw error(400, 'They already sent you a request. Accept it instead.');
				}
				throw error(400, 'Friend request already sent');
			} else {
				// if declined, allow re-sending
				await db.delete(friendRequest).where(eq(friendRequest.id, existingRequest[0].id));
			}
		}

		await db.insert(friendRequest).values({
			senderId: userId,
			receiverId: targetId
		});

		await createNotification(
			targetId.toString(),
			'FRIEND_REQUEST',
			'New Friend Request',
			`@${session.user.name} sent you a friend request.`,
			`/user/${session.user.name}`
		);

		return json({ success: true });
	} else if (action === 'ACCEPT') {
		const req = await db
			.select()
			.from(friendRequest)
			.where(
				and(
					eq(friendRequest.senderId, targetId),
					eq(friendRequest.receiverId, userId),
					eq(friendRequest.status, 'PENDING')
				)
			)
			.limit(1);

		if (req.length === 0) throw error(400, 'No pending request found');

		await db.transaction(async (tx) => {
			await tx.delete(friendRequest).where(eq(friendRequest.id, req[0].id));

			const user1Id = Math.min(userId, targetId);
			const user2Id = Math.max(userId, targetId);

			await tx.insert(friendship).values({
				user1Id,
				user2Id
			});
		});

		return json({ success: true });
	} else if (action === 'DECLINE') {
		await db
			.delete(friendRequest)
			.where(and(eq(friendRequest.senderId, targetId), eq(friendRequest.receiverId, userId)));
		return json({ success: true });
	} else if (action === 'REMOVE') {
		const user1Id = Math.min(userId, targetId);
		const user2Id = Math.max(userId, targetId);
		await db
			.delete(friendship)
			.where(and(eq(friendship.user1Id, user1Id), eq(friendship.user2Id, user2Id)));
		return json({ success: true });
	}

	throw error(400, 'Invalid action');
};
