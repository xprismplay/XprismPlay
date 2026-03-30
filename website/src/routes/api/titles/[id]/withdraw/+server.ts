import { auth } from '$lib/auth';
import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { user, userTitle, titleFund } from '$lib/server/db/schema';
import { eq, and, isNull, sql, gt } from 'drizzle-orm';
import { computePending } from '$lib/server/titles';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, params }) => {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) throw error(401, 'Not authenticated');

	const userId = Number(session.user.id);
	const titleId = parseInt(params.id);
	if (isNaN(titleId)) throw error(400, 'Invalid title ID');

	return db.transaction(async (tx) => {
		const [title] = await tx
			.select()
			.from(userTitle)
			.where(and(eq(userTitle.id, titleId), eq(userTitle.userId, userId)))
			.for('update')
			.limit(1);

		if (!title) throw error(404, 'Title not found');
		if (title.withdrawnAt !== null) throw error(400, 'Already withdrawn');

		const [fund] = await tx
			.select()
			.from(titleFund)
			.where(eq(titleFund.id, 1))
			.for('update')
			.limit(1);

		const accRPS = fund?.accRewardPerShare ?? '0';
		const pending = computePending(title, accRPS);
		const shares = Number(title.shares);
		const initialDeposit = Number(title.initialDeposit);
		const now = new Date();
		const expired = now >= new Date(title.expiresAt);

		const payout = expired
			? Math.round((initialDeposit + pending) * 100000000) / 100000000
			: initialDeposit;

		const [userData] = await tx
			.select({ baseCurrencyBalance: user.baseCurrencyBalance })
			.from(user)
			.where(eq(user.id, userId))
			.for('update')
			.limit(1);

		if (!userData) throw error(404, 'User not found');

		const newBalance = Number(userData.baseCurrencyBalance) + payout;

		await tx
			.update(user)
			.set({ baseCurrencyBalance: newBalance.toFixed(8), updatedAt: now })
			.where(eq(user.id, userId));

		await tx
			.update(userTitle)
			.set({ withdrawnAt: now })
			.where(eq(userTitle.id, titleId));

		const remainingShares = Number(fund?.totalShares ?? 0) - shares;

		if (!expired && pending > 0 && remainingShares > 0) {
			await tx
				.update(titleFund)
				.set({
					totalShares: sql`GREATEST(0, ${titleFund.totalShares} - ${shares.toFixed(8)}::numeric)`,
					accRewardPerShare: sql`${titleFund.accRewardPerShare} + ${pending.toString()}::numeric / NULLIF(${titleFund.totalShares} - ${shares.toFixed(8)}::numeric, 0)`
				})
				.where(eq(titleFund.id, 1));
		} else {
			await tx
				.update(titleFund)
				.set({
					totalShares: sql`GREATEST(0, ${titleFund.totalShares} - ${shares.toFixed(8)}::numeric)`
				})
				.where(eq(titleFund.id, 1));
		}

		return json({
			payout,
			pendingRewards: expired ? pending : 0,
			forfeited: expired ? 0 : pending,
			newBalance
		});
	});
};