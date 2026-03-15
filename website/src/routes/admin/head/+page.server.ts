import { redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import type { ServerLoad } from '@sveltejs/kit'; // <-- Changed this import
import { auth } from '$lib/auth';
import { hasFlag } from '$lib/data/flags';

export const load: ServerLoad = async ({ request }) => {
	const authSession = await auth.api.getSession({ headers: request.headers });

	if (!authSession?.user) {
		throw redirect(302, '/');
	}

	const [currentUser] = await db
		.select({ flags: user.flags })
		.from(user)
		.where(eq(user.id, Number(authSession.user.id)))
		.limit(1);

	// Kick them out if they aren't a head admin
	if (!hasFlag(currentUser?.flags ?? 0n, 'IS_HEAD_ADMIN')) {
		throw redirect(302, '/');
	}

	return {};
};
