import { auth } from '$lib/auth';
import { error, json } from '@sveltejs/kit';
import { performAction, sanitizeLobbyForUser, type PokerActionType } from '$lib/server/games/poker';
import type { RequestHandler } from './$types';

const allowedActions: PokerActionType[] = ['fold', 'check', 'call', 'raise', 'all_in'];

export const POST: RequestHandler = async ({ request }) => {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) throw error(401, 'Not authenticated');

	try {
		const body = await request.json();
		const userId = Number(session.user.id);
		const lobbyId = String(body.lobbyId ?? '');
		const action = body.action as PokerActionType;
		const amount = typeof body.amount === 'number' ? body.amount : undefined;

		if (!lobbyId) {
			return json({ error: 'lobbyId is required' }, { status: 400 });
		}
		if (!allowedActions.includes(action)) {
			return json({ error: 'Invalid action' }, { status: 400 });
		}

		const lobby = await performAction(lobbyId, userId, action, amount);
		return json({ state: sanitizeLobbyForUser(lobby, userId) });
	} catch (e) {
		console.error('Poker action error:', e);
		return json({ error: e instanceof Error ? e.message : 'Internal server error' }, { status: 400 });
	}
};

