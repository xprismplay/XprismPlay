import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { lotteryDraw, user } from '$lib/server/db/schema';
import { eq, ne, desc } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

export async function GET({ url }) {
	const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 50);
	const offset = Math.max(parseInt(url.searchParams.get('offset') || '0'), 0);

	const winnerUser = alias(user, 'winnerUser');

	const draws = await db
		.select({
			id: lotteryDraw.id,
			drawDate: lotteryDraw.drawDate,
			prizePool: lotteryDraw.prizePool,
			totalTickets: lotteryDraw.totalTickets,
			status: lotteryDraw.status,
			winnerPrize: lotteryDraw.winnerPrize,
			drawnAt: lotteryDraw.drawnAt,
			winnerUsername: winnerUser.username
		})
		.from(lotteryDraw)
		.leftJoin(winnerUser, eq(lotteryDraw.winnerId, winnerUser.id))
		.where(ne(lotteryDraw.status, 'ACTIVE'))
		.orderBy(desc(lotteryDraw.drawDate))
		.limit(limit)
		.offset(offset);

	return json({
		draws: draws.map((d) => ({
			...d,
			prizePool: Number(d.prizePool),
			winnerPrize: d.winnerPrize ? Number(d.winnerPrize) : null
		}))
	});
}