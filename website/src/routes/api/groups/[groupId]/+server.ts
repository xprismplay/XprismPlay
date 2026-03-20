import { auth } from '$lib/auth';
import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { groups, groupMember, user } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';

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

	const [group] = await db
		.select({
			id: groups.id,
			name: groups.name,
			description: groups.description,
			icon: groups.icon,
			isPublic: groups.isPublic,
			memberCount: groups.memberCount,
			treasuryBalance: groups.treasuryBalance,
			createdAt: groups.createdAt,
			ownerId: groups.ownerId,
			ownerUsername: user.username,
			ownerName: user.name,
			ownerImage: user.image
		})
		.from(groups)
		.leftJoin(user, eq(groups.ownerId, user.id))
		.where(eq(groups.id, groupId))
		.limit(1);

	if (!group) throw error(404, 'Group not found');

	const memberRole = userId ? await getRole(groupId, userId) : null;

	if (!group.isPublic && !memberRole) throw error(403, 'This group is private');

	return json({ ...group, memberRole });
}

export async function PATCH({ params, request }) {
	const groupId = parseInt(params.groupId);
	if (isNaN(groupId)) throw error(400, 'Invalid group ID');

	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) throw error(401, 'Not authenticated');
	const userId = Number(session.user.id);

	const role = await getRole(groupId, userId);
	if (role !== 'owner') throw error(403, 'Only the group owner can update settings');

	const body = await request.json();
	const updates: Record<string, unknown> = {};

	if (body.description !== undefined) {
		const desc = typeof body.description === 'string' ? body.description.trim() : '';
		if (desc.length > 500) throw error(400, 'Description too long');
		updates.description = desc || null;
	}
	if (body.isPublic !== undefined) updates.isPublic = Boolean(body.isPublic);

	if (Object.keys(updates).length === 0) throw error(400, 'No valid fields provided');

	const [updated] = await db.update(groups).set(updates).where(eq(groups.id, groupId)).returning();

	return json({ group: updated });
}

export async function DELETE({ params, request }) {
	const groupId = parseInt(params.groupId);
	if (isNaN(groupId)) throw error(400, 'Invalid group ID');

	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) throw error(401, 'Not authenticated');
	const userId = Number(session.user.id);

	const role = await getRole(groupId, userId);
	if (role !== 'owner') throw error(403, 'Only the group owner can delete it');

	const [group] = await db
		.select({ treasuryBalance: groups.treasuryBalance, ownerId: groups.ownerId })
		.from(groups)
		.where(eq(groups.id, groupId))
		.limit(1);

	if (!group) throw error(404, 'Group not found');

	await db.transaction(async (tx) => {
		const treasury = Number(group.treasuryBalance);
		if (treasury > 0 && group.ownerId) {
			const [ownerData] = await tx
				.select({ baseCurrencyBalance: user.baseCurrencyBalance })
				.from(user)
				.where(eq(user.id, group.ownerId))
				.for('update')
				.limit(1);
			if (ownerData) {
				const newBal = Number(ownerData.baseCurrencyBalance) + treasury;
				await tx
					.update(user)
					.set({ baseCurrencyBalance: newBal.toFixed(8), updatedAt: new Date() })
					.where(eq(user.id, group.ownerId));
			}
		}
		await tx.delete(groups).where(eq(groups.id, groupId));
	});

	return json({ success: true });
}
