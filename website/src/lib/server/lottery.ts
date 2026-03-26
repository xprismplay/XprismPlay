import { db } from './db';
import { lotteryDraw, lotteryTicket, user } from './db/schema';
import { eq, lte, and } from 'drizzle-orm';
import { createNotification } from './notification';

export const TICKET_PRICE = 500;
export const WINNER_PERCENT = 0.9;
export const BANK_PERCENT = 0.1;
export const MIN_DRAW_CHANCE = 0.001;
export const MAX_DRAW_CHANCE = 0.5;
export const SCALE_POOL = 1_000_000;

export function calcDrawChance(prizePool: number): number {
	const raw =
		MIN_DRAW_CHANCE +
		(prizePool / SCALE_POOL) * (MAX_DRAW_CHANCE - MIN_DRAW_CHANCE);
	return Math.min(raw, MAX_DRAW_CHANCE);
}

export function getNextDrawDate(): Date {
	const now = new Date();
	const d = new Date(
		Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 0)
	);
	if (now >= d) d.setUTCDate(d.getUTCDate() + 1);
	return d;
}

async function executeExpiredDraws() {
	const now = new Date();
	const expired = await db
		.select({ id: lotteryDraw.id })
		.from(lotteryDraw)
		.where(and(eq(lotteryDraw.status, 'ACTIVE'), lte(lotteryDraw.drawDate, now)));

	for (const { id } of expired) {
		await executeLotteryDraw(id);
	}
}

export async function getOrCreateActiveDraw() {
	await executeExpiredDraws();

	const rows = await db
		.select()
		.from(lotteryDraw)
		.where(eq(lotteryDraw.status, 'ACTIVE'))
		.limit(1);

	if (rows[0]) return rows[0];

	const [created] = await db
		.insert(lotteryDraw)
		.values({
			drawDate: getNextDrawDate(),
			prizePool: '0',
			drawChance: MIN_DRAW_CHANCE.toFixed(8)
		})
		.returning();

	return created;
}

export async function executeLotteryDraw(drawId: number) {
	return db.transaction(async (tx) => {
		const rows = await tx
			.select()
			.from(lotteryDraw)
			.where(and(eq(lotteryDraw.id, drawId), eq(lotteryDraw.status, 'ACTIVE')))
			.for('update')
			.limit(1);

		const draw = rows[0];
		if (!draw) return null;

		const prizePool = Number(draw.prizePool);
		const drawChance = calcDrawChance(prizePool);
		const now = new Date();

		let winnerId: number | null = null;
		let winnerPrize: string | null = null;
		let status: 'DRAWN' | 'ROLLED_OVER' = 'ROLLED_OVER';
		let nextRollover = prizePool;

		if (Math.random() < drawChance && draw.totalTickets > 0) {
			const tickets = await tx
				.select({ userId: lotteryTicket.userId, quantity: lotteryTicket.quantity })
				.from(lotteryTicket)
				.where(eq(lotteryTicket.drawId, drawId));

			const totalWeight = tickets.reduce((s, t) => s + t.quantity, 0);

			if (totalWeight > 0) {
				let rng = Math.random() * totalWeight;
				for (const t of tickets) {
					rng -= t.quantity;
					if (rng <= 0) {
						winnerId = t.userId;
						break;
					}
				}

				if (!winnerId) winnerId = tickets[tickets.length - 1].userId;

				const prize = prizePool * WINNER_PERCENT;
				winnerPrize = prize.toFixed(8);
				status = 'DRAWN';
				nextRollover = prizePool * BANK_PERCENT;

				const [winnerData] = await tx
					.select({ baseCurrencyBalance: user.baseCurrencyBalance })
					.from(user)
					.where(eq(user.id, winnerId))
					.for('update')
					.limit(1);

				if (winnerData) {
					const newBal = Number(winnerData.baseCurrencyBalance) + prize;
					await tx
						.update(user)
						.set({ baseCurrencyBalance: newBal.toFixed(8), updatedAt: now })
						.where(eq(user.id, winnerId));
				}
			}
		}

		await tx
			.update(lotteryDraw)
			.set({ status, winnerId, winnerPrize, drawChance: drawChance.toFixed(8), drawnAt: now })
			.where(eq(lotteryDraw.id, drawId));

		const prevDate = new Date(draw.drawDate);
           const nextDate = new Date(
           Date.UTC(prevDate.getUTCFullYear(), prevDate.getUTCMonth(), prevDate.getUTCDate() + 1, 23, 59, 59, 0)
       );
		const nextChance = calcDrawChance(nextRollover);

		await tx.insert(lotteryDraw).values({
			drawDate: nextDate,
			prizePool: nextRollover.toFixed(8),
			rolloverAmount: nextRollover.toFixed(8),
			drawChance: nextChance.toFixed(8)
		});

		if (winnerId && winnerPrize) {
			const prizeNum = Number(winnerPrize);
			createNotification(
				String(winnerId),
				'SYSTEM',
				'You won the lottery! 🎉',
				`Congratulations! You won $${prizeNum.toLocaleString('en-US', { maximumFractionDigits: 2 })} from the daily lottery draw!`,
				'/lottery'
			);
		}

		return { winnerId, status, winnerPrize: winnerPrize ? Number(winnerPrize) : null };
	});
}