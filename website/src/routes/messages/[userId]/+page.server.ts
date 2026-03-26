import { auth } from '$lib/auth';
import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { directMessage, user } from '$lib/server/db/schema';
import { eq, or, and, desc } from 'drizzle-orm';

export const load: PageServerLoad = async ({ params, request }) => {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) throw redirect(302, '/');

	const myId = Number(session.user.id);
	const targetId = parseInt(params.userId);

	if (isNaN(targetId) || targetId === myId) throw error(400, 'Invalid user');

	const [[targetUser], [currentUser]] = await Promise.all([
		db
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
			.limit(1),

		db
			.select({ id: user.id, name: user.name, username: user.username, image: user.image })
			.from(user)
			.where(eq(user.id, myId))
			.limit(1)
	]);

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
		.limit(50);

	messages.reverse();

	return {
		messages: messages.map((m) => ({
			...m,
			createdAt: m.createdAt.toISOString(),
			isMine: m.senderId === myId
		})),
		partner: targetUser,
		currentUser
	};
};