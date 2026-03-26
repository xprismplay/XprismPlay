import { db } from '$lib/server/db';
import { globalFeedEvent, transaction, coin, user } from '$lib/server/db/schema';
import { eq, desc, gte, and, or } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

const LARGE_TRADE_THRESHOLD = '1000';
const FETCH_LIMIT = 100;
const PAGE_SIZE = 50;

export const load: PageServerLoad = async () => {
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

	const events = [
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
		.slice(0, PAGE_SIZE);

	return { events };
};