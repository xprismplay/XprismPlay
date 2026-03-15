// src/routes/api/admin/head/balance/+server.ts
import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema';
import { eq, sql } from 'drizzle-orm';
import { auth } from '$lib/auth';
import type { RequestHandler } from '@sveltejs/kit'; // <-- Changed this import
import { hasFlag } from '$lib/data/flags';

export const POST: RequestHandler = async ({ request }) => {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) {
		return json({ message: 'Unauthorized' }, { status: 401 });
	}

	const [currentUser] = await db
		.select({ flags: user.flags })
		.from(user)
		.where(eq(user.id, Number(session.user.id)))
		.limit(1);

	if (!hasFlag(currentUser.flags, 'IS_HEAD_ADMIN')) {
		return json({ message: 'Forbidden: Head Admin access required' }, { status: 403 });
	}

	const body = await request.json();
	const { username, amount, action } = body;

	// Removed amount < 0 so negative numbers are properly passed to the DB
	if (!username || typeof amount !== 'number' || isNaN(amount)) {
		return json(
			{ message: 'Invalid input. Provide a username and a valid amount.' },
			{ status: 400 }
		);
	}

	const [targetUser] = await db
		.select({ id: user.id })
		.from(user)
		.where(eq(user.username, username))
		.limit(1);

	if (!targetUser) {
		return json({ message: `User "${username}" not found.` }, { status: 404 });
	}

	let balanceUpdateQuery;
	if (action === 'set') {
		balanceUpdateQuery = sql`${amount.toString()}`;
	} else if (action === 'add') {
		balanceUpdateQuery = sql`${user.baseCurrencyBalance} + ${amount.toString()}`;
	} else if (action === 'subtract') {
		balanceUpdateQuery = sql`${user.baseCurrencyBalance} - ${amount.toString()}`;
	} else {
		return json({ message: 'Invalid action parameter.' }, { status: 400 });
	}

	try {
		await db
			.update(user)
			.set({ baseCurrencyBalance: balanceUpdateQuery })
			.where(eq(user.id, targetUser.id));

		return json({ message: `Successfully applied '${action}' of $${amount} to ${username}.` });
	} catch (error) {
		console.error('Failed to update balance:', error);
		return json({ message: 'Database error while updating balance.' }, { status: 500 });
	}
};
