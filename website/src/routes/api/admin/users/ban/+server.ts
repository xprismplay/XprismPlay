import { auth } from '$lib/auth';
import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { user, session } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { writeAdminLog } from '$lib/server/admin-log';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	const authSession = await auth.api.getSession({ headers: request.headers });

	if (!authSession?.user) {
		throw error(401, 'Not authenticated');
	}

	const [currentUser] = await db
		.select({ isAdmin: user.isAdmin, isHeadAdmin: user.isHeadAdmin })
		.from(user)
		.where(eq(user.id, Number(authSession.user.id)))
		.limit(1);

	if (!currentUser?.isAdmin) {
		throw error(403, 'Admin access required');
	}

	const { username, reason } = await request.json();

	if (!username?.trim() || !reason?.trim()) {
		throw error(400, 'Username and reason are required');
	}

	try {
		// 2. Fetch the target user's details, including head admin status
		const [targetUser] = await db
			.select({ 
				id: user.id, 
				username: user.username, 
				isAdmin: user.isAdmin, 
				isHeadAdmin: user.isHeadAdmin 
			})
			.from(user)
			.where(eq(user.username, username.trim()))
			.limit(1);

		if (!targetUser) {
			throw error(404, 'User not found');
		}

		// 3. New Permissions Logic
		if (targetUser.isHeadAdmin) {
			throw error(400, 'Cannot ban head admin users');
		}

		if (targetUser.isAdmin && !currentUser.isHeadAdmin) {
			throw error(403, 'Only head admins can ban other admin users');
		}

		await db.transaction(async (tx) => {
			await tx
				.update(user)
				.set({
					isBanned: true,
					banReason: reason.trim(),
					isAdmin: false, // <-- Automatically strips admin status on ban
					updatedAt: new Date()
				})
				.where(eq(user.id, targetUser.id));

			await tx.delete(session).where(eq(session.userId, targetUser.id));
		});

		try {
			const { clearUserCache } = await import('$lib/../hooks.server.js');
			clearUserCache(targetUser.id.toString());
		} catch (e) {
			console.warn('Failed to clear user cache:', e);
		}

		writeAdminLog(Number(authSession.user.id), 'BAN', targetUser.id, `Reason: ${reason.trim()}`);

		return json({ success: true });
	} catch (e: any) {
		if (e.status) throw e;
		console.error('Failed to ban user:', e);
		throw error(500, 'Internal server error');
	}
};