import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { groups, groupMember, user } from '$lib/server/db/schema';
import { eq, desc } from 'drizzle-orm';

export async function GET({ params }) {
	const { userId } = params;
	if (!userId) throw error(400, 'User ID is required');

	const isNumeric = /^\d+$/.test(userId);

	const [targetUser] = await db
		.select({ id: user.id })
		.from(user)
		.where(isNumeric ? eq(user.id, parseInt(userId)) : eq(user.username, userId))
		.limit(1);

	if (!targetUser) throw error(404, 'User not found');

	const userGroupList = await db
		.select({
			id: groups.id,
			name: groups.name,
			description: groups.description,
			isPublic: groups.isPublic,
			memberCount: groups.memberCount,
			role: groupMember.role,
			joinedAt: groupMember.joinedAt
		})
		.from(groupMember)
		.innerJoin(groups, eq(groupMember.groupId, groups.id))
		.where(eq(groupMember.userId, targetUser.id))
		.orderBy(desc(groupMember.joinedAt));

	const visibleGroups = userGroupList.filter((g) => g.isPublic || g.role !== undefined);

	return json({ groups: visibleGroups });
}
