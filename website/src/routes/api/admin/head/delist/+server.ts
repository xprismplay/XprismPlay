import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { user, coin, userPortfolio } from '$lib/server/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { auth } from '$lib/auth';
import { executeSellTrade, calculate24hMetrics } from '$lib/server/amm';
import { redis } from '$lib/server/redis';
import type { RequestHandler } from '@sveltejs/kit';
import { hasFlag } from '$lib/data/flags';

export const POST: RequestHandler = async ({ request }) => {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) {
		return json({ message: 'Unauthorized' }, { status: 401 });
	}

	const [currentUser] = await db
		.select({ flags: user.flags })
		.from(user)
		.where(eq(user.id, Number(session.user.id)))
		.limit(1);

	if (!hasFlag(currentUser.flags, 'IS_HEAD_ADMIN')) {
		return json({ message: 'Forbidden: Head Admin access required' }, { status: 403 });
	}

	const body = await request.json();
	const { coinSymbol } = body;

	if (!coinSymbol) {
		return json({ message: 'Invalid input. Provide a coin symbol.' }, { status: 400 });
	}

	const normalizedSymbol = coinSymbol.toUpperCase();

	const [coinData] = await db.select().from(coin).where(eq(coin.symbol, normalizedSymbol)).limit(1);

	if (!coinData) {
		return json({ message: `Coin "${normalizedSymbol}" not found.` }, { status: 404 });
	}

	if (!coinData.isListed) {
		return json({ message: `Coin "${normalizedSymbol}" is already delisted.` }, { status: 400 });
	}

	try {
		await db.transaction(async (tx) => {
			// Find the top holder for this coin
			const [topHolder] = await tx
				.select({
					userId: userPortfolio.userId,
					quantity: userPortfolio.quantity,
					username: user.username,
					image: user.image
				})
				.from(userPortfolio)
				.innerJoin(user, eq(userPortfolio.userId, user.id))
				.where(eq(userPortfolio.coinId, coinData.id))
				.orderBy(desc(userPortfolio.quantity))
				.limit(1);

			const topQuantity = topHolder ? Number(topHolder.quantity) : 0;

			// Ensure we fetch fresh coin data securely mapped in the transaction
			const [freshCoinData] = await tx
				.select()
				.from(coin)
				.where(eq(coin.symbol, normalizedSymbol))
				.for('update')
				.limit(1);

			if (topHolder && topQuantity > 0) {
				// Execute the AMM sell trade logic to dump the price and trigger standard rug pull checks natively
				const sellResult = await executeSellTrade(tx, freshCoinData, topHolder.userId, topQuantity);

				// Eliminate the holding from their portfolio so they don't possess it anymore
				await tx
					.delete(userPortfolio)
					.where(
						and(eq(userPortfolio.userId, topHolder.userId), eq(userPortfolio.coinId, coinData.id))
					);

				if (sellResult.success) {
					// NOTE: We intentionally bypass attributing the `sellResult.baseCurrencyReceived`
					// to the user's `baseCurrencyBalance` here. The money is essentially burned/vanished!

					// Update and sync the metrics globally with websockets to finalize the public crash
					const metrics =
						sellResult.metrics || (await calculate24hMetrics(coinData.id, sellResult.newPrice));
					const priceUpdateData = {
						currentPrice: sellResult.newPrice,
						marketCap: Number(freshCoinData.circulatingSupply) * sellResult.newPrice,
						change24h: metrics.change24h,
						volume24h: metrics.volume24h,
						poolCoinAmount: sellResult.newPoolCoin,
						poolBaseCurrencyAmount: sellResult.newPoolBaseCurrency
					};

					const tradeData = {
						type: 'SELL',
						username: topHolder.username,
						userImage: topHolder.image || '',
						amount: topQuantity,
						coinSymbol: normalizedSymbol,
						coinName: freshCoinData.name,
						coinIcon: freshCoinData.icon || '',
						totalValue: sellResult.baseCurrencyReceived,
						price: sellResult.newPrice,
						timestamp: Date.now(),
						userId: topHolder.userId.toString()
					};

					await redis.publish(`prices:${normalizedSymbol}`, JSON.stringify(priceUpdateData));
					await redis.publish(
						'trades:all',
						JSON.stringify({ type: 'all-trades', data: tradeData })
					);

					if ((sellResult.baseCurrencyReceived as number) >= 1000) {
						await redis.publish(
							'trades:large',
							JSON.stringify({ type: 'live-trade', data: tradeData })
						);
					}
				}
			}

			// Finalize the delist sequence
			await tx.update(coin).set({ isListed: false }).where(eq(coin.id, coinData.id));
		});

		return json({
			message: `Successfully delisted ${normalizedSymbol} and rugged the top holder.`
		});
	} catch (error: any) {
		console.error('Failed to delist coin:', error);
		return json(
			{ message: error.message || 'Database error while delisting coin.' },
			{ status: 500 }
		);
	}
};
