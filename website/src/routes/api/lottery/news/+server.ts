import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { lotteryDraw, weeklyLotteryDraw, user } from '$lib/server/db/schema';
import { ne, desc, eq } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

export async function GET({ url }) {
	const limit = Math.min(parseInt(url.searchParams.get('limit') || '30'), 100);

	const winnerUser = alias(user, 'winnerUser');

	const [daily, weekly] = await Promise.all([
		db
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
			.limit(limit),

		db
			.select({
				id: weeklyLotteryDraw.id,
				drawDate: weeklyLotteryDraw.drawDate,
				prizePool: weeklyLotteryDraw.prizePool,
				totalTickets: weeklyLotteryDraw.totalTickets,
				status: weeklyLotteryDraw.status,
				drawnNumbers: weeklyLotteryDraw.drawnNumbers,
				drawnAt: weeklyLotteryDraw.drawnAt,
				jackpotWinnersCount: weeklyLotteryDraw.jackpotWinnersCount,
				match5WinnersCount: weeklyLotteryDraw.match5WinnersCount,
				match4WinnersCount: weeklyLotteryDraw.match4WinnersCount
			})
			.from(weeklyLotteryDraw)
			.where(ne(weeklyLotteryDraw.status, 'ACTIVE'))
			.orderBy(desc(weeklyLotteryDraw.drawDate))
			.limit(limit)
	]);

	const news = [
		...daily.map((d) => ({
			type: 'daily',
			id: d.id,
			drawDate: d.drawDate,
			prizePool: Number(d.prizePool),
			totalTickets: d.totalTickets,
			status: d.status,
			winnerPrize: d.winnerPrize ? Number(d.winnerPrize) : null,
			winnerUsername: d.winnerUsername ?? null,
			drawnAt: d.drawnAt,
			drawnNumbers: null as number[] | null,
			jackpotWinnersCount: null as number | null,
			match5WinnersCount: null as number | null,
			match4WinnersCount: null as number | null
		})),
		...weekly.map((d) => ({
			type: 'weekly',
			id: d.id,
			drawDate: d.drawDate,
			prizePool: Number(d.prizePool),
			totalTickets: d.totalTickets,
			status: d.status,
			winnerPrize: null,
			winnerUsername: null,
			drawnAt: d.drawnAt,
			drawnNumbers: d.drawnNumbers ? d.drawnNumbers.split(',').map(Number) : null,
			jackpotWinnersCount: d.jackpotWinnersCount,
			match5WinnersCount: d.match5WinnersCount,
			match4WinnersCount: d.match4WinnersCount
		}))
	]
		.sort((a, b) => new Date(b.drawDate).getTime() - new Date(a.drawDate).getTime())
		.slice(0, limit);

	return json({ news });
}