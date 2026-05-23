import { auth } from '$lib/auth';
import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { coin, userPortfolio, user, transaction, coinStakingPool, userStake } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { hasFlag } from '$lib/data/flags';
import { syncUserStake, advancePoolEpochs } from '$lib/server/staking';

// --- GET HANDLER: FETCH LIVE LIVE METRICS & INDIVIDUAL POSITION ---
export async function GET({ params, request }) {
	const { coinSymbol } = params;
	const normalizedSymbol = coinSymbol.toUpperCase();

	// 1. Get core coin data context
	const [coinData] = await db
		.select({ id: coin.id, poolCoinAmount: coin.poolCoinAmount })
		.from(coin)
		.where(eq(coin.symbol, normalizedSymbol))
		.limit(1);

	if (!coinData) throw error(404, 'Coin context not found');
	const coinId = coinData.id;

	// 2. Locate pool or lazy-initialize tracker row if missing
	let [pool] = await db.select().from(coinStakingPool).where(eq(coinStakingPool.coinId, coinId)).limit(1);
	if (!pool) {
		[pool] = await db.insert(coinStakingPool).values({ coinId }).returning();
	}

	let activeUserStake = '0.00000000';
	let userClaimable = '0.00000000';
	
	// 3. Securely authenticate session headers passed from layout fetchers
	try {
		const session = await auth.api.getSession({ headers: request.headers });
		if (session?.user) {
			const [stake] = await db
				.select()
				.from(userStake)
				.where(and(eq(userStake.userId, Number(session.user.id)), eq(userStake.coinId, coinId)))
				.limit(1);
			if (stake) {
				activeUserStake = stake.amount;
				userClaimable = stake.claimableRewards;
			}
		}
	} catch (e) {
		console.error('Staking GET Session Auth error:', e);
	}

	return json({
		totalStaked: pool.totalStaked,
		lastEpochAt: pool.lastEpochAt,
		distributionRate4h: pool.distributionRate4h,
		poolCoinAmount: coinData.poolCoinAmount,
		userStaked: activeUserStake,
		userClaimable: userClaimable
	});
}

// --- POST HANDLER: EXECUTE TRANSACTION ACTIONS ---
export async function POST({ params, request }) {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) throw error(401, 'Not authenticated');
	
	const userId = Number(session.user.id);
	const [currentUser] = await db.select({ flags: user.flags }).from(user).where(eq(user.id, userId)).limit(1);

	if (hasFlag(currentUser.flags, 'NO_ARCADE')) {
		return json({ message: "You aren't authorized to use arcade features." }, { status: 403 });
	}

	const { coinSymbol } = params;
	const { type, amount } = await request.json();

	if (!['STAKE', 'UNSTAKE', 'CLAIM'].includes(type)) throw error(400, 'Invalid staking action type');
	if (type !== 'CLAIM' && (!amount || typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0)) {
		throw error(400, 'Invalid transaction amount');
	}

	const normalizedSymbol = coinSymbol.toUpperCase();
	const [coinData] = await db.select({ id: coin.id }).from(coin).where(eq(coin.symbol, normalizedSymbol)).limit(1);
	if (!coinData) throw error(404, 'Coin record not found');
	const coinId = coinData.id;

	return await db.transaction(async (tx) => {
		let [pool] = await tx.select().from(coinStakingPool).where(eq(coinStakingPool.coinId, coinId)).limit(1);
		if (!pool) {
			[pool] = await tx.insert(coinStakingPool).values({ coinId }).returning();
		}

		await syncUserStake(tx, userId, coinId);

		const [stake] = await tx
			.select()
			.from(userStake)
			.where(and(eq(userStake.userId, userId), eq(userStake.coinId, coinId)))
			.limit(1);

		if (type === 'STAKE') {
			const [userHolding] = await tx.select({ quantity: userPortfolio.quantity }).from(userPortfolio).where(and(eq(userPortfolio.userId, userId), eq(userPortfolio.coinId, coinId))).limit(1);
			if (!userHolding || Number(userHolding.quantity) < amount) throw error(400, 'Insufficient balance');

			const newQuantity = Number(userHolding.quantity) - amount;
			if (newQuantity > 0.000001) {
				await tx.update(userPortfolio).set({ quantity: newQuantity.toString(), updatedAt: new Date() }).where(and(eq(userPortfolio.userId, userId), eq(userPortfolio.coinId, coinId)));
			} else {
				await tx.delete(userPortfolio).where(and(eq(userPortfolio.userId, userId), eq(userPortfolio.coinId, coinId)));
			}

			let newStakeAmount = amount;
			if (stake) {
				newStakeAmount = Number(stake.amount) + amount;
				await tx.update(userStake).set({ amount: newStakeAmount.toString() }).where(and(eq(userStake.userId, userId), eq(userStake.coinId, coinId)));
			} else {
				await tx.insert(userStake).values({ userId, coinId, amount: amount.toString(), rewardDebt: '0', claimableRewards: '0' });
			}

			await tx.update(coinStakingPool).set({ totalStaked: (Number(pool.totalStaked) + amount).toString() }).where(eq(coinStakingPool.coinId, coinId));
			const updatedPool = (await advancePoolEpochs(tx, coinId)) || pool;
			await tx.update(userStake).set({ rewardDebt: (newStakeAmount * Number(updatedPool.rewardPerShare)).toString() }).where(and(eq(userStake.userId, userId), eq(userStake.coinId, coinId)));

			await tx.insert(transaction).values({ userId, coinId, type: 'STAKE', quantity: amount.toString(), pricePerCoin: '0', totalBaseCurrencyAmount: '0', note: 'Staked to compounding pool' });
			return json({ success: true, type: 'STAKE', amount });
		}

		if (type === 'UNSTAKE') {
			if (!stake || Number(stake.amount) < amount) throw error(400, 'Insufficient staked balance');

			const newStakeAmount = Number(stake.amount) - amount;
			if (newStakeAmount > 0.000001) {
				await tx.update(userStake).set({ amount: newStakeAmount.toString() }).where(and(eq(userStake.userId, userId), eq(userStake.coinId, coinId)));
			} else {
				await tx.delete(userStake).where(and(eq(userStake.userId, userId), eq(userStake.coinId, coinId)));
			}

			const [existingHolding] = await tx.select({ quantity: userPortfolio.quantity }).from(userPortfolio).where(and(eq(userPortfolio.userId, userId), eq(userPortfolio.coinId, coinId))).limit(1);
			if (existingHolding) {
				await tx.update(userPortfolio).set({ quantity: (Number(existingHolding.quantity) + amount).toString(), updatedAt: new Date() }).where(and(eq(userPortfolio.userId, userId), eq(userPortfolio.coinId, coinId)));
			} else {
				await tx.insert(userPortfolio).values({ userId, coinId, quantity: amount.toString() });
			}

			await tx.update(coinStakingPool).set({ totalStaked: (Number(pool.totalStaked) - amount).toString() }).where(eq(coinStakingPool.coinId, coinId));
			if (newStakeAmount > 0.000001) {
				const updatedPool = (await advancePoolEpochs(tx, coinId)) || pool;
				await tx.update(userStake).set({ rewardDebt: (newStakeAmount * Number(updatedPool.rewardPerShare)).toString() }).where(and(eq(userStake.userId, userId), eq(userStake.coinId, coinId)));
			}

			await tx.insert(transaction).values({ userId, coinId, type: 'UNSTAKE', quantity: amount.toString(), pricePerCoin: '0', totalBaseCurrencyAmount: '0', note: 'Withdrew staking deposit' });
			return json({ success: true, type: 'UNSTAKE', amount });
		}

		if (type === 'CLAIM') {
			const currentClaimable = stake ? Number(stake.claimableRewards) : 0;
			if (currentClaimable <= 0.000001) throw error(400, 'No rewards to claim');

			await tx.update(userStake).set({ claimableRewards: '0' }).where(and(eq(userStake.userId, userId), eq(userStake.coinId, coinId)));
			const [existingHolding] = await tx.select({ quantity: userPortfolio.quantity }).from(userPortfolio).where(and(eq(userPortfolio.userId, userId), eq(userPortfolio.coinId, coinId))).limit(1);

			if (existingHolding) {
				await tx.update(userPortfolio).set({ quantity: (Number(existingHolding.quantity) + currentClaimable).toString(), updatedAt: new Date() }).where(and(eq(userPortfolio.userId, userId), eq(userPortfolio.coinId, coinId)));
			} else {
				await tx.insert(userPortfolio).values({ userId, coinId, quantity: currentClaimable.toString() });
			}

			await tx.insert(transaction).values({ userId, coinId, type: 'CLAIM_REWARD', quantity: currentClaimable.toString(), pricePerCoin: '0', totalBaseCurrencyAmount: '0', note: 'Claimed epoch yield rewards' });
			return json({ success: true, type: 'CLAIM', rewardsClaimed: currentClaimable });
		}
	});
}