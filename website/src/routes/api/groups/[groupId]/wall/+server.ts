import { auth } from '$lib/auth';
import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { groups, groupMember, groupWallPost, user } from '$lib/server/db/schema';
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
	const userId = session?.user ? Number(session.user.id) : null;

	const [group] = await db
		.select({ isPublic: groups.isPublic })
		.from(groups)
		.where(eq(groups.id, groupId))
		.limit(1);

	if (!group) throw error(404, 'Group not found');

	const memberRole = userId ? await getRole(groupId, userId) : null;
	if (!group.isPublic && !memberRole) throw error(403, 'Members only');

	const posts = await db
		.select({
			id: groupWallPost.id,
			content: groupWallPost.content,
			isDeleted: groupWallPost.isDeleted,
			createdAt: groupWallPost.createdAt,
			userId: groupWallPost.userId,
			username: user.username,
			userName: user.name,
			userImage: user.image
		})
		.from(groupWallPost)
		.leftJoin(user, eq(groupWallPost.userId, user.id))
		.where(and(eq(groupWallPost.groupId, groupId), eq(groupWallPost.isDeleted, false)))
		.orderBy(desc(groupWallPost.createdAt))
		.limit(50);

	return json({ posts, memberRole });
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
	const content = typeof body.content === 'string' ? body.content.trim() : '';

	if (content.length < 1 || content.length > 500) {
		throw error(400, 'Post must be 1-500 characters');
	}

	const [post] = await db.insert(groupWallPost).values({ groupId, userId, content }).returning();

	const [postWithUser] = await db
		.select({
			id: groupWallPost.id,
			content: groupWallPost.content,
			createdAt: groupWallPost.createdAt,
			userId: groupWallPost.userId,
			username: user.username,
			userName: user.name,
			userImage: user.image
		})
		.from(groupWallPost)
		.leftJoin(user, eq(groupWallPost.userId, user.id))
		.where(eq(groupWallPost.id, post.id))
		.limit(1);

	return json({ post: postWithUser }, { status: 201 });
}

export async function DELETE({ params, request, url }) {
	const groupId = parseInt(params.groupId);
	if (isNaN(groupId)) throw error(400, 'Invalid group ID');

	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) throw error(401, 'Not authenticated');
	const userId = Number(session.user.id);

	const postId = parseInt(url.searchParams.get('postId') || '');
	if (isNaN(postId)) throw error(400, 'Invalid post ID');

	const [post] = await db
		.select({ userId: groupWallPost.userId, groupId: groupWallPost.groupId })
		.from(groupWallPost)
		.where(and(eq(groupWallPost.id, postId), eq(groupWallPost.isDeleted, false)))
		.limit(1);

	if (!post) throw error(404, 'Post not found');
	if (post.groupId !== groupId) throw error(400, 'Post does not belong to this group');

	const role = await getRole(groupId, userId);
	if (!role) throw error(403, 'Members only');

	const isAuthor = post.userId === userId;
	const canModerate = role === 'owner' || role === 'admin';

	if (!isAuthor && !canModerate) {
		throw error(403, 'You cannot delete this post');
	}

	await db.update(groupWallPost).set({ isDeleted: true }).where(eq(groupWallPost.id, postId));

	return json({ success: true });
}
