import { auth } from '$lib/auth';
import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { lotteryDraw, lotteryTicket, user } from '$lib/server/db/schema';
import { eq, sql } from 'drizzle-orm';
import { getOrCreateActiveDraw, TICKET_PRICE, calcDrawChance } from '$lib/server/lottery';

export async function POST({ request }) {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) throw error(401, 'Not authenticated');

	const userId = Number(session.user.id);
	const body = await request.json();
	const quantity = Math.floor(Number(body.quantity));

	if (!Number.isInteger(quantity) || quantity < 1 || quantity > 1000) {
		throw error(400, 'Quantity must be between 1 and 1000');
	}

	const totalCost = quantity * TICKET_PRICE;
	const draw = await getOrCreateActiveDraw();
	const now = new Date();

	if (draw.status !== 'ACTIVE' || new Date(draw.drawDate) <= now) {
		throw error(400, 'No active lottery draw available');
	}

	return db.transaction(async (tx) => {
		const [userData] = await tx
			.select({ baseCurrencyBalance: user.baseCurrencyBalance })
			.from(user)
			.where(eq(user.id, userId))
			.for('update')
			.limit(1);

		if (!userData) throw error(404, 'User not found');

		const balance = Number(userData.baseCurrencyBalance);
		if (balance < totalCost) {
			throw error(
				400,
				`Insufficient funds. Need $${totalCost} but have $${balance.toFixed(2)}`
			);
		}

		await tx
			.update(user)
			.set({ baseCurrencyBalance: (balance - totalCost).toFixed(8), updatedAt: now })
			.where(eq(user.id, userId));

		await tx
			.insert(lotteryTicket)
			.values({ drawId: draw.id, userId, quantity })
			.onConflictDoUpdate({
				target: [lotteryTicket.drawId, lotteryTicket.userId],
				set: { quantity: sql`${lotteryTicket.quantity} + ${quantity}` }
			});

		const newPrizePool = Number(draw.prizePool) + totalCost;
		const newTicketRevenue = Number(draw.ticketRevenue) + totalCost;
		const newTotalTickets = draw.totalTickets + quantity;

		await tx
			.update(lotteryDraw)
			.set({
				prizePool: newPrizePool.toFixed(8),
				ticketRevenue: newTicketRevenue.toFixed(8),
				totalTickets: newTotalTickets,
				drawChance: calcDrawChance(newPrizePool).toFixed(8)
			})
			.where(eq(lotteryDraw.id, draw.id));

		return json({ success: true, quantity, totalCost, newBalance: balance - totalCost });
	});
}