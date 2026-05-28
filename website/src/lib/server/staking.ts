import { db } from '$lib/server/db';
import { coin, coinStakingPool, userStake, priceHistory } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';

/**
 * Lazily advances the 4-hour epoch distributions for a coin's staking pool
 * and updates the AMM price based on the shrunken token supply.
 */
export async function advancePoolEpochs(tx: any, coinId: number) {
	// 1. Fetch current pool and coin metrics
	const [poolData] = await tx
		.select()
		.from(coinStakingPool)
		.where(eq(coinStakingPool.coinId, coinId))
		.limit(1);
	const [coinData] = await tx.select().from(coin).where(eq(coin.id, coinId)).limit(1);

	if (!poolData || !coinData) return null;

	const now = new Date();
	const FOUR_HOURS_MS = 1 * 60 * 60 * 1000;
	const msPassed = now.getTime() - new Date(poolData.lastEpochAt).getTime();
	const epochsPassed = Math.floor(msPassed / FOUR_HOURS_MS);

	// If no 4-hour blocks have passed or nothing is staked, just advance time without distributing
	if (epochsPassed <= 0) return poolData;

	let currentPoolCoin = Number(coinData.poolCoinAmount);
	const totalStaked = Number(poolData.totalStaked);
	const rate = Number(poolData.distributionRate4h);

	let totalRewardsDistributed = 0;

	if (totalStaked > 0) {
		// Compound the distribution over every 4-hour block that passed un-evaluated
		for (let i = 0; i < epochsPassed; i++) {
			const reward = currentPoolCoin * rate;
			totalRewardsDistributed += reward;
			currentPoolCoin -= reward;
		}
	}

	const rewardPerShareDelta = totalStaked > 0 ? totalRewardsDistributed / totalStaked : 0;
	const newRewardPerShare = Number(poolData.rewardPerShare) + rewardPerShareDelta;
	const newEpochTime = new Date(
		new Date(poolData.lastEpochAt).getTime() + epochsPassed * FOUR_HOURS_MS
	);

	// Recalculate AMM price based on shrunken pool coin depth
	const poolBaseCurrencyAmount = Number(coinData.poolBaseCurrencyAmount);
	const newPrice = poolBaseCurrencyAmount / currentPoolCoin;
	const safeMarketCap = Math.min(Number(coinData.circulatingSupply) * newPrice, 1e38);

	// 2. Commit updates to the database
	await tx
		.update(coinStakingPool)
		.set({
			rewardPerShare: newRewardPerShare.toString(),
			lastEpochAt: newEpochTime
		})
		.where(eq(coinStakingPool.coinId, coinId));

	if (totalRewardsDistributed > 0) {
		await tx
			.update(coin)
			.set({
				poolCoinAmount: currentPoolCoin.toString(),
				currentPrice: newPrice.toString(),
				marketCap: safeMarketCap.toString(),
				updatedAt: now
			})
			.where(eq(coin.id, coinId));

		// Record the new price in historical data
		await tx.insert(priceHistory).values({
			coinId: coinId,
			price: newPrice.toString(),
			timestamp: now
		});
	}

	return {
		...poolData,
		rewardPerShare: newRewardPerShare.toString(),
		lastEpochAt: newEpochTime
	};
}

/**
 * Safe sync utility for user rewards before staking/unstaking modifications
 */
export async function syncUserStake(tx: any, userId: number, coinId: number) {
	// First make sure the global pool metrics are fully up to date
	const pool = await advancePoolEpochs(tx, coinId);
	if (!pool) return;

	const [stake] = await tx
		.select()
		.from(userStake)
		.where(and(eq(userStake.userId, userId), eq(userStake.coinId, coinId)))
		.limit(1);

	if (!stake) return;

	const pendingRewards =
		Number(stake.amount) * Number(pool.rewardPerShare) - Number(stake.rewardDebt);
	const newClaimable = Number(stake.claimableRewards) + pendingRewards;

	await tx
		.update(userStake)
		.set({
			claimableRewards: newClaimable.toString(),
			rewardDebt: (Number(stake.amount) * Number(pool.rewardPerShare)).toString()
		})
		.where(and(eq(userStake.userId, userId), eq(userStake.coinId, coinId)));
}
