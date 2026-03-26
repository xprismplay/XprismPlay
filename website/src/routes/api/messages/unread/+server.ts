import { auth } from '$lib/auth';
import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { directMessage } from '$lib/server/db/schema';
import { eq, and, count } from 'drizzle-orm';

export async function GET({ request }) {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) return json({ count: 0 });

	const userId = Number(session.user.id);

	const [result] = await db
		.select({ total: count() })
		.from(directMessage)
		.where(and(eq(directMessage.receiverId, userId), eq(directMessage.isRead, false)));

	return json({ count: Number(result?.total ?? 0) });
}