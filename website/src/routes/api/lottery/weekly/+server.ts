import { json } from '@sveltejs/kit';
import { auth } from '$lib/auth';
import { db } from '$lib/server/db';
import { weeklyLotteryTicket } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import {
	getOrCreateActiveWeeklyDraw,
	WEEKLY_TICKET_PRICE,
	NUMBERS_COUNT,
	NUMBERS_MAX
} from '$lib/server/weekly-lottery';

export async function GET({ request }) {
	const session = await auth.api.getSession({ headers: request.headers });
	const userId = session?.user ? Number(session.user.id) : null;
	const draw = await getOrCreateActiveWeeklyDraw();

	let userTickets: any[] = [];
	if (userId) {
		userTickets = await db
			.select()
			.from(weeklyLotteryTicket)
			.where(and(eq(weeklyLotteryTicket.drawId, draw.id), eq(weeklyLotteryTicket.userId, userId)));
	}

	return json({
		draw: {
			id: draw.id,
			drawDate: draw.drawDate,
			prizePool: Number(draw.prizePool),
			ticketRevenue: Number(draw.ticketRevenue),
			donations: Number(draw.donations),
			rolloverAmount: Number(draw.rolloverAmount),
			totalTickets: draw.totalTickets,
			status: draw.status
		},
		ticketPrice: WEEKLY_TICKET_PRICE,
		numbersCount: NUMBERS_COUNT,
		numbersMax: NUMBERS_MAX,
		userTickets: userTickets.map((t) => ({
			id: t.id,
			numbers: t.numbers.split(',').map(Number),
			matchCount: t.matchCount,
			winnings: t.winnings ? Number(t.winnings) : null,
			purchasedAt: t.purchasedAt
		}))
	});
}