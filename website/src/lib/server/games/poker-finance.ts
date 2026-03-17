import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export async function debitUserForPokerBuyIn(userId: number, buyInAmount: number): Promise<{ username: string; image: string | null; newBalance: number }> {
	return db.transaction(async (tx) => {
		const [row] = await tx
			.select({
				username: user.username,
				image: user.image,
				baseCurrencyBalance: user.baseCurrencyBalance
			})
			.from(user)
			.where(eq(user.id, userId))
			.for('update')
			.limit(1);

		if (!row) {
			throw new Error('User not found');
		}

		const balance = Number(row.baseCurrencyBalance);
		if (buyInAmount > balance) {
			throw new Error(`Insufficient funds. You need $${buyInAmount.toFixed(2)} but only have $${balance.toFixed(2)}`);
		}

		const newBalance = Math.round((balance - buyInAmount) * 100000000) / 100000000;
		await tx
			.update(user)
			.set({
				baseCurrencyBalance: newBalance.toFixed(8),
				updatedAt: new Date()
			})
			.where(eq(user.id, userId));

		return {
			username: row.username,
			image: row.image,
			newBalance
		};
	});
}

export async function refundUserPokerBuyIn(userId: number, amount: number): Promise<void> {
	if (amount <= 0) return;

	await db.transaction(async (tx) => {
		const [row] = await tx
			.select({ baseCurrencyBalance: user.baseCurrencyBalance })
			.from(user)
			.where(eq(user.id, userId))
			.for('update')
			.limit(1);

		if (!row) return;
		const balance = Number(row.baseCurrencyBalance);
		const newBalance = Math.round((balance + amount) * 100000000) / 100000000;

		await tx
			.update(user)
			.set({
				baseCurrencyBalance: newBalance.toFixed(8),
				updatedAt: new Date()
			})
			.where(eq(user.id, userId));
	});
}

export async function settlePokerCashout(userId: number, payoutAmount: number, totalBuyInAmount: number): Promise<number> {
	return db.transaction(async (tx) => {
		const [row] = await tx
			.select({
				baseCurrencyBalance: user.baseCurrencyBalance,
				arcadeLosses: user.arcadeLosses,
				arcadeWins: user.arcadeWins,
				arcadeWinStreak: user.arcadeWinStreak,
				arcadeBestWinStreak: user.arcadeBestWinStreak,
				totalArcadeGamesPlayed: user.totalArcadeGamesPlayed,
				totalArcadeWagered: user.totalArcadeWagered
			})
			.from(user)
			.where(eq(user.id, userId))
			.for('update')
			.limit(1);

		if (!row) {
			throw new Error('User not found');
		}

		const currentBalance = Number(row.baseCurrencyBalance);
		const creditedBalance = Math.round((currentBalance + payoutAmount) * 100000000) / 100000000;
		const net = payoutAmount - totalBuyInAmount;
		const isWin = net > 0;

		const updateData: Record<string, unknown> = {
			baseCurrencyBalance: creditedBalance.toFixed(8),
			totalArcadeGamesPlayed: (row.totalArcadeGamesPlayed || 0) + 1,
			totalArcadeWagered: `${Number(row.totalArcadeWagered || 0) + totalBuyInAmount}`,
			updatedAt: new Date()
		};

		if (isWin) {
			const nextStreak = (row.arcadeWinStreak || 0) + 1;
			updateData.arcadeWins = `${Number(row.arcadeWins || 0) + net}`;
			updateData.arcadeWinStreak = nextStreak;
			updateData.arcadeBestWinStreak = Math.max(nextStreak, row.arcadeBestWinStreak || 0);
		} else {
			updateData.arcadeLosses = `${Number(row.arcadeLosses || 0) + Math.abs(net)}`;
			updateData.arcadeWinStreak = 0;
		}

		await tx.update(user).set(updateData).where(eq(user.id, userId));

		return creditedBalance;
	});
}

