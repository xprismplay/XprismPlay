import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { user, coin, userPortfolio } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
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
	const { username, coinSymbol } = body;

	if (!username || !coinSymbol) {
		return json({ message: 'Invalid input. Provide a username and coin symbol.' }, { status: 400 });
	}

	const normalizedSymbol = coinSymbol.toUpperCase();

	const [targetUser] = await db.select().from(user).where(eq(user.username, username)).limit(1);

	if (!targetUser) {
		return json({ message: `User "${username}" not found.` }, { status: 404 });
	}

	const [coinData] = await db.select().from(coin).where(eq(coin.symbol, normalizedSymbol)).limit(1);

	if (!coinData) {
		return json({ message: `Coin "${normalizedSymbol}" not found.` }, { status: 404 });
	}

	try {
		await db.transaction(async (tx) => {
			const [portfolio] = await tx
				.select()
				.from(userPortfolio)
				.where(and(eq(userPortfolio.userId, targetUser.id), eq(userPortfolio.coinId, coinData.id)))
				.limit(1);

			if (!portfolio || Number(portfolio.quantity) <= 0) {
				throw new Error(`User does not own any ${normalizedSymbol}.`);
			}

			const quantity = Number(portfolio.quantity);

			// Ensure we fetch fresh coin data securely mapped in the transaction
			const [freshCoinData] = await tx
				.select()
				.from(coin)
				.where(eq(coin.symbol, normalizedSymbol))
				.for('update')
				.limit(1);

			// Execute the AMM sell trade logic to dump the price natively
			const sellResult = await executeSellTrade(tx, freshCoinData, targetUser.id, quantity);

			// Eliminate the holding from their portfolio so they don't possess it anymore
			await tx
				.delete(userPortfolio)
				.where(and(eq(userPortfolio.userId, targetUser.id), eq(userPortfolio.coinId, coinData.id)));

			if (sellResult.success) {
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
					username: targetUser.username,
					userImage: targetUser.image || '',
					amount: quantity,
					coinSymbol: normalizedSymbol,
					coinName: freshCoinData.name,
					coinIcon: freshCoinData.icon || '',
					totalValue: sellResult.baseCurrencyReceived,
					price: sellResult.newPrice,
					timestamp: Date.now(),
					userId: targetUser.id.toString()
				};

				await redis.publish(`prices:${normalizedSymbol}`, JSON.stringify(priceUpdateData));
				await redis.publish('trades:all', JSON.stringify({ type: 'all-trades', data: tradeData }));

				if ((sellResult.baseCurrencyReceived as number) >= 1000) {
					await redis.publish(
						'trades:large',
						JSON.stringify({ type: 'live-trade', data: tradeData })
					);
				}
			}
		});

		return json({
			message: `Successfully wiped ${username}'s ${normalizedSymbol} portfolio and dumped the AMM.`
		});
	} catch (error: any) {
		console.error('Failed to remove portfolio:', error);
		return json(
			{ message: error.message || 'Database error while removing portfolio.' },
			{ status: 500 }
		);
	}
};
