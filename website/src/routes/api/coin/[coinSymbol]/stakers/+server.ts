import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { coin, userStake, user, coinStakingPool } from '$lib/server/db/schema';
import { eq, desc } from 'drizzle-orm';
import { validateSearchParams } from '$lib/utils/validation';

export async function GET({ params, url }) {
	const coinSymbol = params.coinSymbol?.toUpperCase();
	const validator = validateSearchParams(url.searchParams);
	const limit = validator.getPositiveInt('limit', 50);

	if (!coinSymbol) {
		throw error(400, 'Coin symbol is required');
	}

	if (limit > 200) {
		throw error(400, 'Limit cannot exceed 200');
	}

	try {
		// FIXED: We now join the coinStakingPool table to get totalStaked
		const [coinData] = await db
			.select({
				id: coin.id,
				symbol: coin.symbol,
				currentPrice: coin.currentPrice,
				totalStaked: coinStakingPool.totalStaked // Extracted from the joined pool table
			})
			.from(coin)
			.leftJoin(coinStakingPool, eq(coin.id, coinStakingPool.coinId))
			.where(eq(coin.symbol, coinSymbol))
			.limit(1);

		if (!coinData) {
			throw error(404, 'Coin not found');
		}

		// Fetch the top users ordered by their staked amount
		const stakers = await db
			.select({
				userId: user.id,
				username: user.username,
				name: user.name,
				image: user.image,
				amount: userStake.amount
			})
			.from(userStake)
			.innerJoin(user, eq(userStake.userId, user.id))
			.where(eq(userStake.coinId, coinData.id))
			.orderBy(desc(userStake.amount))
			.limit(limit);

		// If the pool hasn't been lazy-initialized yet, totalStaked defaults to 0
		const totalStaked = Number(coinData.totalStaked || 0);
		const currentPrice = Number(coinData.currentPrice);

		const processedStakers = stakers.map((staker, index) => {
			const quantity = Number(staker.amount);
			// Calculate their exact percentage of the total staking pool
			const percentage = totalStaked > 0 ? (quantity / totalStaked) * 100 : 0;
			// Simple value estimation based on spot price
			const value = quantity * currentPrice;

			return {
				rank: index + 1,
				userId: staker.userId,
				username: staker.username,
				name: staker.name,
				image: staker.image,
				quantity,
				percentage,
				value
			};
		});

		return json({
			coinSymbol: coinData.symbol,
			totalStakers: stakers.length,
			totalStaked: totalStaked,
			stakers: processedStakers
		});
	} catch (e) {
		if (e && typeof e === 'object' && 'status' in e) throw e;
		console.error('Unexpected error in stakers API:', e);
		throw error(500, 'Internal server error');
	}
}
