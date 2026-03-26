import { json } from '@sveltejs/kit';
import { auth } from '$lib/auth';
import { db } from '$lib/server/db';
import { lotteryTicket } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { getOrCreateActiveDraw, calcDrawChance, TICKET_PRICE } from '$lib/server/lottery';

export async function GET({ request }) {
	const session = await auth.api.getSession({ headers: request.headers });
	const userId = session?.user ? Number(session.user.id) : null;

	const draw = await getOrCreateActiveDraw();

	let userTickets = 0;
	if (userId) {
		const [row] = await db
			.select({ quantity: lotteryTicket.quantity })
			.from(lotteryTicket)
			.where(and(eq(lotteryTicket.drawId, draw.id), eq(lotteryTicket.userId, userId)));
		userTickets = row?.quantity ?? 0;
	}

	const prizePool = Number(draw.prizePool);
	const drawChance = calcDrawChance(prizePool);
	const totalTickets = draw.totalTickets;
	const chancePerTicket = totalTickets > 0 ? drawChance / totalTickets : 0;
	const userCombinedChance = chancePerTicket * userTickets;

	return json({
		draw: {
			id: draw.id,
			drawDate: draw.drawDate,
			prizePool,
			ticketRevenue: Number(draw.ticketRevenue),
			bankContribution: Number(draw.bankContribution),
			donations: Number(draw.donations),
			rolloverAmount: Number(draw.rolloverAmount),
			totalTickets,
			drawChance,
			status: draw.status
		},
		ticketPrice: TICKET_PRICE,
		userTickets,
		chancePerTicket,
		userCombinedChance
	});
}