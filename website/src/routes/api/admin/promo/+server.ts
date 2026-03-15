import { auth } from '$lib/auth';
import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { promoCode, promoCodeRedemption, user } from '$lib/server/db/schema';
import { eq, count } from 'drizzle-orm';
import { writeAdminLog } from '$lib/server/admin-log';
import type { RequestHandler } from './$types';
import { hasFlag } from '$lib/data/flags';

export const POST: RequestHandler = async ({ request }) => {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) {
		throw error(403, 'Admin access required');
	}
	const [currentUser] = await db
		.select({ flags: user.flags })
		.from(user)
		.where(eq(user.id, Number(session.user.id)))
		.limit(1);
	if (!hasFlag(currentUser.flags ?? 0n, 'IS_ADMIN', 'IS_HEAD_ADMIN'))
		throw error(403, 'Admin access required');

	const { code, description, rewardAmount, rewardType, maxUses, expiresAt, isSecret } =
		await request.json();

	if (!code || !rewardAmount || !rewardType) {
		return json({ error: 'Code, reward amount, and reward type are required' }, { status: 400 });
	}
	if (rewardAmount > 1_000_000 && rewardType === 'BASE_CURRENCY') {
		return json(
			{ error: "You can't create a promocode that gives more than $1 million per use." },
			{ status: 400 }
		);
	}
	if (rewardAmount > 1_000_000 && rewardType === 'GEMS') {
		return json(
			{ error: "You can't create a promocode that gives more than 1 million gems per use." },
			{ status: 400 }
		);
	}

	const normalizedCode = code.trim().toUpperCase();
	const userId = Number(session.user.id);

	const [existingCode] = await db
		.select({ id: promoCode.id })
		.from(promoCode)
		.where(eq(promoCode.code, normalizedCode))
		.limit(1);

	if (existingCode) {
		return json({ error: 'Promo code already exists' }, { status: 400 });
	}

	const [newPromoCode] = await db
		.insert(promoCode)
		.values({
			code: normalizedCode,
			description: description || null,
			rewardAmount: Number(rewardAmount).toFixed(8),
			rewardType: rewardType, // Save the reward type
			maxUses: maxUses || null,
			isSecret: Boolean(isSecret),
			expiresAt: expiresAt ? new Date(expiresAt) : null,
			createdBy: userId
		})
		.returning();

	if (!isSecret) {
		writeAdminLog(
			userId,
			'PROMO_CREATE',
			null,
			`Code: ${normalizedCode}, Amount: ${rewardAmount}, Type: ${rewardType}`
		);
	}

	return json({
		success: true,
		promoCode: {
			id: newPromoCode.id,
			code: newPromoCode.code,
			description: newPromoCode.description,
			rewardAmount: Number(newPromoCode.rewardAmount),
			rewardType: newPromoCode.rewardType,
			maxUses: newPromoCode.maxUses,
			expiresAt: newPromoCode.expiresAt
		}
	});
};

export const DELETE: RequestHandler = async ({ request }) => {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) {
		throw error(403, 'Admin access required');
	}
	const [currentUser] = await db
		.select({ flags: user.flags })
		.from(user)
		.where(eq(user.id, Number(session.user.id)))
		.limit(1);
	if (!hasFlag(currentUser.flags ?? 0n, 'IS_ADMIN', 'IS_HEAD_ADMIN'))
		throw error(403, 'Admin access required');

	const { id } = await request.json();
	if (!id) return json({ error: 'Promo code ID is required' }, { status: 400 });

	const [target] = await db
		.select({ id: promoCode.id, code: promoCode.code })
		.from(promoCode)
		.where(eq(promoCode.id, id))
		.limit(1);

	if (!target) throw error(404, 'Promo code not found');

	await db.delete(promoCodeRedemption).where(eq(promoCodeRedemption.promoCodeId, id));
	await db.delete(promoCode).where(eq(promoCode.id, id));

	writeAdminLog(Number(session.user.id), 'PROMO_DELETE', null, `Code: ${target.code}`);

	return json({ success: true });
};

export const GET: RequestHandler = async ({ request }) => {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) {
		throw error(403, 'Admin access required');
	}
	const [currentUser] = await db
		.select({ flags: user.flags })
		.from(user)
		.where(eq(user.id, Number(session.user.id)))
		.limit(1);
	if (!hasFlag(currentUser.flags ?? 0n, 'IS_ADMIN', 'IS_HEAD_ADMIN'))
		throw error(403, 'Admin access required');

	const rows = await db
		.select({
			id: promoCode.id,
			code: promoCode.code,
			description: promoCode.description,
			rewardAmount: promoCode.rewardAmount,
			rewardType: promoCode.rewardType,
			maxUses: promoCode.maxUses,
			isActive: promoCode.isActive,
			createdAt: promoCode.createdAt,
			expiresAt: promoCode.expiresAt,
			usedCount: count(promoCodeRedemption.id).as('usedCount')
		})
		.from(promoCode)
		.leftJoin(promoCodeRedemption, eq(promoCode.id, promoCodeRedemption.promoCodeId))
		.where(eq(promoCode.isSecret, false))
		.groupBy(promoCode.id);

	return json({
		codes: rows.map((pc) => ({
			...pc,
			rewardAmount: Number(pc.rewardAmount)
		}))
	});
};
