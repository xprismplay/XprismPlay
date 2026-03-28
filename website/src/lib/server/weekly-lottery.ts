import { db } from './db';
import { weeklyLotteryDraw, weeklyLotteryTicket, user } from './db/schema';
import { eq, and, lte, sql } from 'drizzle-orm';
import { createNotification } from './notification';

export const WEEKLY_TICKET_PRICE = 2500;
export const NUMBERS_COUNT = 6;
export const NUMBERS_MAX = 60;
export const BASE_NUMBERS = NUMBERS_COUNT;
export const MAX_CHOSEN_NUMBERS = 10;
const BANK_PCT = 0.1;
const JACKPOT_PCT = 0.5;
const MATCH5_PCT = 0.3;
const MATCH4_PCT = 0.2;

export function getNextWeeklyDrawDate(): Date {
	const now = new Date();
	const base = new Date(
		Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 0)
	);
	const day = base.getUTCDay();
	const daysUntil = day === 0 ? (now.getTime() >= base.getTime() ? 7 : 0) : 7 - day;
	base.setUTCDate(base.getUTCDate() + daysUntil);
	return base;
}

function drawNumbers(): number[] {
	const nums = new Set<number>();
	while (nums.size < NUMBERS_COUNT) {
		nums.add(Math.floor(Math.random() * NUMBERS_MAX) + 1);
	}
	return Array.from(nums).sort((a, b) => a - b);
}

export function combination(n: number, k: number): number {
	if (k > n) return 0;
	if (k > n / 2) k = n - k;
	let res = 1;
	for (let i = 1; i <= k; i++) {
		res = (res * (n - i + 1)) / i;
	}
	return Math.round(res);
}

export function validateTicketNumbers(raw: unknown): number[] {
	if (!Array.isArray(raw) || raw.length < NUMBERS_COUNT || raw.length > MAX_CHOSEN_NUMBERS) {
		throw new Error(`Must pick between ${NUMBERS_COUNT} and ${MAX_CHOSEN_NUMBERS} numbers`);
	}
	const nums = raw.map((n) => {
		const v = parseInt(String(n), 10);
		if (!Number.isInteger(v) || v < 1 || v > NUMBERS_MAX) {
			throw new Error(`Each number must be between 1 and ${NUMBERS_MAX}`);
		}
		return v;
	});
	if (new Set(nums).size !== raw.length) throw new Error('Numbers must be unique');
	return nums;
}
async function executeExpiredWeeklyDraws() {
	const now = new Date();
	const expired = await db
		.select({ id: weeklyLotteryDraw.id })
		.from(weeklyLotteryDraw)
		.where(and(eq(weeklyLotteryDraw.status, 'ACTIVE'), lte(weeklyLotteryDraw.drawDate, now)));
	for (const { id } of expired) {
		await executeWeeklyDraw(id);
	}
}

export async function getOrCreateActiveWeeklyDraw() {
	await executeExpiredWeeklyDraws();
	const rows = await db
		.select()
		.from(weeklyLotteryDraw)
		.where(eq(weeklyLotteryDraw.status, 'ACTIVE'))
		.limit(1);
	if (rows[0]) return rows[0];
	const [created] = await db
		.insert(weeklyLotteryDraw)
		.values({ drawDate: getNextWeeklyDrawDate(), prizePool: '0' })
		.returning();
	return created;
}

export async function executeWeeklyDraw(drawId: number) {
	return db.transaction(async (tx) => {
		const [draw] = await tx
			.select()
			.from(weeklyLotteryDraw)
			.where(and(eq(weeklyLotteryDraw.id, drawId), eq(weeklyLotteryDraw.status, 'ACTIVE')))
			.for('update')
			.limit(1);
		if (!draw) return null;

		const now = new Date();
		const drawn = drawNumbers();
		const drawnStr = drawn.join(',');
		const pool = Number(draw.prizePool);
		const bankSeed = pool * BANK_PCT;
		const prizeable = pool - bankSeed;
		let nextSeed = bankSeed;

		const tickets = await tx
			.select()
			.from(weeklyLotteryTicket)
			.where(eq(weeklyLotteryTicket.drawId, drawId));

		const byMatch: Record<number, typeof tickets> = { 6: [], 5: [], 4: [] };
		for (const t of tickets) {
			const tNums = t.numbers.split(',').map(Number);
			const m = tNums.filter((n) => drawn.includes(n)).length;
			if (m === 6) byMatch[6].push(t);
			else if (m === 5) byMatch[5].push(t);
			else if (m === 4) byMatch[4].push(t);
		}

		const tierPools: Record<number, number> = {
			6: prizeable * JACKPOT_PCT,
			5: prizeable * MATCH5_PCT,
			4: prizeable * MATCH4_PCT
		};

		for (const match of [6, 5, 4]) {
			const winners = byMatch[match];
			const tPool = tierPools[match];
			if (winners.length === 0) {
				nextSeed += tPool;
				continue;
			}
			const perWinner = tPool / winners.length;
			for (const t of winners) {
				if (!t.userId) continue;
				const [u] = await tx
					.select({ baseCurrencyBalance: user.baseCurrencyBalance })
					.from(user)
					.where(eq(user.id, t.userId))
					.for('update')
					.limit(1);
				if (u) {
					const nb = Number(u.baseCurrencyBalance) + perWinner;
					await tx
						.update(user)
						.set({ baseCurrencyBalance: nb.toFixed(8), updatedAt: now })
						.where(eq(user.id, t.userId));
				}
				await tx
					.update(weeklyLotteryTicket)
					.set({ matchCount: match, winnings: perWinner.toFixed(8) })
					.where(eq(weeklyLotteryTicket.id, t.id));
				createNotification(
					String(t.userId),
					'SYSTEM',
					`Weekly Lottery Win! 🎉`,
					`You matched ${match} numbers and won $${perWinner.toLocaleString('en-US', { maximumFractionDigits: 2 })}!`,
					'/lottery'
				);
			}
		}

		const status = tickets.length > 0 ? 'DRAWN' : 'ROLLED_OVER';
		await tx
			.update(weeklyLotteryDraw)
			.set({
				status,
				drawnNumbers: drawnStr,
				drawnAt: now,
				jackpotWinnersCount: byMatch[6].length,
				match5WinnersCount: byMatch[5].length,
				match4WinnersCount: byMatch[4].length
			})
			.where(eq(weeklyLotteryDraw.id, drawId));

		const nextDate = new Date(draw.drawDate);
		nextDate.setUTCDate(nextDate.getUTCDate() + 7);

		await tx.insert(weeklyLotteryDraw).values({
			drawDate: nextDate,
			prizePool: nextSeed.toFixed(8),
			rolloverAmount: nextSeed.toFixed(8)
		});

		return {
			drawn,
			jackpotWinners: byMatch[6].length,
			match5Winners: byMatch[5].length,
			match4Winners: byMatch[4].length
		};
	});
}