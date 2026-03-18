import { auth } from '$lib/auth';
import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { groups, groupMember, groupTreasuryTx, user } from '$lib/server/db/schema';
import { eq, and, desc } from 'drizzle-orm';

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
	if (!role) throw error(403, 'Members only');

	const [group] = await db
		.select({ treasuryBalance: groups.treasuryBalance })
		.from(groups)
		.where(eq(groups.id, groupId))
		.limit(1);

	if (!group) throw error(404, 'Group not found');

	const transactions = await db
		.select({
			id: groupTreasuryTx.id,
			type: groupTreasuryTx.type,
			amount: groupTreasuryTx.amount,
			note: groupTreasuryTx.note,
			createdAt: groupTreasuryTx.createdAt,
			userId: groupTreasuryTx.userId,
			username: user.username,
			userName: user.name
		})
		.from(groupTreasuryTx)
		.leftJoin(user, eq(groupTreasuryTx.userId, user.id))
		.where(eq(groupTreasuryTx.groupId, groupId))
		.orderBy(desc(groupTreasuryTx.createdAt))
		.limit(50);

	return json({ treasuryBalance: group.treasuryBalance, transactions });
}

export async function POST({ params, request }) {
	const groupId = parseInt(params.groupId);
	if (isNaN(groupId)) throw error(400, 'Invalid group ID');

	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) throw error(401, 'Not authenticated');
	const userId = Number(session.user.id);

	const role = await getRole(groupId, userId);
	if (!role) throw error(403, 'Members only');

	const body = await request.json();
	const type = body.type;
	const amount = Number(body.amount);
	const note = typeof body.note === 'string' ? body.note.trim().slice(0, 200) : null;

	if (!['deposit', 'withdraw'].includes(type)) throw error(400, 'Type must be deposit or withdraw');
	if (!amount || !isFinite(amount) || amount <= 0) throw error(400, 'Invalid amount');
	if (amount > 1_000_000_000) throw error(400, 'Amount too large');

	if (type === 'withdraw' && role !== 'owner' && role !== 'admin') {
		throw error(403, 'Only admins and owners can withdraw');
	}

	return await db.transaction(async (tx) => {
		const [userData] = await tx
			.select({ baseCurrencyBalance: user.baseCurrencyBalance })
			.from(user)
			.where(eq(user.id, userId))
			.for('update')
			.limit(1);

		if (!userData) throw error(404, 'User not found');

		const [groupData] = await tx
			.select({ treasuryBalance: groups.treasuryBalance })
			.from(groups)
			.where(eq(groups.id, groupId))
			.for('update')
			.limit(1);

		if (!groupData) throw error(404, 'Group not found');

		const userBal = Number(userData.baseCurrencyBalance);
		const treasury = Number(groupData.treasuryBalance);

		if (type === 'deposit') {
			const rounded = Math.round(amount * 100000000) / 100000000;
			if (userBal < rounded) throw error(400, 'Insufficient balance');

			await tx
				.update(user)
				.set({ baseCurrencyBalance: (userBal - rounded).toFixed(8), updatedAt: new Date() })
				.where(eq(user.id, userId));

			await tx
				.update(groups)
				.set({ treasuryBalance: (treasury + rounded).toFixed(8) })
				.where(eq(groups.id, groupId));

			await tx.insert(groupTreasuryTx).values({
				groupId,
				userId,
				type: 'deposit',
				amount: rounded.toFixed(8),
				note
			});

			return json({ newTreasuryBalance: (treasury + rounded).toFixed(8), newUserBalance: (userBal - rounded).toFixed(8) });
		} else {
			const rounded = Math.round(amount * 100000000) / 100000000;
			if (treasury < rounded) throw error(400, 'Insufficient treasury balance');

			await tx
				.update(groups)
				.set({ treasuryBalance: (treasury - rounded).toFixed(8) })
				.where(eq(groups.id, groupId));

			await tx
				.update(user)
				.set({ baseCurrencyBalance: (userBal + rounded).toFixed(8), updatedAt: new Date() })
				.where(eq(user.id, userId));

			await tx.insert(groupTreasuryTx).values({
				groupId,
				userId,
				type: 'withdraw',
				amount: rounded.toFixed(8),
				note
			});

			return json({ newTreasuryBalance: (treasury - rounded).toFixed(8), newUserBalance: (userBal + rounded).toFixed(8) });
		}
	});
}