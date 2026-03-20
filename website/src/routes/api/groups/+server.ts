import { auth } from '$lib/auth';
import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { groups, groupMember, user } from '$lib/server/db/schema';
import { eq, desc, count, ilike, and } from 'drizzle-orm';

const MAX_OWNED = 2;
const MAX_JOINED = 10;
const CREATION_COST = 500;

export async function GET({ url, request }) {
	const session = await auth.api.getSession({ headers: request.headers });
	const userId = session?.user ? Number(session.user.id) : null;
	const mine = url.searchParams.get('mine') === 'true';
	const search = url.searchParams.get('search') || '';
	const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
	const limit = 12;

	if (mine) {
		if (!userId) throw error(401, 'Not authenticated');
		const myGroups = await db
			.select({
				id: groups.id,
				name: groups.name,
				description: groups.description,
				icon: groups.icon,
				isPublic: groups.isPublic,
				memberCount: groups.memberCount,
				treasuryBalance: groups.treasuryBalance,
				createdAt: groups.createdAt,
				role: groupMember.role,
				ownerId: groups.ownerId
			})
			.from(groupMember)
			.innerJoin(groups, eq(groupMember.groupId, groups.id))
			.where(eq(groupMember.userId, userId))
			.orderBy(desc(groups.createdAt));
		return json({ groups: myGroups });
	}

	const conditions: any[] = [eq(groups.isPublic, true)];
	if (search) conditions.push(ilike(groups.name, `%${search}%`));

	const [{ total }] = await db
		.select({ total: count() })
		.from(groups)
		.where(and(...conditions));

	const results = await db
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
			ownerName: user.name
		})
		.from(groups)
		.leftJoin(user, eq(groups.ownerId, user.id))
		.where(and(...conditions))
		.orderBy(desc(groups.memberCount))
		.limit(limit)
		.offset((page - 1) * limit);

	return json({
		groups: results,
		total: Number(total),
		page,
		limit,
		totalPages: Math.ceil(Number(total) / limit)
	});
}

export async function POST({ request }) {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) throw error(401, 'Not authenticated');
	const userId = Number(session.user.id);

	const body = await request.json();
	const name = typeof body.name === 'string' ? body.name.trim() : '';
	const description = typeof body.description === 'string' ? body.description.trim() : '';
	const isPublic = body.isPublic !== false;

	if (name.length < 3 || name.length > 50) throw error(400, 'Name must be 3-50 characters');
	if (!/^[a-zA-Z0-9 _\-]+$/.test(name)) throw error(400, 'Name has invalid characters');
	if (description.length > 500) throw error(400, 'Description too long');

	return await db.transaction(async (tx) => {
		const [userData] = await tx
			.select({ baseCurrencyBalance: user.baseCurrencyBalance })
			.from(user)
			.where(eq(user.id, userId))
			.for('update')
			.limit(1);

		if (!userData) throw error(404, 'User not found');
		if (Number(userData.baseCurrencyBalance) < CREATION_COST) {
			throw error(400, `You need $${CREATION_COST} to create a group`);
		}

		const [ownedRow] = await tx
			.select({ c: count() })
			.from(groups)
			.where(eq(groups.ownerId, userId));
		if (Number(ownedRow.c) >= MAX_OWNED) {
			throw error(400, `You can only create ${MAX_OWNED} groups`);
		}

		const [joinedRow] = await tx
			.select({ c: count() })
			.from(groupMember)
			.where(eq(groupMember.userId, userId));
		if (Number(joinedRow.c) >= MAX_JOINED) {
			throw error(400, `You can only be in ${MAX_JOINED} groups`);
		}

		const [existing] = await tx
			.select({ id: groups.id })
			.from(groups)
			.where(eq(groups.name, name))
			.limit(1);
		if (existing) throw error(400, 'A group with this name already exists');

		const newBalance = Number(userData.baseCurrencyBalance) - CREATION_COST;
		await tx
			.update(user)
			.set({ baseCurrencyBalance: newBalance.toFixed(8), updatedAt: new Date() })
			.where(eq(user.id, userId));

		const [newGroup] = await tx
			.insert(groups)
			.values({
				name,
				description: description || null,
				isPublic,
				ownerId: userId,
				memberCount: 1
			})
			.returning();

		await tx.insert(groupMember).values({ groupId: newGroup.id, userId, role: 'owner' });

		return json({ group: newGroup }, { status: 201 });
	});
}
