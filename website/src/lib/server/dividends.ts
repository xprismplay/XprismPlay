import { db } from './db';
import {
	coin,
	userPortfolio,
	user,
	dividendCoinConfig,
	dividendPayoutLog,
	userDividendReward,
	transaction
} from './db/schema';
import { eq, and, gt, sql, inArray } from 'drizzle-orm';
import { redis } from './redis';

export type DividendMode = 'fees' | 'apr';

export interface DividendConfig {
	mode: DividendMode;
	poolFeeRate: number;
	holdersShareRate: number;
	targetApr: number;
	isEnabled: boolean;
	excludeCreatorFromDividends: boolean;
	minHoldingHours: number;
	minCoinAgeHours: number;
}

export interface DividendMetrics {
	circulatingSupply: number;
	burnedCoins: number;
	marketCap: number;
	currentPrice: number;
	dailyTotalPayout: number;
	userSharePercent: number;
	userDailyPayout: number;
	userWeeklyPayout: number;
	userMonthlyPayout: number;
	mode: DividendMode;
	poolFeeRate: number;
	holdersShareRate: number;
	targetApr: number;
}

export interface PayoutResult {
	coinId: number;
	payoutDate: string;
	totalPayout: number;
	holderCount: number;
	success: boolean;
	error?: string;
}

type ProtectedDividendHolder = {
	userId: number;
	quantity: number;
	lastAcquiredAt: Date;
};

const DEFAULT_CONFIG: DividendConfig = {
	mode: 'fees',
	poolFeeRate: 0.003,
	holdersShareRate: 0.5,
	targetApr: 0.1,
	isEnabled: true,
	excludeCreatorFromDividends: true,
	minHoldingHours: 24,
	minCoinAgeHours: 24
};

function safeDiv(a: number, b: number): number {
	if (!b || !isFinite(b) || b === 0) return 0;
	const r = a / b;
	return isFinite(r) ? r : 0;
}

function safeMul(...args: number[]): number {
	return args.reduce((acc, v) => (isFinite(v) ? acc * v : 0), 1);
}

function currentPayoutDate(): string {
	return new Date().toISOString().slice(0, 10);
}

export function computeDailyTotalPayout(
	mode: DividendMode,
	dailyVolumeUsd: number,
	poolFeeRate: number,
	holdersShareRate: number,
	currentPrice: number,
	circulatingSupply: number,
	targetApr: number
): number {
	if (mode === 'fees') {
		return safeMul(dailyVolumeUsd, poolFeeRate, holdersShareRate);
	}
	const marketCap = safeMul(currentPrice, circulatingSupply);
	return safeDiv(safeMul(marketCap, targetApr), 365);
}

export function computeUserPayouts(
	dailyTotalPayout: number,
	userBalance: number,
	circulatingSupply: number
): { daily: number; weekly: number; monthly: number; sharePercent: number } {
	if (circulatingSupply <= 0 || userBalance <= 0) {
		return { daily: 0, weekly: 0, monthly: 0, sharePercent: 0 };
	}
	const share = safeDiv(userBalance, circulatingSupply);
	const daily = safeMul(dailyTotalPayout, share);
	return {
		daily,
		weekly: daily * 7,
		monthly: daily * 30,
		sharePercent: share * 100
	};
}

async function getCoinDividendConfig(coinId: number): Promise<DividendConfig> {
	const [row] = await db
		.select()
		.from(dividendCoinConfig)
		.where(eq(dividendCoinConfig.coinId, coinId))
		.limit(1);

	if (!row) return DEFAULT_CONFIG;

	return {
		mode: row.mode as DividendMode,
		poolFeeRate: Number(row.poolFeeRate),
		holdersShareRate: Number(row.holdersShareRate),
		targetApr: Number(row.targetApr),
		isEnabled: row.isEnabled,
		excludeCreatorFromDividends: DEFAULT_CONFIG.excludeCreatorFromDividends,
		minHoldingHours: DEFAULT_CONFIG.minHoldingHours,
		minCoinAgeHours: DEFAULT_CONFIG.minCoinAgeHours
	};
}

async function getProtectedDividendHolders(
	tx: any,
	coinId: number,
	coinCreatedAt: Date,
	creatorId: number | null,
	options: {
		excludeCreator?: boolean;
		minHoldingHours?: number;
		minCoinAgeHours?: number;
	} = {}
): Promise<{
	holders: ProtectedDividendHolder[];
	totalEligibleSupply: number;
	blockedReason?: string;
}> {
	const excludeCreator = options.excludeCreator ?? true;
	const minHoldingHours = options.minHoldingHours ?? 24;
	const minCoinAgeHours = options.minCoinAgeHours ?? 24;

	const now = Date.now();
	const coinAgeHours = (now - new Date(coinCreatedAt).getTime()) / 3_600_000;

	if (coinAgeHours < minCoinAgeHours) {
		return {
			holders: [],
			totalEligibleSupply: 0,
			blockedReason: `Coin too new (${coinAgeHours.toFixed(2)}h < ${minCoinAgeHours}h)`
		};
	}

	const rawHolders = await tx
		.select({
			userId: userPortfolio.userId,
			quantity: userPortfolio.quantity,
			updatedAt: userPortfolio.updatedAt
		})
		.from(userPortfolio)
		.where(and(eq(userPortfolio.coinId, coinId), gt(userPortfolio.quantity, '0')));

	if (rawHolders.length === 0) {
		return {
			holders: [],
			totalEligibleSupply: 0,
			blockedReason: 'No holders'
		};
	}

	const holderIds = rawHolders.map((h: any) => h.userId);

	const lastAcquisitionRows = await tx
		.select({
			userId: transaction.userId,
			lastAcquiredAt: sql<Date | null>`MAX(${transaction.timestamp})`
		})
		.from(transaction)
		.where(
			and(
				eq(transaction.coinId, coinId),
				inArray(transaction.userId, holderIds),
				inArray(transaction.type, ['BUY', 'TRANSFER_IN'])
			)
		)
		.groupBy(transaction.userId);

	const lastAcquisitionMap = new Map<number, Date>();
	for (const row of lastAcquisitionRows) {
		if (row.lastAcquiredAt) {
			lastAcquisitionMap.set(row.userId, new Date(row.lastAcquiredAt as any));
		}
	}

	const holders: ProtectedDividendHolder[] = [];

	for (const holder of rawHolders) {
		if (excludeCreator && creatorId != null && holder.userId === creatorId) {
			continue;
		}

		const qty = Number(holder.quantity);
		if (!Number.isFinite(qty) || qty <= 0) continue;

		const lastAcquiredAt = lastAcquisitionMap.get(holder.userId) ?? new Date(holder.updatedAt);
		const heldHours = (now - lastAcquiredAt.getTime()) / 3_600_000;

		if (heldHours < minHoldingHours) {
			continue;
		}

		holders.push({
			userId: holder.userId,
			quantity: qty,
			lastAcquiredAt
		});
	}

	const totalEligibleSupply = holders.reduce((sum, h) => sum + h.quantity, 0);

	return {
		holders,
		totalEligibleSupply,
		blockedReason: holders.length ? undefined : 'No eligible holders'
	};
}

async function getLastAcquisitionForUser(
	tx: any,
	userId: number,
	coinId: number
): Promise<Date | undefined> {
	const [row] = await tx
		.select({
			lastAcquiredAt: sql<Date | null>`MAX(${transaction.timestamp})`
		})
		.from(transaction)
		.where(
			and(
				eq(transaction.userId, userId),
				eq(transaction.coinId, coinId),
				inArray(transaction.type, ['BUY', 'TRANSFER_IN'])
			)
		);

	return row?.lastAcquiredAt ? new Date(row.lastAcquiredAt as any) : undefined;
}

export async function getDividendMetrics(
	coinId: number,
	userBalance: number = 0
): Promise<DividendMetrics | null> {
	const [coinData] = await db
		.select({
			currentPrice: coin.currentPrice,
			marketCap: coin.marketCap,
			volume24h: coin.volume24h,
			circulatingSupply: coin.circulatingSupply,
			initialSupply: coin.initialSupply
		})
		.from(coin)
		.where(eq(coin.id, coinId))
		.limit(1);

	if (!coinData) return null;

	const config = await getCoinDividendConfig(coinId);

	const initialSupply = Number(coinData.initialSupply);
	const circulatingSupply = Number(coinData.circulatingSupply);
	const burnedCoins = Math.max(0, initialSupply - circulatingSupply);
	const currentPrice = Number(coinData.currentPrice);
	const dailyVolumeUsd = Number(coinData.volume24h);
	const marketCap = Number(coinData.marketCap);

	const dailyTotalPayout = computeDailyTotalPayout(
		config.mode,
		dailyVolumeUsd,
		config.poolFeeRate,
		config.holdersShareRate,
		currentPrice,
		circulatingSupply,
		config.targetApr
	);

	const userPayouts = computeUserPayouts(dailyTotalPayout, userBalance, circulatingSupply);

	return {
		circulatingSupply,
		burnedCoins,
		marketCap,
		currentPrice,
		dailyTotalPayout,
		userSharePercent: userPayouts.sharePercent,
		userDailyPayout: userPayouts.daily,
		userWeeklyPayout: userPayouts.weekly,
		userMonthlyPayout: userPayouts.monthly,
		mode: config.mode,
		poolFeeRate: config.poolFeeRate,
		holdersShareRate: config.holdersShareRate,
		targetApr: config.targetApr
	};
}

export async function processCoinDividendPayout(coinId: number): Promise<PayoutResult> {
	const payoutDate = currentPayoutDate();
	const lockKey = `dividend:lock:${coinId}:${payoutDate}`;

	const acquired = await redis.set(lockKey, '1', { NX: true, EX: 86400 });
	if (!acquired) {
		return {
			coinId,
			payoutDate,
			totalPayout: 0,
			holderCount: 0,
			success: false,
			error: 'Payout already processed today'
		};
	}

	try {
		return await db.transaction(async (tx) => {
			const [existing] = await tx
				.select({ id: dividendPayoutLog.id })
				.from(dividendPayoutLog)
				.where(
					and(
						eq(dividendPayoutLog.coinId, coinId),
						eq(dividendPayoutLog.payoutDate, payoutDate)
					)
				)
				.limit(1);

			if (existing) {
				return {
					coinId,
					payoutDate,
					totalPayout: 0,
					holderCount: 0,
					success: false,
					error: 'Already paid today (DB check)'
				};
			}

			const [coinData] = await tx
				.select({
					id: coin.id,
					currentPrice: coin.currentPrice,
					volume24h: coin.volume24h,
					circulatingSupply: coin.circulatingSupply,
					initialSupply: coin.initialSupply,
					isListed: coin.isListed,
					creatorId: coin.creatorId,
					createdAt: coin.createdAt
				})
				.from(coin)
				.where(eq(coin.id, coinId))
				.for('update')
				.limit(1);

			if (!coinData?.isListed) {
				await tx.insert(dividendPayoutLog).values({
					coinId,
					payoutDate,
					totalPayout: '0',
					holderCount: 0
				});
				return {
					coinId,
					payoutDate,
					totalPayout: 0,
					holderCount: 0,
					success: true,
					error: 'Coin unlisted'
				};
			}

			const config = await getCoinDividendConfig(coinId);

			if (!config.isEnabled) {
				await tx.insert(dividendPayoutLog).values({
					coinId,
					payoutDate,
					totalPayout: '0',
					holderCount: 0
				});
				return {
					coinId,
					payoutDate,
					totalPayout: 0,
					holderCount: 0,
					success: true,
					error: 'Dividends disabled'
				};
			}

			const protection = await getProtectedDividendHolders(
				tx,
				coinId,
				new Date(coinData.createdAt),
				coinData.creatorId ?? null,
				{
					excludeCreator: config.excludeCreatorFromDividends,
					minHoldingHours: config.minHoldingHours,
					minCoinAgeHours: config.minCoinAgeHours
				}
			);

			if (protection.totalEligibleSupply <= 0) {
				await tx.insert(dividendPayoutLog).values({
					coinId,
					payoutDate,
					totalPayout: '0',
					holderCount: 0
				});
				return {
					coinId,
					payoutDate,
					totalPayout: 0,
					holderCount: 0,
					success: true,
					error: protection.blockedReason
				};
			}

			const currentPrice = Number(coinData.currentPrice);
			const dailyVolumeUsd = Number(coinData.volume24h);
			const circulatingSupply = Number(coinData.circulatingSupply);
			const eligibleSupply = protection.totalEligibleSupply;

			const dailyTotalPayout = computeDailyTotalPayout(
				config.mode,
				dailyVolumeUsd,
				config.poolFeeRate,
				config.holdersShareRate,
				currentPrice,
				circulatingSupply,
				config.targetApr
			);

			if (dailyTotalPayout <= 0) {
				await tx.insert(dividendPayoutLog).values({
					coinId,
					payoutDate,
					totalPayout: '0',
					holderCount: 0
				});
				return { coinId, payoutDate, totalPayout: 0, holderCount: 0, success: true };
			}

			let actualTotalPaid = 0;

			for (const holder of protection.holders) {
				const qty = Number(holder.quantity);
				if (qty <= 0) continue;

				const raw = safeDiv(safeMul(dailyTotalPayout, qty), eligibleSupply);
				if (raw <= 0) continue;

				const reward = Math.round(raw * 100000000) / 100000000;
				if (reward <= 0) continue;

				actualTotalPaid += reward;

				await tx
					.update(user)
					.set({
						baseCurrencyBalance: sql`${user.baseCurrencyBalance} + ${reward.toFixed(8)}`,
						updatedAt: new Date()
					})
					.where(eq(user.id, holder.userId));

				await tx
					.insert(userDividendReward)
					.values({
						userId: holder.userId,
						coinId,
						totalEarned: reward.toFixed(8),
						lastPayoutDate: payoutDate,
						updatedAt: new Date()
					})
					.onConflictDoUpdate({
						target: [userDividendReward.userId, userDividendReward.coinId],
						set: {
							totalEarned: sql`${userDividendReward.totalEarned} + ${reward.toFixed(8)}`,
							lastPayoutDate: payoutDate,
							updatedAt: new Date()
						}
					});
			}

			await tx.insert(dividendPayoutLog).values({
				coinId,
				payoutDate,
				totalPayout: actualTotalPaid.toFixed(8),
				holderCount: protection.holders.length
			});

			return {
				coinId,
				payoutDate,
				totalPayout: actualTotalPaid,
				holderCount: protection.holders.length,
				success: true
			};
		});
	} catch (err) {
		await redis.del(lockKey);
		return {
			coinId,
			payoutDate,
			totalPayout: 0,
			holderCount: 0,
			success: false,
			error: err instanceof Error ? err.message : 'Unknown error'
		};
	}
}

export async function processAllDividendPayouts(): Promise<PayoutResult[]> {
	const listed = await db.select({ id: coin.id }).from(coin).where(eq(coin.isListed, true));

	const results: PayoutResult[] = [];
	for (const c of listed) {
		try {
			const result = await processCoinDividendPayout(c.id);
			if (result.totalPayout > 0) results.push(result);
		} catch (err) {
			console.error(`Dividend payout failed for coin ${c.id}:`, err);
		}
	}
	return results;
}