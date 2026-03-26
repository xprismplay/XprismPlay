import { error, json } from '@sveltejs/kit';
import { auth } from '$lib/auth';
import { db } from '$lib/server/db';
import { user, lotteryDraw } from '$lib/server/db/schema';
import { eq, and, lte } from 'drizzle-orm';
import { executeLotteryDraw } from '$lib/server/lottery';
import { hasFlag } from '$lib/data/flags';

export async function POST({ request }) {
	const secret = request.headers.get('x-lottery-secret');
	const envSecret = process.env.LOTTERY_DRAW_SECRET;

	const authorizedBySecret = envSecret && secret === envSecret;

	if (!authorizedBySecret) {
		const session = await auth.api.getSession({ headers: request.headers });
		if (!session?.user) throw error(401, 'Unauthorized');

		const [currentUser] = await db
			.select({ flags: user.flags })
			.from(user)
			.where(eq(user.id, Number(session.user.id)))
			.limit(1);

		if (!hasFlag(currentUser?.flags, 'IS_ADMIN', 'IS_HEAD_ADMIN')) {
			throw error(403, 'Forbidden');
		}
	}

	const now = new Date();
	const expired = await db
		.select({ id: lotteryDraw.id })
		.from(lotteryDraw)
		.where(and(eq(lotteryDraw.status, 'ACTIVE'), lte(lotteryDraw.drawDate, now)));

	if (expired.length === 0) {
		return json({ message: 'No draws to execute', executed: 0 });
	}

	const results = [];
	for (const { id } of expired) {
		const result = await executeLotteryDraw(id);
		if (result) results.push({ drawId: id, ...result });
	}

	return json({ executed: results.length, results });
}