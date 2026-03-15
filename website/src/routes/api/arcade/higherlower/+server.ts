import { auth } from '$lib/auth';
import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { randomInt } from 'crypto';
import { publishArcadeActivity } from '$lib/server/arcade-activity';
import { checkAndAwardAchievements } from '$lib/server/achievements';
import { validateBetAmount } from '$lib/utils';
import type { RequestHandler } from './$types';
import { redis } from '$lib/server/redis';
import { hasFlag } from '$lib/data/flags';

type Guess = 'higher' | 'lower' | 'exact';

const MIN = 1;
const MAX = 99;
const HOUSE_EDGE = 0.9; //10% house edge

function getPayout(shown: number, guess: Guess): number {
	const total = MAX - MIN + 1;

	if (guess === 'exact') {
		return total * HOUSE_EDGE;
	}

	if (guess === 'higher') {
		const winning = MAX - shown;
		if (winning <= 0) return 0;
		return (total / winning) * HOUSE_EDGE;
	}

	if (guess === 'lower') {
		const winning = shown - MIN;
		if (winning <= 0) return 0;
		return (total / winning) * HOUSE_EDGE;
	}

	return 0;
}

export const POST: RequestHandler = async ({ request }) => {
	const authSession = await auth.api.getSession({ headers: request.headers });
	if (!authSession?.user) throw error(401, 'Not authenticated');

	const userId = Number(authSession.user.id);

	const [currentUser] = await db
		.select({ flags: user.flags })
		.from(user)
		.where(eq(user.id, userId))
		.limit(1);
	if (hasFlag(currentUser.flags, 'NO_ARCADE'))
		return json({ error: "You aren't authorized to play Arcade games." }, { status: 403 });
	try {
		const body = await request.json();
		const action: string = body.action;

		if (action === 'start') {
			const roundedBet = validateBetAmount(body.amount);

			const shownNumber = randomInt(MIN, MAX);
			const hiddenNumber = randomInt(MIN, MAX);

			// transaction token for authentication stuff
			const randomBytes = new Uint8Array(8);
			crypto.getRandomValues(randomBytes);
			const sessionToken = Array.from(randomBytes)
				.map((b) => b.toString(16).padStart(2, '0'))
				.join('');

			const now = Date.now();

			const sessionKey = `higherlower:session:${sessionToken}`;

			const SESSION_TTL = 300; // 5 minutes
			await redis.set(
				sessionKey,
				JSON.stringify({
					sessionToken,
					betAmount: roundedBet,
					shownNumber,
					hiddenNumber,
					startTime: now,
					userId,
					version: 0
				}),
				{ EX: SESSION_TTL }
			);

			const result = await db.transaction(async (tx) => {
				const [userData] = await tx
					.select({ baseCurrencyBalance: user.baseCurrencyBalance })
					.from(user)
					.where(eq(user.id, userId))
					.for('update')
					.limit(1);

				const currentBalance = Number(userData.baseCurrencyBalance);
				const roundedBalance = Math.round(currentBalance * 100000000) / 100000000;

				if (roundedBet > roundedBalance) {
					throw new Error(
						`Insufficient funds. You need $${roundedBet.toFixed(2)} but only have $${roundedBalance.toFixed(2)}`
					);
				}

				const newBalance = roundedBalance - roundedBet;

				await tx
					.update(user)
					.set({
						baseCurrencyBalance: newBalance.toFixed(8),
						updatedAt: new Date()
					})
					.where(eq(user.id, userId));

				return {
					sessionToken,
					newBalance,
					number: shownNumber
				};
			});

			return json(result);
		} else if (action === 'end') {
			const sessionToken = body.sessionToken;

			const sessionRaw = await redis.get(`higherlower:session:${sessionToken}`);
			const game = sessionRaw ? JSON.parse(sessionRaw) : null;

			if (!game) {
				return json({ error: 'Invalid session' }, { status: 400 });
			}

			if (game.userId !== userId) {
				return json({ error: 'Unauthorized: Session belongs to another user' }, { status: 403 });
			}

			const deleted = await redis.del(`higherlower:session:${sessionToken}`);

			if (!deleted) {
				return json({ error: 'Session already processed' }, { status: 400 });
			}

			let payout: number = 0;
			let newBalance: number;
			let result: 'higher' | 'lower' | 'exact';

			if (game.hiddenNumber < game.shownNumber) {
				result = 'lower';
			} else if (game.hiddenNumber > game.shownNumber) {
				result = 'higher';
			} else {
				result = 'exact';
			}

			if (body.guess == result) {
				payout = game.betAmount * getPayout(game.shownNumber, result);
			}

			const dbResult = await db.transaction(async (tx) => {
				const [userData] = await tx
					.select({
						baseCurrencyBalance: user.baseCurrencyBalance,
						arcadeLosses: user.arcadeLosses,
						arcadeWins: user.arcadeWins,
						totalArcadeGamesPlayed: user.totalArcadeGamesPlayed,
						arcadeWinStreak: user.arcadeWinStreak,
						arcadeBestWinStreak: user.arcadeBestWinStreak,
						totalArcadeWagered: user.totalArcadeWagered
					})
					.from(user)
					.where(eq(user.id, userId))
					.for('update')
					.limit(1);

				const currentBalance = Number(userData.baseCurrencyBalance);
				const roundedPayout = Math.round(payout * 100000000) / 100000000;
				newBalance = Math.round((currentBalance + roundedPayout) * 100000000) / 100000000;

				// Calculate arcade stats
				const netResult = Math.round((roundedPayout - game.betAmount) * 100000000) / 100000000;
				const isWin = body.guess == result;

				const updateData: any = {
					baseCurrencyBalance: newBalance.toFixed(8),
					updatedAt: new Date()
				};

				if (isWin) {
					updateData.arcadeWins = `${Number(userData.arcadeWins || 0) + netResult}`;
					const newWinStreak = (userData.arcadeWinStreak || 0) + 1;
					updateData.arcadeWinStreak = newWinStreak;
					updateData.arcadeBestWinStreak = Math.max(
						newWinStreak,
						userData.arcadeBestWinStreak || 0
					);
				} else if (netResult < 0) {
					updateData.arcadeLosses = `${Number(userData.arcadeLosses || 0) + Math.abs(netResult)}`;
					updateData.arcadeWinStreak = 0;
				}
				updateData.totalArcadeGamesPlayed = (userData.totalArcadeGamesPlayed || 0) + 1;
				updateData.totalArcadeWagered = `${Number(userData.totalArcadeWagered || 0) + game.betAmount}`;

				await tx.update(user).set(updateData).where(eq(user.id, userId));

				return {
					won: isWin,
					number: game.shownNumber,
					hiddenNumber: game.hiddenNumber,
					result,
					newBalance,
					payout: roundedPayout,
					amountWagered: game.betAmount
				};
			});

			return json(dbResult);
		}

		return json({ error: 'Invalid action' }, { status: 400 });
	} catch (e) {
		if (e instanceof Error && e.message.startsWith('Insufficient funds')) {
			return json({ error: e.message }, { status: 400 });
		}

		if (typeof e === 'object' && e !== null && 'status' in e) {
			throw e;
		}

		console.error('HigherLower API error:', e);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
