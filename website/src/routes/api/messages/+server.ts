import { auth } from '$lib/auth';
import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { directMessage, user } from '$lib/server/db/schema';
import { eq, or, desc, inArray } from 'drizzle-orm';

export async function GET({ request }) {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) throw error(401, 'Not authenticated');

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
	if (partnerIds.length === 0) return json({ conversations: [] });

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

	const conversations = Array.from(conversationMap.values())
		.map((conv) => ({
			partner: partnerMap.get(conv.partnerId),
			lastMessage: {
				id: conv.lastMessage.id,
				content: conv.lastMessage.content,
				createdAt: conv.lastMessage.createdAt.toISOString(),
				isMine: conv.lastMessage.senderId === userId,
				isRead: conv.lastMessage.isRead
			},
			unreadCount: conv.unreadCount
		}))
		.filter((c) => c.partner)
		.sort(
			(a, b) =>
				new Date(b.lastMessage.createdAt).getTime() - new Date(a.lastMessage.createdAt).getTime()
		);

	return json({ conversations });
}