import { auth } from '$lib/auth';
import { error, json } from '@sveltejs/kit';
import { createPokerLobby, joinLobby, sanitizeLobbyForUser } from '$lib/server/games/poker';
import { debitUserForPokerBuyIn, refundUserPokerBuyIn } from '$lib/server/games/poker-finance';
import { validateBetAmount } from '$lib/utils';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) throw error(401, 'Not authenticated');

	try {
		const body = await request.json();
		const userId = Number(session.user.id);

		const maxPlayers = Number(body.maxPlayers ?? 6);
		const smallBlind = Number(body.smallBlind ?? 5);
		const bigBlind = Number(body.bigBlind ?? 10);
		const minBuyIn = Number(body.minBuyIn ?? bigBlind * 50);
		const maxBuyIn = Number(body.maxBuyIn ?? bigBlind * 300);
		const buyInAmount = validateBetAmount(body.buyInAmount ?? minBuyIn, minBuyIn, maxBuyIn);

		if (![2, 6, 9].includes(maxPlayers)) {
			return json({ error: 'maxPlayers must be 2, 6, or 9' }, { status: 400 });
		}
		if (smallBlind <= 0 || bigBlind <= 0 || smallBlind >= bigBlind) {
			return json({ error: 'Invalid blind structure' }, { status: 400 });
		}
		if (minBuyIn <= 0 || maxBuyIn < minBuyIn) {
			return json({ error: 'Invalid buy-in limits' }, { status: 400 });
		}

		const lobby = await createPokerLobby({
			isPrivate: true,
			maxPlayers,
			smallBlind,
			bigBlind,
			minBuyIn,
			maxBuyIn
		});

		const userInfo = await debitUserForPokerBuyIn(userId, buyInAmount);

		try {
			const joined = await joinLobby(lobby.lobbyId, {
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
		console.error('Create private poker lobby error:', e);
		if (e instanceof Error && e.message.includes('Insufficient funds')) {
			return json({ error: e.message }, { status: 400 });
		}
		return json({ error: e instanceof Error ? e.message : 'Internal server error' }, { status: 500 });
	}
};

