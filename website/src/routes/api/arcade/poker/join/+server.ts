import { auth } from '$lib/auth';
import { error, json } from '@sveltejs/kit';
import { findPrivateLobbyByCode, joinLobby, loadLobby, sanitizeLobbyForUser } from '$lib/server/games/poker';
import { debitUserForPokerBuyIn, refundUserPokerBuyIn } from '$lib/server/games/poker-finance';
import { validateBetAmount } from '$lib/utils';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) throw error(401, 'Not authenticated');

	try {
		const body = await request.json();
		const userId = Number(session.user.id);

		let lobbyId = body.lobbyId ? String(body.lobbyId) : '';
		if (!lobbyId && body.privateCode) {
			const privateLobby = await findPrivateLobbyByCode(String(body.privateCode).toUpperCase());
			if (!privateLobby) {
				return json({ error: 'Invalid private code' }, { status: 404 });
			}
			lobbyId = privateLobby.lobbyId;
		}

		if (!lobbyId) {
			return json({ error: 'lobbyId or privateCode is required' }, { status: 400 });
		}

		const lobby = await loadLobby(lobbyId);
		if (!lobby) {
			return json({ error: 'Lobby not found' }, { status: 404 });
		}

		const minBuyIn = Number((lobby.minBuyInChips / 100000000).toFixed(8));
		const maxBuyIn = Number((lobby.maxBuyInChips / 100000000).toFixed(8));
		const buyInAmount = validateBetAmount(body.buyInAmount ?? minBuyIn, minBuyIn, maxBuyIn);

		const userInfo = await debitUserForPokerBuyIn(userId, buyInAmount);

		try {
			const joined = await joinLobby(lobbyId, {
				userId,
				username: userInfo.username,
				image: userInfo.image
			}, buyInAmount);

			return json({
				lobbyId: joined.lobbyId,
				privateCode: joined.privateCode,
				state: sanitizeLobbyForUser(joined, userId),
				newBalance: userInfo.newBalance
			});
		} catch (joinError) {
			await refundUserPokerBuyIn(userId, buyInAmount);
			throw joinError;
		}
	} catch (e) {
		console.error('Poker join error:', e);
		if (e instanceof Error && e.message.includes('Insufficient funds')) {
			return json({ error: e.message }, { status: 400 });
		}
		return json({ error: e instanceof Error ? e.message : 'Internal server error' }, { status: 500 });
	}
};

