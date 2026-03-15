import { auth } from '$lib/auth';
import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema';
import { eq, sql } from 'drizzle-orm';
import { writeAdminLog } from '$lib/server/admin-log';
import type { RequestHandler } from '@sveltejs/kit'; // <-- Changed this import
import { hasFlag, UserFlags } from '$lib/data/flags';

export const POST: RequestHandler = async ({ request }) => {
	const authSession = await auth.api.getSession({ headers: request.headers });

	if (!authSession?.user) {
		throw error(401, 'Not authenticated');
	}

	// 1. Verify the requester is actually a Head Admin
	const [currentUser] = await db
		.select({ flags: user.flags })
		.from(user)
		.where(eq(user.id, Number(authSession.user.id)))
		.limit(1);

	if (!hasFlag(currentUser.flags, 'IS_HEAD_ADMIN')) {
		throw error(403, 'Head Admin access required');
	}

	const { username, makeAdmin } = await request.json();

	if (!username?.trim() || makeAdmin === undefined) {
		throw error(400, 'Username and action are required');
	}

	try {
		// 2. Fetch the target user's details
		const [targetUser] = await db
			.select({
				id: user.id,
				username: user.username,
				flags: user.flags
			})
			.from(user)
			.where(eq(user.username, username.trim()))
			.limit(1);

		if (!targetUser) {
			throw error(404, 'User not found');
		}

		// 3. Prevent touching other Head Admins
		if (hasFlag(targetUser.flags, 'IS_HEAD_ADMIN')) {
			throw error(400, 'Cannot modify permissions of a Head Admin');
		}

		// 4. Update the user
		await db
			.update(user)
			.set({
				flags: makeAdmin
					? sql`${targetUser.flags} | ${UserFlags.IS_ADMIN}`
					: sql`${targetUser.flags} & ~${UserFlags.IS_ADMIN}`,
				updatedAt: new Date()
			})
			.where(eq(user.id, targetUser.id));

		// 5. Clear their cache so the badge updates instantly
		try {
			const { clearUserCache } = await import('$lib/../hooks.server.js');
			clearUserCache(targetUser.id.toString());
		} catch (e) {
			console.warn('Failed to clear user cache:', e);
		}

		// 6. Log the action
		writeAdminLog(
			Number(authSession.user.id),
			'TOGGLE_ADMIN',
			targetUser.id,
			`Set isAdmin to: ${makeAdmin}`
		);

		return json({
			success: true,
			message: `User @${targetUser.username} is ${makeAdmin ? 'now an Admin' : 'no longer an Admin'}.`
		});
	} catch (e: any) {
		if (e.status) throw e;
		console.error('Failed to toggle admin status:', e);
		throw error(500, 'Internal server error');
	}
};
