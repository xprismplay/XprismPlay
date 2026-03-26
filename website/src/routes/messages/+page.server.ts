import { auth } from '$lib/auth';
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { directMessage, user } from '$lib/server/db/schema';
import { eq, or, desc, inArray } from 'drizzle-orm';

export const load: PageServerLoad = async ({ request }) => {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) throw redirect(302, '/');

	const userId = Number(session.user.id);

	const allMessages = await db
		.select({
			id: directMessage.id,
			senderId: directMessage.senderId,
			receiverId: directMessage.receiverId,
			content: directMessage.content,
			isRead: directMessage.isRead,
			createdAt: directMessage.createdAt
		})
		.from(directMessage)
		.where(or(eq(directMessage.senderId, userId), eq(directMessage.receiverId, userId)))
		.orderBy(desc(directMessage.createdAt))
		.limit(500);

	const conversationMap = new Map<
		number,
		{
			partnerId: number;
			lastMessage: (typeof allMessages)[0];
			unreadCount: number;
		}
	>();

	for (const msg of allMessages) {
		const partnerId = msg.senderId === userId ? msg.receiverId : msg.senderId;
		if (!conversationMap.has(partnerId)) {
			conversationMap.set(partnerId, { partnerId, lastMessage: msg, unreadCount: 0 });
		}
		if (msg.receiverId === userId && !msg.isRead) {
			conversationMap.get(partnerId)!.unreadCount++;
		}
	}

	const partnerIds = Array.from(conversationMap.keys());
	let conversations: {
		partner: { id: number; name: string | null; username: string; image: string | null; nameColor: string | null; prestigeLevel: number | null };
		lastMessage: { content: string; createdAt: string; isMine: boolean; isRead: boolean };
		unreadCount: number;
	}[] = [];

	if (partnerIds.length > 0) {
		const partners = await db
			.select({
				id: user.id,
				name: user.name,
				username: user.username,
				image: user.image,
				nameColor: user.nameColor,
				prestigeLevel: user.prestigeLevel
			})
			.from(user)
			.where(inArray(user.id, partnerIds));

		const partnerMap = new Map(partners.map((p) => [p.id, p]));

		conversations = Array.from(conversationMap.values())
			.map((conv) => {
				const partner = partnerMap.get(conv.partnerId);
				if (!partner) return null;
				return {
					partner,
					lastMessage: {
						content: conv.lastMessage.content,
						createdAt: conv.lastMessage.createdAt.toISOString(),
						isMine: conv.lastMessage.senderId === userId,
						isRead: conv.lastMessage.isRead
					},
					unreadCount: conv.unreadCount
				};
			})
			.filter((c): c is NonNullable<typeof c> => c !== null)
			.sort(
				(a, b) =>
					new Date(b.lastMessage.createdAt).getTime() - new Date(a.lastMessage.createdAt).getTime()
			);
	}

	return { conversations };
};