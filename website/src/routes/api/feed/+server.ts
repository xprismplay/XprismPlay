import { auth } from '$lib/auth';
import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { globalFeedEvent, transaction, coin, user } from '$lib/server/db/schema';
import { eq, desc, gte, and, or, count } from 'drizzle-orm';
import { redis } from '$lib/server/redis';
import { isNameAppropriate } from '$lib/server/moderation';

const MAX_CONTENT_LENGTH = 280;
const RATE_LIMIT_PER_MINUTE = 3;
const LARGE_TRADE_THRESHOLD = '1000';
const FETCH_LIMIT = 100;
const PAGE_SIZE = 50;

export async function GET({ url }) {
	const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1'));

	const [feedEvents, largeTrades] = await Promise.all([
		db
			.select({
				id: globalFeedEvent.id,
				type: globalFeedEvent.type,
				content: globalFeedEvent.content,
				metadata: globalFeedEvent.metadata,
				createdAt: globalFeedEvent.createdAt,
				userId: user.id,
				userName: user.name,
				userUsername: user.username,
				userImage: user.image,
				userNameColor: user.nameColor,
				userPrestigeLevel: user.prestigeLevel
			})
			.from(globalFeedEvent)
			.leftJoin(user, eq(globalFeedEvent.userId, user.id))
			.orderBy(desc(globalFeedEvent.createdAt))
			.limit(FETCH_LIMIT),

		db
			.select({
				id: transaction.id,
				transactionType: transaction.type,
				quantity: transaction.quantity,
				totalBaseCurrencyAmount: transaction.totalBaseCurrencyAmount,
				timestamp: transaction.timestamp,
				coinSymbol: coin.symbol,
				coinName: coin.name,
				coinIcon: coin.icon,
				userId: user.id,
				userName: user.name,
				userUsername: user.username,
				userImage: user.image,
				userNameColor: user.nameColor,
				userPrestigeLevel: user.prestigeLevel
			})
			.from(transaction)
			.innerJoin(coin, eq(transaction.coinId, coin.id))
			.innerJoin(user, eq(transaction.userId, user.id))
			.where(
				and(
					or(eq(transaction.type, 'BUY'), eq(transaction.type, 'SELL'))!,
					gte(transaction.totalBaseCurrencyAmount, LARGE_TRADE_THRESHOLD)
				)
			)
			.orderBy(desc(transaction.timestamp))
			.limit(FETCH_LIMIT)
	]);

	const merged = [
		...feedEvents.map((e) => ({
			id: `fe-${e.id}`,
			type: e.type as string,
			content: e.content ?? null,
			metadata: e.metadata ? (JSON.parse(e.metadata) as Record<string, unknown>) : null,
			createdAt: e.createdAt.toISOString(),
			user: e.userId
				? {
						id: e.userId,
						name: e.userName,
						username: e.userUsername,
						image: e.userImage,
						nameColor: e.userNameColor,
						prestigeLevel: e.userPrestigeLevel
					}
				: null
		})),
		...largeTrades.map((t) => ({
			id: `tr-${t.id}`,
			type: 'LARGE_TRADE',
			content: null,
			metadata: {
				tradeType: t.transactionType,
				coinSymbol: t.coinSymbol,
				coinName: t.coinName,
				coinIcon: t.coinIcon,
				quantity: Number(t.quantity),
				totalValue: Number(t.totalBaseCurrencyAmount)
			} as Record<string, unknown>,
			createdAt: t.timestamp.toISOString(),
			user: {
				id: t.userId,
				name: t.userName,
				username: t.userUsername,
				image: t.userImage,
				nameColor: t.userNameColor,
				prestigeLevel: t.userPrestigeLevel
			}
		}))
	]
		.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
		.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

	return json({ events: merged, page });
}

export async function POST({ request }) {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) throw error(401, 'Not authenticated');

	const userId = Number(session.user.id);
	const body = await request.json();
	const content = typeof body?.content === 'string' ? body.content.trim() : '';

	if (content.length === 0 || content.length > MAX_CONTENT_LENGTH) {
		throw error(400, `Content must be 1–${MAX_CONTENT_LENGTH} characters`);
	}

	if (!(await isNameAppropriate(content))) {
		throw error(400, 'Content contains inappropriate content');
	}

	const oneMinuteAgo = new Date(Date.now() - 60_000);
	const [{ recentCount }] = await db
		.select({ recentCount: count() })
		.from(globalFeedEvent)
		.where(
			and(
				eq(globalFeedEvent.userId, userId),
				eq(globalFeedEvent.type, 'USER_MESSAGE'),
				gte(globalFeedEvent.createdAt, oneMinuteAgo)
			)
		);

	if (Number(recentCount) >= RATE_LIMIT_PER_MINUTE) {
		throw error(429, 'Too many messages. Please wait a moment.');
	}

	const [userRecord] = await db
		.select({
			name: user.name,
			username: user.username,
			image: user.image,
			nameColor: user.nameColor,
			prestigeLevel: user.prestigeLevel
		})
		.from(user)
		.where(eq(user.id, userId))
		.limit(1);

	if (!userRecord) throw error(404, 'User not found');

	const [newEvent] = await db
		.insert(globalFeedEvent)
		.values({ type: 'USER_MESSAGE', userId, content })
		.returning();

	const feedUpdate = {
		type: 'feed_update',
		event: {
			id: `fe-${newEvent.id}`,
			type: 'USER_MESSAGE',
			content,
			metadata: null,
			createdAt: newEvent.createdAt.toISOString(),
			user: {
				id: userId,
				name: userRecord.name,
				username: userRecord.username,
				image: userRecord.image,
				nameColor: userRecord.nameColor,
				prestigeLevel: userRecord.prestigeLevel
			}
		}
	};

	await redis.publish('feed:global', JSON.stringify(feedUpdate));

	return json({ success: true, event: feedUpdate.event });
}