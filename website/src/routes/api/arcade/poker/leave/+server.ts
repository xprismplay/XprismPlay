import { auth } from '$lib/auth';
import { error, json } from '@sveltejs/kit';
import { leaveLobby, sanitizeLobbyForUser } from '$lib/server/games/poker';
import { settlePokerCashout } from '$lib/server/games/poker-finance';
import { checkAndAwardAchievements } from '$lib/server/achievements';
import { publishArcadeActivity } from '$lib/server/arcade-activity';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) throw error(401, 'Not authenticated');

	try {
		const { lobbyId } = await request.json();
		if (!lobbyId) {
			return json({ error: 'lobbyId is required' }, { status: 400 });
		}

		const userId = Number(session.user.id);
		const leave = await leaveLobby(String(lobbyId), userId);
		const newBalance = await settlePokerCashout(userId, leave.payoutAmount, leave.totalBuyInAmount);

		await checkAndAwardAchievements(userId, ['arcade', 'wealth'], {
			arcadeWon: leave.netAmount > 0,
			arcadeWager: leave.totalBuyInAmount
		});

		await publishArcadeActivity(
			userId,
			Math.max(leave.totalBuyInAmount, Math.abs(leave.netAmount)),
			leave.netAmount > 0,
			'poker'
		);

		return json({
			lobbyId,
			newBalance,
			payoutAmount: leave.payoutAmount,
			totalBuyInAmount: leave.totalBuyInAmount,
			netAmount: leave.netAmount,
			state: sanitizeLobbyForUser(leave.lobby, userId)
		});
	} catch (e) {
		console.error('Poker leave error:', e);
		return json({ error: e instanceof Error ? e.message : 'Internal server error' }, { status: 500 });
	}
};

