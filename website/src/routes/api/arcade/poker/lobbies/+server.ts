import { json } from '@sveltejs/kit';
import { listPublicLobbies } from '$lib/server/games/poker';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	try {
		const lobbies = await listPublicLobbies();
		return json({ lobbies });
	} catch (error) {
		console.error('Poker lobbies error:', error);
		return json({ error: 'Failed to fetch poker lobbies' }, { status: 500 });
	}
};

