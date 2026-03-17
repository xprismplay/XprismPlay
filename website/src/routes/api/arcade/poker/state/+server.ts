import { auth } from '$lib/auth';
import { error, json } from '@sveltejs/kit';
import { findPrivateLobbyByCode, loadLobby, sanitizeLobbyForUser } from '$lib/server/games/poker';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ request, url }) => {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) throw error(401, 'Not authenticated');

	try {
		const userId = Number(session.user.id);
		let lobbyId = url.searchParams.get('lobbyId') || '';
		const privateCode = url.searchParams.get('privateCode');

		if (!lobbyId && privateCode) {
			const lobby = await findPrivateLobbyByCode(privateCode.toUpperCase());
			if (!lobby) {
				return json({ error: 'Private lobby not found' }, { status: 404 });
			}
			lobbyId = lobby.lobbyId;
		}

		if (!lobbyId) {
			return json({ error: 'lobbyId or privateCode is required' }, { status: 400 });
		}

		const lobby = await loadLobby(lobbyId);
		if (!lobby) {
			return json({ error: 'Lobby not found' }, { status: 404 });
		}

		return json({ state: sanitizeLobbyForUser(lobby, userId) });
	} catch (e) {
		console.error('Poker state error:', e);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};

