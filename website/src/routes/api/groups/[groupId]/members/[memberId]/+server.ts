import { auth } from '$lib/auth';
import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { groups, groupMember } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';

async function getRole(groupId: number, userId: number): Promise<string | null> {
	const [m] = await db
		.select({ role: groupMember.role })
		.from(groupMember)
		.where(and(eq(groupMember.groupId, groupId), eq(groupMember.userId, userId)))
		.limit(1);
	return m?.role ?? null;
}

export async function PATCH({ params, request }) {
	const groupId = parseInt(params.groupId);
	const targetId = parseInt(params.memberId);
	if (isNaN(groupId) || isNaN(targetId)) throw error(400, 'Invalid ID');

	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) throw error(401, 'Not authenticated');
	const userId = Number(session.user.id);

	if (userId === targetId) throw error(400, 'Cannot change your own role');

	const actorRole = await getRole(groupId, userId);
	if (!actorRole || (actorRole !== 'owner' && actorRole !== 'admin')) {
		throw error(403, 'Only admins and owners can change roles');
	}

	const targetRole = await getRole(groupId, targetId);
	if (!targetRole) throw error(404, 'Target user is not a member');
	if (targetRole === 'owner') throw error(403, 'Cannot change owner role');

	const body = await request.json();
	const newRole = body.role;

	if (!['admin', 'member'].includes(newRole)) {
		throw error(400, 'Role must be admin or member');
	}

	if (actorRole === 'admin' && newRole === 'admin') {
		throw error(403, 'Admins cannot promote others to admin');
	}

	await db
		.update(groupMember)
		.set({ role: newRole })
		.where(and(eq(groupMember.groupId, groupId), eq(groupMember.userId, targetId)));

	return json({ success: true, newRole });
}

export async function DELETE({ params, request }) {
	const groupId = parseInt(params.groupId);
	const targetId = parseInt(params.memberId);
	if (isNaN(groupId) || isNaN(targetId)) throw error(400, 'Invalid ID');

	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) throw error(401, 'Not authenticated');
	const userId = Number(session.user.id);

	if (userId === targetId) throw error(400, 'Use the leave endpoint to leave a group');

	const actorRole = await getRole(groupId, userId);
	if (!actorRole || (actorRole !== 'owner' && actorRole !== 'admin')) {
		throw error(403, 'Only admins and owners can kick members');
	}

	const targetRole = await getRole(groupId, targetId);
	if (!targetRole) throw error(404, 'Target user is not a member');
	if (targetRole === 'owner') throw error(403, 'Cannot kick the group owner');
	if (targetRole === 'admin' && actorRole !== 'owner') {
		throw error(403, 'Only the owner can kick admins');
	}

	await db.transaction(async (tx) => {
		await tx
			.delete(groupMember)
			.where(and(eq(groupMember.groupId, groupId), eq(groupMember.userId, targetId)));
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
