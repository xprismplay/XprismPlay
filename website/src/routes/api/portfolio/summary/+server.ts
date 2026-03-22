import { auth } from '$lib/auth';
import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { user, userPortfolio, coin } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export async function GET({ request }) {
	const session = await auth.api.getSession({ headers: request.headers });

	if (!session?.user) {
		throw error(401, 'Not authenticated');
	}

	const userId = Number(session.user.id);

	const [userData, holdings] = await Promise.all([
		db
			.select({ baseCurrencyBalance: user.baseCurrencyBalance })
			.from(user)
			.where(eq(user.id, userId))
			.limit(1),

		db
			.select({
				quantity: userPortfolio.quantity,
				currentPrice: coin.currentPrice,
				poolBaseCurrencyAmount: coin.poolBaseCurrencyAmount,
				poolCoinAmount: coin.poolCoinAmount,
			})
			.from(userPortfolio)
			.innerJoin(coin, eq(userPortfolio.coinId, coin.id))
			.where(eq(userPortfolio.userId, userId))
	]);

	if (!userData[0]) {
		throw error(404, 'User not found');
	}

	let totalCoinValue = 0;

	for (const holding of holdings) {
		const baseCurrency = Number(holding.poolBaseCurrencyAmount);
		const coinAmount = Number(holding.poolCoinAmount)
		
		let k = baseCurrency * coinAmount
		let newCoinAmount = coinAmount + quantity;
		let newBaseCurrency = k / newCoinAmount;
		let value = baseCurrency - newBaseCurrency;
		totalCoinValue += value;
	}

	const baseCurrencyBalance = Number(userData[0].baseCurrencyBalance);

	return json({
		baseCurrencyBalance,
		totalCoinValue,
		totalValue: baseCurrencyBalance + totalCoinValue,
		currency: '$'
	});
}
