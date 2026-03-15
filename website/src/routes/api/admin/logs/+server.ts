import { auth } from '$lib/auth';
import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { adminLog, user } from '$lib/server/db/schema';
import { desc, eq } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { RequestHandler } from './$types';
import { hasFlag } from '$lib/data/flags';

export const GET: RequestHandler = async ({ request, url }) => {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) throw error(401, 'Not authenticated');

	const [currentUser] = await db
		.select({ flags: user.flags })
		.from(user)
		.where(eq(user.id, Number(session.user.id)))
		.limit(1);

	if (!hasFlag(currentUser.flags, 'IS_ADMIN', 'IS_HEAD_ADMIN'))
		throw error(403, 'Admin access required');

	const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 200);
	const offset = Math.max(parseInt(url.searchParams.get('offset') || '0'), 0);

	const adminUser = alias(user, 'adminUser');
	const targetUser = alias(user, 'targetUser');

	const logs = await db
		.select({
			id: adminLog.id,
			action: adminLog.action,
			details: adminLog.details,
			createdAt: adminLog.createdAt,
			adminId: adminLog.adminId,
			adminUsername: adminUser.username,
			targetUserId: adminLog.targetUserId,
			targetUsername: targetUser.username
		})
		.from(adminLog)
		.innerJoin(adminUser, eq(adminLog.adminId, adminUser.id))
		.leftJoin(targetUser, eq(adminLog.targetUserId, targetUser.id))
		.orderBy(desc(adminLog.createdAt))
		.limit(limit)
		.offset(offset);

	return json({
		logs: logs.map((l) => ({
			...l,
			createdAt: l.createdAt.getTime()
		}))
	});
};
