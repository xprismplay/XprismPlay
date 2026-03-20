import { auth } from '$lib/auth';
import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { groups, groupMember, groupJoinRequest, user } from '$lib/server/db/schema';
import { eq, and, count } from 'drizzle-orm';

const MAX_JOINED = 10;

async function getGroup(groupId: number) {
	const [g] = await db.select().from(groups).where(eq(groups.id, groupId)).limit(1);
	return g;
}

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
	const userId = session?.user ? Number(session.user.id) : null;

	const group = await getGroup(groupId);
	if (!group) throw error(404, 'Group not found');

	const memberRole = userId ? await getRole(groupId, userId) : null;
	if (!group.isPublic && !memberRole) throw error(403, 'This group is private');

	const members = await db
		.select({
			userId: groupMember.userId,
			role: groupMember.role,
			joinedAt: groupMember.joinedAt,
			username: user.username,
			name: user.name,
			image: user.image
		})
		.from(groupMember)
		.innerJoin(user, eq(groupMember.userId, user.id))
		.where(eq(groupMember.groupId, groupId))
		.orderBy(groupMember.joinedAt);

	return json({ members, memberRole });
}

export async function POST({ params, request }) {
	const groupId = parseInt(params.groupId);
	if (isNaN(groupId)) throw error(400, 'Invalid group ID');

	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) throw error(401, 'Not authenticated');
	const userId = Number(session.user.id);

	const group = await getGroup(groupId);
	if (!group) throw error(404, 'Group not found');

	const existingRole = await getRole(groupId, userId);
	if (existingRole) throw error(400, 'You are already a member of this group');

	const [existingRequest] = await db
		.select({ id: groupJoinRequest.id })
		.from(groupJoinRequest)
		.where(and(eq(groupJoinRequest.groupId, groupId), eq(groupJoinRequest.userId, userId)))
		.limit(1);

	if (existingRequest) throw error(400, 'You already have a pending join request');

	return await db.transaction(async (tx) => {
		const [joinedRow] = await tx
			.select({ c: count() })
			.from(groupMember)
			.where(eq(groupMember.userId, userId));

		if (Number(joinedRow.c) >= MAX_JOINED) {
			throw error(400, `You can only be in ${MAX_JOINED} groups`);
		}

		if (group.isPublic) {
			await tx.insert(groupMember).values({ groupId, userId, role: 'member' });
			await tx
				.update(groups)
				.set({ memberCount: group.memberCount + 1 })
				.where(eq(groups.id, groupId));
			return json({ joined: true });
		} else {
			await tx.insert(groupJoinRequest).values({ groupId, userId });
			return json({ requested: true });
		}
	});
}

export async function DELETE({ params, request }) {
	const groupId = parseInt(params.groupId);
	if (isNaN(groupId)) throw error(400, 'Invalid group ID');

	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) throw error(401, 'Not authenticated');
	const userId = Number(session.user.id);

	const role = await getRole(groupId, userId);
	if (!role) throw error(400, 'You are not a member of this group');
	if (role === 'owner') throw error(400, 'Owner cannot leave. Delete the group instead');

	await db.transaction(async (tx) => {
		await tx
			.delete(groupMember)
			.where(and(eq(groupMember.groupId, groupId), eq(groupMember.userId, userId)));
		const [g] = await tx
			.select({ memberCount: groups.memberCount })
			.from(groups)
			.where(eq(groups.id, groupId))
			.for('update')
			.limit(1);
		if (g) {
			await tx
				.update(groups)
				.set({ memberCount: Math.max(0, g.memberCount - 1) })
				.where(eq(groups.id, groupId));
		}
	});

	return json({ success: true });
}
