import { auth } from '$lib/auth';
import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { user, weeklyLotteryDraw, weeklyLotteryTicket } from '$lib/server/db/schema';
import { eq, sql } from 'drizzle-orm';
import {
	getOrCreateActiveWeeklyDraw,
	validateTicketNumbers,
	WEEKLY_TICKET_PRICE,
	NUMBERS_COUNT,
	NUMBERS_MAX
} from '$lib/server/weekly-lottery';

const MAX_RANDOM_TICKETS = 1000;

function generateRandom(count: number, max: number): number[] {
	const nums = new Set<number>();
	while (nums.size < count) nums.add(Math.floor(Math.random() * max) + 1);
	return Array.from(nums).sort((a, b) => a - b);
}

export async function POST({ request }) {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) throw error(401, 'Not authenticated');
	const userId = Number(session.user.id);

	const body = await request.json();
	let ticketSets: number[][];

	if (body.random != null) {
		const count = parseInt(String(body.random), 10);
		if (!Number.isInteger(count) || count < 1 || count > MAX_RANDOM_TICKETS) {
			throw error(400, 'Random count must be between 1 and 1000');
		}
		ticketSets = Array.from({ length: count }, () => generateRandom(NUMBERS_COUNT, NUMBERS_MAX));
	} else if (body.numbers != null) {
		try {
			ticketSets = [validateTicketNumbers(body.numbers)];
		} catch (e) {
			throw error(400, (e as Error).message);
		}
	} else {
		throw error(400, 'Provide numbers array or random count');
	}

	const totalCost = ticketSets.length * WEEKLY_TICKET_PRICE;
	const draw = await getOrCreateActiveWeeklyDraw();
	const now = new Date();

	if (draw.status !== 'ACTIVE' || new Date(draw.drawDate) <= now) {
		throw error(400, 'No active weekly lottery draw available');
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
		if (balance < totalCost) {
			throw error(
				400,
				`Insufficient funds. Need $${totalCost} but have $${balance.toFixed(2)}`
			);
		}

		await tx
			.update(user)
			.set({ baseCurrencyBalance: (balance - totalCost).toFixed(8), updatedAt: now })
			.where(eq(user.id, userId));

		const inserted = await tx
			.insert(weeklyLotteryTicket)
			.values(ticketSets.map((nums) => ({ drawId: draw.id, userId, numbers: nums.join(',') })))
			.returning();

		await tx
			.update(weeklyLotteryDraw)
			.set({
				prizePool: sql`${weeklyLotteryDraw.prizePool} + ${totalCost}`,
				ticketRevenue: sql`${weeklyLotteryDraw.ticketRevenue} + ${totalCost}`,
				totalTickets: sql`${weeklyLotteryDraw.totalTickets} + ${ticketSets.length}`
			})
			.where(eq(weeklyLotteryDraw.id, draw.id));

		return json({
			success: true,
			tickets: inserted.map((t) => ({ id: t.id, numbers: t.numbers.split(',').map(Number) })),
			totalCost,
			newBalance: balance - totalCost
		});
	});
}