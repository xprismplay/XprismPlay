import { db } from './db';
import { titleFund, userTitle, user } from './db/schema';
import { eq, sql, and, isNull, gt } from 'drizzle-orm';

export const TRADE_FEE_RATE = 0.02;

async function ensureFund(tx: any) {
	await tx.insert(titleFund).values({ id: 1 }).onConflictDoNothing();
}

export async function applyFeeToFund(fee: number, tx: any) {
	if (fee <= 0) return;
	await ensureFund(tx);
	await tx
		.update(titleFund)
		.set({
			accRewardPerShare: sql`${titleFund.accRewardPerShare} + ${fee.toString()}::numeric / NULLIF(${titleFund.totalShares}, 0)`
		})
		.where(and(eq(titleFund.id, 1), gt(titleFund.totalShares, '0')));
}

export async function getFund(tx?: any) {
	const db_ = tx ?? db;
	const [fund] = await db_
		.select()
		.from(titleFund)
		.where(eq(titleFund.id, 1))
		.limit(1);
	return fund ?? { id: 1, accRewardPerShare: '0', totalShares: '0' };
}

export function computePending(title: { shares: string; rewardDebt: string }, accRewardPerShare: string): number {
	const pending = Number(title.shares) * Number(accRewardPerShare) - Number(title.rewardDebt);
	return Math.max(0, pending);
}

export function computeCurrentValue(title: { initialDeposit: string; shares: string; rewardDebt: string }, accRewardPerShare: string): number {
	return Number(title.initialDeposit) + computePending(title, accRewardPerShare);
}