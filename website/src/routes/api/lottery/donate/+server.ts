import { auth } from '$lib/auth';
import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { user, lotteryDraw } from '$lib/server/db/schema';
import { eq, sql } from 'drizzle-orm';
import { getOrCreateActiveDraw } from '$lib/server/lottery';

export async function POST({ request }) {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) throw error(401, 'Not authenticated');
	const userId = Number(session.user.id);

	const body = await request.json();
	const amount = Number(body.amount);

	if (!Number.isFinite(amount) || amount <= 0) throw error(400, 'Invalid donation amount');
	if (amount < 1) throw error(400, 'Minimum donation is $1');
	if (amount > 1_000_000) throw error(400, 'Maximum donation is $1,000,000');

	const draw = await getOrCreateActiveDraw();
	const now = new Date();

	if (draw.status !== 'ACTIVE' || new Date(draw.drawDate) <= now) {
		throw error(400, 'No active lottery draw to donate to');
	}

	return db.transaction(async (tx) => {
		const [userData] = await tx
			.select({ baseCurrencyBalance: user.baseCurrencyBalance })
			.from(user)
			.where(eq(user.id, userId))
			.for('update')
			.limit(1);

		if (!userData) throw error(404, 'User not found');
		const balance = Number(userData.baseCurrencyBalance);
		const rounded = Math.round(amount * 100000000) / 100000000;

		if (balance < rounded) {
			throw error(400, `Insufficient funds. Have $${balance.toFixed(2)}, donating $${rounded.toFixed(2)}`);
		}

		await tx
			.update(user)
			.set({ baseCurrencyBalance: (balance - rounded).toFixed(8), updatedAt: now })
			.where(eq(user.id, userId));

		await tx
			.update(lotteryDraw)
			.set({
				prizePool: sql`${lotteryDraw.prizePool} + ${rounded}`,
				donations: sql`${lotteryDraw.donations} + ${rounded}`
			})
			.where(eq(lotteryDraw.id, draw.id));

		return json({ success: true, donated: rounded, newBalance: balance - rounded });
	});
}