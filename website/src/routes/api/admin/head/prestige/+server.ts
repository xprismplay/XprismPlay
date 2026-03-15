// src/routes/api/admin/head/prestige/+server.ts
import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { auth } from '$lib/auth';
import type { RequestHandler } from '@sveltejs/kit'; // <-- Changed this import
import { getMaxPrestigeLevel } from '$lib/utils';
import { hasFlag } from '$lib/data/flags';

export const POST: RequestHandler = async ({ request }) => {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) {
		return json({ message: 'Unauthorized' }, { status: 401 });
	}

	const [currentUser] = await db
		.select({ flags: user.flags })
		.from(user)
		.where(eq(user.id, Number(session.user.id)))
		.limit(1);

	if (!hasFlag(currentUser.flags, 'IS_HEAD_ADMIN')) {
		return json({ message: 'Forbidden: Head Admin access required' }, { status: 403 });
	}

	const body = await request.json();
	const { username, level } = body;

	if (
		!username ||
		typeof level !== 'number' ||
		isNaN(level) ||
		level < 0 ||
		level > getMaxPrestigeLevel()
	) {
		return json(
			{
				message: `Invalid input. Provide a username and a valid prestige level (>= 0 and <= ${getMaxPrestigeLevel()})`
			},
			{ status: 400 }
		);
	}

	const [targetUser] = await db
		.select({ id: user.id })
		.from(user)
		.where(eq(user.username, username))
		.limit(1);

	if (!targetUser) {
		return json({ message: `User "${username}" not found.` }, { status: 404 });
	}

	try {
		await db.update(user).set({ prestigeLevel: level }).where(eq(user.id, targetUser.id));

		return json({ message: `Successfully updated ${username}'s prestige to level ${level}.` });
	} catch (error) {
		console.error('Failed to update prestige:', error);
		return json({ message: 'Database error while updating prestige.' }, { status: 500 });
	}
};
