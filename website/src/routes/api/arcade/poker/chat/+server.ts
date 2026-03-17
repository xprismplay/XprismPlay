import { auth } from '$lib/auth';
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema';
import { loadLobby } from '$lib/server/games/poker';
import { redis } from '$lib/server/redis';
import { eq } from 'drizzle-orm';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const CHAT_LIMIT = 50;

interface PokerChatMessage {
	id: string;
	lobbyId: string;
	userId: number;
	username: string;
	image: string | null;
	text: string;
	timestamp: number;
}

function chatKey(lobbyId: string): string {
	return `poker:chat:${lobbyId}`;
}

export const GET: RequestHandler = async ({ request, url }) => {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) throw error(401, 'Not authenticated');

	const lobbyId = url.searchParams.get('lobbyId');
	if (!lobbyId) {
		return json({ error: 'lobbyId is required' }, { status: 400 });
	}

	const lobby = await loadLobby(lobbyId);
	if (!lobby) {
		return json({ error: 'Lobby not found' }, { status: 404 });
	}

	const raw = await redis.lRange(chatKey(lobbyId), -CHAT_LIMIT, -1);
	const messages = raw.map((line) => JSON.parse(line) as PokerChatMessage);

	return json({ messages });
};

export const POST: RequestHandler = async ({ request }) => {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) throw error(401, 'Not authenticated');

	try {
		const body = await request.json();
		const lobbyId = String(body.lobbyId ?? '');
		const text = String(body.text ?? '').trim();
		const userId = Number(session.user.id);

		if (!lobbyId) {
			return json({ error: 'lobbyId is required' }, { status: 400 });
		}
		if (!text) {
			return json({ error: 'Message cannot be empty' }, { status: 400 });
		}
		if (text.length > 240) {
			return json({ error: 'Message too long (max 240 chars)' }, { status: 400 });
		}

		const lobby = await loadLobby(lobbyId);
		if (!lobby) {
			return json({ error: 'Lobby not found' }, { status: 404 });
		}

		const [author] = await db
			.select({ username: user.username, image: user.image })
			.from(user)
			.where(eq(user.id, userId))
			.limit(1);

		if (!author) {
			return json({ error: 'User not found' }, { status: 404 });
		}

		const msg: PokerChatMessage = {
			id: crypto.randomUUID(),
			lobbyId,
			userId,
			username: author.username,
			image: author.image,
			text,
			timestamp: Date.now()
		};

		await redis.rPush(chatKey(lobbyId), JSON.stringify(msg));
		await redis.lTrim(chatKey(lobbyId), -CHAT_LIMIT, -1);
		await redis.publish(`poker:chat:${lobbyId}`, JSON.stringify({ type: 'poker_chat', lobbyId, message: msg }));

		return json({ message: msg });
	} catch (e) {
		console.error('Poker chat POST error:', e);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
