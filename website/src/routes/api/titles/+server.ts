import { auth } from '$lib/auth';
import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { user, userTitle, titleFund } from '$lib/server/db/schema';
import { eq, and, isNull, desc, sql } from 'drizzle-orm';
import { getFund, computeCurrentValue, computePending } from '$lib/server/titles';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ request }) => {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) throw error(401, 'Not authenticated');

	const userId = Number(session.user.id);

	const [titles, fund] = await Promise.all([
		db
			.select()
			.from(userTitle)
			.where(eq(userTitle.userId, userId))
			.orderBy(desc(userTitle.createdAt)),
		getFund()
	]);

	const accRPS = fund?.accRewardPerShare ?? '0';
	const totalFund = Number(fund?.totalShares ?? 0);

	const result = titles.map((t) => ({
		id: t.id,
		label: t.label,
		initialDeposit: Number(t.initialDeposit),
		currentValue: computeCurrentValue(t, accRPS),
		pendingRewards: computePending(t, accRPS),
		shares: Number(t.shares),
		durationDays: t.durationDays,
		expiresAt: t.expiresAt,
		withdrawnAt: t.withdrawnAt,
		createdAt: t.createdAt,
		expired: new Date() >= new Date(t.expiresAt),
		withdrawn: t.withdrawnAt !== null,
		sharePercent: totalFund > 0 ? (Number(t.shares) / totalFund) * 100 : 0
	}));

	return json({ titles: result, totalFund, accRewardPerShare: accRPS });
};

export const POST: RequestHandler = async ({ request }) => {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) throw error(401, 'Not authenticated');

	const userId = Number(session.user.id);
	const body = await request.json();
	const { label, amount, durationDays } = body;

	if (!label || typeof label !== 'string' || label.trim().length === 0 || label.length > 100) {
		throw error(400, 'Invalid label');
	}

	const amt = Number(amount);
	if (!Number.isFinite(amt) || amt <= 0) throw error(400, 'Amount must be greater than 0');

	const dur = parseInt(durationDays);
	if (!Number.isInteger(dur) || dur < 1 || dur > 60) throw error(400, 'Duration must be 1–60 days');

	return db.transaction(async (tx) => {
		const [userData] = await tx
			.select({ baseCurrencyBalance: user.baseCurrencyBalance })
			.from(user)
			.where(eq(user.id, userId))
			.for('update')
			.limit(1);

		if (!userData) throw error(404, 'User not found');

		const balance = Number(userData.baseCurrencyBalance);
		const rounded = Math.round(amt * 100000000) / 100000000;
		if (balance < rounded) throw error(400, 'Insufficient balance');

		await tx.insert(titleFund).values({ id: 1 }).onConflictDoNothing();

		const [fund] = await tx
			.select()
			.from(titleFund)
			.where(eq(titleFund.id, 1))
			.for('update')
			.limit(1);

		const accRPS = fund?.accRewardPerShare ?? '0';
		const rewardDebt = (rounded * Number(accRPS)).toFixed(30);
		const expiresAt = new Date(Date.now() + dur * 86400000);

		await tx
			.update(user)
			.set({ baseCurrencyBalance: (balance - rounded).toFixed(8), updatedAt: new Date() })
			.where(eq(user.id, userId));

		const [inserted] = await tx
			.insert(userTitle)
			.values({
				userId,
				label: label.trim(),
				initialDeposit: rounded.toFixed(8),
				shares: rounded.toFixed(8),
				rewardDebt,
				durationDays: dur,
				expiresAt
			})
			.returning();

		await tx
			.update(titleFund)
			.set({ totalShares: sql`${titleFund.totalShares} + ${rounded.toFixed(8)}::numeric` })
			.where(eq(titleFund.id, 1));

		return json({ title: inserted }, { status: 201 });
	});
};