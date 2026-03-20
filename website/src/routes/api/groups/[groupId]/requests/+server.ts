import { auth } from '$lib/auth';
import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { groups, groupMember, groupJoinRequest, user } from '$lib/server/db/schema';
import { eq, and, count } from 'drizzle-orm';

const MAX_JOINED = 10;

async function getRole(groupId: number, userId: number): Promise<string | null> {
	const [m] = await db
		.select({ role: groupMember.role })
		.from(groupMember)
		.where(and(eq(groupMember.groupId, groupId), eq(groupMember.userId, userId)))
		.limit(1);
	return m?.role ?? null;
}

export async function GET({ params, request }) {
	const groupId = parseInt(params.groupId);
	if (isNaN(groupId)) throw error(400, 'Invalid group ID');

	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) throw error(401, 'Not authenticated');
	const userId = Number(session.user.id);

	const role = await getRole(groupId, userId);
	if (!role || (role !== 'owner' && role !== 'admin')) {
		throw error(403, 'Only admins and owners can view join requests');
	}

	const requests = await db
		.select({
			id: groupJoinRequest.id,
			userId: groupJoinRequest.userId,
			createdAt: groupJoinRequest.createdAt,
			username: user.username,
			name: user.name,
			image: user.image
		})
		.from(groupJoinRequest)
		.innerJoin(user, eq(groupJoinRequest.userId, user.id))
		.where(eq(groupJoinRequest.groupId, groupId))
		.orderBy(groupJoinRequest.createdAt);

	return json({ requests });
}

export async function POST({ params, request }) {
	const groupId = parseInt(params.groupId);
	if (isNaN(groupId)) throw error(400, 'Invalid group ID');

	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) throw error(401, 'Not authenticated');
	const userId = Number(session.user.id);

	const role = await getRole(groupId, userId);
	if (!role || (role !== 'owner' && role !== 'admin')) {
		throw error(403, 'Only admins and owners can manage join requests');
	}

	const body = await request.json();
	const requestId = parseInt(body.requestId);
	const action = body.action;

	if (isNaN(requestId)) throw error(400, 'Invalid request ID');
	if (!['accept', 'deny'].includes(action)) throw error(400, 'Action must be accept or deny');

	const [req] = await db
		.select()
		.from(groupJoinRequest)
		.where(and(eq(groupJoinRequest.id, requestId), eq(groupJoinRequest.groupId, groupId)))
		.limit(1);

	if (!req) throw error(404, 'Join request not found');

	if (action === 'deny') {
		await db.delete(groupJoinRequest).where(eq(groupJoinRequest.id, requestId));
		return json({ denied: true });
	}

	return await db.transaction(async (tx) => {
		const [joinedRow] = await tx
			.select({ c: count() })
			.from(groupMember)
			.where(eq(groupMember.userId, req.userId));

		if (Number(joinedRow.c) >= MAX_JOINED) {
			await tx.delete(groupJoinRequest).where(eq(groupJoinRequest.id, requestId));
			throw error(400, 'User has reached the maximum number of groups');
		}

		const [existing] = await tx
			.select({ role: groupMember.role })
			.from(groupMember)
			.where(and(eq(groupMember.groupId, groupId), eq(groupMember.userId, req.userId)))
			.limit(1);

		if (existing) {
			await tx.delete(groupJoinRequest).where(eq(groupJoinRequest.id, requestId));
			return json({ accepted: true, alreadyMember: true });
		}

		await tx.insert(groupMember).values({ groupId, userId: req.userId, role: 'member' });

		const [g] = await tx
			.select({ memberCount: groups.memberCount })
			.from(groups)
			.where(eq(groups.id, groupId))
			.for('update')
			.limit(1);

		if (g) {
			await tx
				.update(groups)
				.set({ memberCount: g.memberCount + 1 })
				.where(eq(groups.id, groupId));
		}

		await tx.delete(groupJoinRequest).where(eq(groupJoinRequest.id, requestId));

		return json({ accepted: true });
	});
}
