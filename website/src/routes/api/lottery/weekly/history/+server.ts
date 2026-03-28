import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { weeklyLotteryDraw } from '$lib/server/db/schema';
import { ne, desc } from 'drizzle-orm';

export async function GET({ url }) {
	const limit = Math.min(parseInt(url.searchParams.get('limit') || '10'), 50);
	const offset = Math.max(parseInt(url.searchParams.get('offset') || '0'), 0);

	const draws = await db
		.select()
		.from(weeklyLotteryDraw)
		.where(ne(weeklyLotteryDraw.status, 'ACTIVE'))
		.orderBy(desc(weeklyLotteryDraw.drawDate))
		.limit(limit)
		.offset(offset);

	return json({
		draws: draws.map((d) => ({
			id: d.id,
			drawDate: d.drawDate,
			prizePool: Number(d.prizePool),
			totalTickets: d.totalTickets,
			status: d.status,
			drawnNumbers: d.drawnNumbers ? d.drawnNumbers.split(',').map(Number) : [],
			jackpotWinnersCount: d.jackpotWinnersCount ?? 0,
			match5WinnersCount: d.match5WinnersCount ?? 0,
			match4WinnersCount: d.match4WinnersCount ?? 0,
			drawnAt: d.drawnAt
		}))
	});
}