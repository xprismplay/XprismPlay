import { redis } from '$lib/server/redis';

const POKER_LOBBY_PREFIX = 'poker:lobby:';
const POKER_PRIVATE_CODE_PREFIX = 'poker:private-code:';
const POKER_PUBLIC_SET = 'poker:lobbies:public';
const POKER_ACTION_TIMEOUT_MS = 30_000;
const CHIP_SCALE = 100_000_000;

export type PokerStreet = 'waiting' | 'preflop' | 'flop' | 'turn' | 'river';
export type PokerPlayerStatus = 'active' | 'folded' | 'all-in' | 'sitting-out' | 'left';
export type PokerActionType = 'fold' | 'check' | 'call' | 'raise' | 'all_in';

export interface PokerPlayerState {
	userId: number;
	username: string;
	image: string | null;
	seat: number;
	stackChips: number;
	totalBuyInChips: number;
	currentBetChips: number;
	totalContributionChips: number;
	status: PokerPlayerStatus;
	cards: string[];
	actedThisRound: boolean;
	missedTurns: number;
	pendingLeave: boolean;
}

export interface PokerWinnerInfo {
	userId: number;
	username: string;
	amountChips: number;
	handLabel?: string;
}

export interface PokerState {
	lobbyId: string;
	version: number;
	isPrivate: boolean;
	privateCode?: string;
	maxPlayers: number;
	smallBlindChips: number;
	bigBlindChips: number;
	minBuyInChips: number;
	maxBuyInChips: number;
	status: PokerStreet;
	board: string[];
	deck: string[];
	players: Array<PokerPlayerState | null>;
	dealerSeat: number;
	currentTurnSeat: number | null;
	highestBetChips: number;
	lastRaiseSizeChips: number;
	actionDueAt: number | null;
	handNumber: number;
	potChips: number;
	recentWinners: PokerWinnerInfo[];
	createdAt: number;
	updatedAt: number;
}

interface PokerUserProfile {
	userId: number;
	username: string;
	image: string | null;
}

interface PublicLobbySummary {
	lobbyId: string;
	playerCount: number;
	maxPlayers: number;
	smallBlind: number;
	bigBlind: number;
	minBuyIn: number;
	maxBuyIn: number;
	status: PokerStreet;
}

interface PotSlice {
	amountChips: number;
	eligibleSeats: number[];
}

interface HandRank {
	category: number;
	tiebreak: number[];
	label: string;
}

const RANK_ORDER = '23456789TJQKA';
const SUITS = ['c', 'd', 'h', 's'] as const;
const LUA_COMPARE_AND_SET = `
local cur = redis.call('get', KEYS[1])
if not cur then
  return -1
end
local parsed = cjson.decode(cur)
local ver = parsed.version or 0
if ver ~= tonumber(ARGV[1]) then
  return 0
end
redis.call('set', KEYS[1], ARGV[2])
return 1
`;

function nowMs(): number {
	return Date.now();
}

function lobbyKey(lobbyId: string): string {
	return `${POKER_LOBBY_PREFIX}${lobbyId}`;
}

function toChips(amount: number): number {
	return Math.round(amount * CHIP_SCALE);
}

function fromChips(chips: number): number {
	return Math.round(chips) / CHIP_SCALE;
}

function roundChips(chips: number): number {
	return Math.max(0, Math.round(chips));
}

function randomToken(length: number): string {
	const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
	const bytes = new Uint8Array(length);
	crypto.getRandomValues(bytes);
	return Array.from(bytes)
		.map((byte) => alphabet[byte % alphabet.length])
		.join('');
}

function generateDeck(): string[] {
	const deck: string[] = [];
	for (const rank of RANK_ORDER) {
		for (const suit of SUITS) {
			deck.push(`${rank}${suit}`);
		}
	}

	for (let i = deck.length - 1; i > 0; i -= 1) {
		const j = Math.floor(Math.random() * (i + 1));
		[deck[i], deck[j]] = [deck[j], deck[i]];
	}

	return deck;
}

function occupiedSeats(lobby: PokerState): number[] {
	const seats: number[] = [];
	for (let i = 0; i < lobby.players.length; i += 1) {
		if (lobby.players[i]) {
			seats.push(i);
		}
	}
	return seats;
}

function playerCanAct(player: PokerPlayerState | null): boolean {
	if (!player) return false;
	if (player.pendingLeave) return false;
	if (player.status === 'folded' || player.status === 'all-in' || player.status === 'sitting-out' || player.status === 'left') {
		return false;
	}
	return player.stackChips > 0;
}

function playerContestsPot(player: PokerPlayerState | null): boolean {
	if (!player) return false;
	return player.status !== 'folded' && player.status !== 'left' && player.status !== 'sitting-out';
}

function nextOccupiedSeat(lobby: PokerState, fromSeat: number): number | null {
	if (!lobby.players.length) return null;
	for (let step = 1; step <= lobby.players.length; step += 1) {
		const seat = (fromSeat + step) % lobby.players.length;
		if (lobby.players[seat]) return seat;
	}
	return null;
}

function nextSeatWith(lobby: PokerState, fromSeat: number, predicate: (player: PokerPlayerState | null) => boolean): number | null {
	for (let step = 1; step <= lobby.players.length; step += 1) {
		const seat = (fromSeat + step) % lobby.players.length;
		if (predicate(lobby.players[seat])) return seat;
	}
	return null;
}

function countContestingPlayers(lobby: PokerState): number {
	return lobby.players.filter((p) => playerContestsPot(p)).length;
}

function countCanActPlayers(lobby: PokerState): number {
	return lobby.players.filter((p) => playerCanAct(p)).length;
}

function firstEmptySeat(lobby: PokerState): number {
	for (let i = 0; i < lobby.players.length; i += 1) {
		if (!lobby.players[i]) return i;
	}
	return -1;
}

function updatePot(lobby: PokerState): void {
	lobby.potChips = lobby.players.reduce((sum, player) => sum + (player?.totalContributionChips ?? 0), 0);
}

function cardRankValue(card: string): number {
	return RANK_ORDER.indexOf(card[0]) + 2;
}

function evaluateFiveCardHand(cards: string[]): HandRank {
	const ranks = cards.map(cardRankValue).sort((a, b) => b - a);
	const suits = cards.map((card) => card[1]);
	const rankCounts = new Map<number, number>();
	for (const rank of ranks) {
		rankCounts.set(rank, (rankCounts.get(rank) ?? 0) + 1);
	}

	const isFlush = suits.every((suit) => suit === suits[0]);

	let uniqueRanks = Array.from(new Set(ranks)).sort((a, b) => b - a);
	let isStraight = false;
	let straightHigh = 0;
	if (uniqueRanks.length === 5) {
		if (uniqueRanks[0] - uniqueRanks[4] === 4) {
			isStraight = true;
			straightHigh = uniqueRanks[0];
		} else if (uniqueRanks.join(',') === '14,5,4,3,2') {
			isStraight = true;
			straightHigh = 5;
		}
	}

	const groups = Array.from(rankCounts.entries())
		.map(([rank, count]) => ({ rank, count }))
		.sort((a, b) => b.count - a.count || b.rank - a.rank);

	if (isStraight && isFlush) {
		return { category: 8, tiebreak: [straightHigh], label: 'Straight Flush' };
	}

	if (groups[0].count === 4) {
		return { category: 7, tiebreak: [groups[0].rank, groups[1].rank], label: 'Four of a Kind' };
	}

	if (groups[0].count === 3 && groups[1].count === 2) {
		return { category: 6, tiebreak: [groups[0].rank, groups[1].rank], label: 'Full House' };
	}

	if (isFlush) {
		return { category: 5, tiebreak: ranks, label: 'Flush' };
	}

	if (isStraight) {
		return { category: 4, tiebreak: [straightHigh], label: 'Straight' };
	}

	if (groups[0].count === 3) {
		const kickers = groups.slice(1).map((g) => g.rank).sort((a, b) => b - a);
		return { category: 3, tiebreak: [groups[0].rank, ...kickers], label: 'Three of a Kind' };
	}

	if (groups[0].count === 2 && groups[1].count === 2) {
		const pairRanks = [groups[0].rank, groups[1].rank].sort((a, b) => b - a);
		const kicker = groups[2].rank;
		return { category: 2, tiebreak: [...pairRanks, kicker], label: 'Two Pair' };
	}

	if (groups[0].count === 2) {
		const kickers = groups.slice(1).map((g) => g.rank).sort((a, b) => b - a);
		return { category: 1, tiebreak: [groups[0].rank, ...kickers], label: 'One Pair' };
	}

	return { category: 0, tiebreak: ranks, label: 'High Card' };
}

function compareRanks(a: HandRank, b: HandRank): number {
	if (a.category !== b.category) return a.category - b.category;
	const len = Math.max(a.tiebreak.length, b.tiebreak.length);
	for (let i = 0; i < len; i += 1) {
		const av = a.tiebreak[i] ?? 0;
		const bv = b.tiebreak[i] ?? 0;
		if (av !== bv) return av - bv;
	}
	return 0;
}

function evaluateSevenCards(cards: string[]): HandRank {
	let best: HandRank | null = null;
	for (let a = 0; a < cards.length - 4; a += 1) {
		for (let b = a + 1; b < cards.length - 3; b += 1) {
			for (let c = b + 1; c < cards.length - 2; c += 1) {
				for (let d = c + 1; d < cards.length - 1; d += 1) {
					for (let e = d + 1; e < cards.length; e += 1) {
						const rank = evaluateFiveCardHand([cards[a], cards[b], cards[c], cards[d], cards[e]]);
						if (!best || compareRanks(rank, best) > 0) {
							best = rank;
						}
					}
				}
			}
		}
	}

	if (!best) {
		return { category: 0, tiebreak: [0], label: 'High Card' };
	}

	return best;
}

function assignTurn(lobby: PokerState, seat: number | null): void {
	lobby.currentTurnSeat = seat;
	lobby.actionDueAt = seat === null ? null : nowMs() + POKER_ACTION_TIMEOUT_MS;
}

function resetForBettingRound(lobby: PokerState): void {
	lobby.highestBetChips = 0;
	lobby.lastRaiseSizeChips = lobby.bigBlindChips;
	for (const player of lobby.players) {
		if (!player) continue;
		player.currentBetChips = 0;
		player.actedThisRound = player.status === 'all-in' || player.status === 'folded' || player.status === 'left' || player.status === 'sitting-out';
	}
}

function drawCards(lobby: PokerState, count: number): string[] {
	const drawn: string[] = [];
	for (let i = 0; i < count; i += 1) {
		const card = lobby.deck.pop();
		if (!card) break;
		drawn.push(card);
	}
	return drawn;
}

function postChips(player: PokerPlayerState, amountChips: number): number {
	const posted = Math.min(player.stackChips, Math.max(0, amountChips));
	player.stackChips = roundChips(player.stackChips - posted);
	player.currentBetChips = roundChips(player.currentBetChips + posted);
	player.totalContributionChips = roundChips(player.totalContributionChips + posted);
	if (player.stackChips <= 0 && player.status === 'active') {
		player.status = 'all-in';
	}
	return posted;
}

function applyPendingLeaves(lobby: PokerState): PokerWinnerInfo[] {
	const payouts: PokerWinnerInfo[] = [];
	for (let i = 0; i < lobby.players.length; i += 1) {
		const player = lobby.players[i];
		if (!player || !player.pendingLeave) continue;

		if (player.stackChips > 0) {
			payouts.push({
				userId: player.userId,
				username: player.username,
				amountChips: player.stackChips
			});
		}
		lobby.players[i] = null;
	}
	return payouts;
}

function roundComplete(lobby: PokerState): boolean {
	const contenders = lobby.players.filter((player): player is PokerPlayerState => playerContestsPot(player));
	if (contenders.length <= 1) return true;

	const canAct = contenders.filter((player) => playerCanAct(player));
	if (canAct.length === 0) return true;

	for (const player of canAct) {
		if (!player.actedThisRound) return false;
		if (player.currentBetChips !== lobby.highestBetChips) return false;
	}
	return true;
}

function computeSidePots(lobby: PokerState): PotSlice[] {
	const contributors = lobby.players
		.map((player, seat) => ({ player, seat }))
		.filter((entry) => entry.player && entry.player.totalContributionChips > 0) as Array<{ player: PokerPlayerState; seat: number }>;

	if (!contributors.length) return [];

	const levels = Array.from(new Set(contributors.map((entry) => entry.player.totalContributionChips)))
		.sort((a, b) => a - b);
	const pots: PotSlice[] = [];

	let previous = 0;
	for (const level of levels) {
		const delta = level - previous;
		if (delta <= 0) continue;

		const involved = contributors.filter((entry) => entry.player.totalContributionChips >= level);
		const eligible = involved
			.filter((entry) => playerContestsPot(entry.player))
			.map((entry) => entry.seat);

		const amountChips = delta * involved.length;
		if (amountChips > 0 && eligible.length > 0) {
			pots.push({ amountChips, eligibleSeats: eligible });
		}

		previous = level;
	}

	return pots;
}

function splitPotEvenly(total: number, winnerSeats: number[]): Map<number, number> {
	const shares = new Map<number, number>();
	if (!winnerSeats.length || total <= 0) return shares;

	const base = Math.floor(total / winnerSeats.length);
	let remainder = total % winnerSeats.length;

	const sorted = [...winnerSeats].sort((a, b) => a - b);
	for (const seat of sorted) {
		const extra = remainder > 0 ? 1 : 0;
		shares.set(seat, base + extra);
		remainder -= extra;
	}

	return shares;
}

function ensureAtLeastTwoPlayersWithChips(lobby: PokerState): boolean {
	return lobby.players.filter((p) => p && !p.pendingLeave && p.stackChips > 0).length >= 2;
}

function preparePlayersForNewHand(lobby: PokerState): void {
	for (const player of lobby.players) {
		if (!player) continue;
		player.cards = [];
		player.currentBetChips = 0;
		player.totalContributionChips = 0;
		player.actedThisRound = false;

		if (player.pendingLeave) {
			player.status = 'left';
			continue;
		}

		if (player.stackChips <= 0) {
			player.status = 'sitting-out';
		} else {
			player.status = 'active';
		}
	}
	updatePot(lobby);
}

function startNewHand(lobby: PokerState): void {
	if (!ensureAtLeastTwoPlayersWithChips(lobby)) {
		lobby.status = 'waiting';
		lobby.board = [];
		lobby.deck = [];
		assignTurn(lobby, null);
		lobby.highestBetChips = 0;
		lobby.lastRaiseSizeChips = lobby.bigBlindChips;
		for (const player of lobby.players) {
			if (!player) continue;
			player.cards = [];
			player.currentBetChips = 0;
			player.totalContributionChips = 0;
			player.actedThisRound = false;
			if (player.stackChips <= 0) player.status = 'sitting-out';
		}
		updatePot(lobby);
		return;
	}

	preparePlayersForNewHand(lobby);
	lobby.handNumber += 1;
	lobby.status = 'preflop';
	lobby.board = [];
	lobby.deck = generateDeck();
	lobby.recentWinners = [];

	const dealerStart = lobby.dealerSeat >= 0 ? lobby.dealerSeat : 0;
	const dealerSeat = nextSeatWith(lobby, dealerStart, (player) => !!player && !player.pendingLeave && player.stackChips > 0);
	if (dealerSeat === null) {
		lobby.status = 'waiting';
		assignTurn(lobby, null);
		return;
	}
	lobby.dealerSeat = dealerSeat;

	for (let round = 0; round < 2; round += 1) {
		for (let step = 1; step <= lobby.players.length; step += 1) {
			const seat = (dealerSeat + step) % lobby.players.length;
			const player = lobby.players[seat];
			if (!player || player.pendingLeave || player.stackChips <= 0) continue;
			const card = lobby.deck.pop();
			if (card) player.cards.push(card);
		}
	}

	resetForBettingRound(lobby);

	const smallBlindSeat = nextSeatWith(lobby, dealerSeat, (player) => !!player && !player.pendingLeave && player.stackChips > 0);
	const bigBlindSeat = smallBlindSeat === null
		? null
		: nextSeatWith(lobby, smallBlindSeat, (player) => !!player && !player.pendingLeave && player.stackChips > 0);

	if (smallBlindSeat === null || bigBlindSeat === null) {
		lobby.status = 'waiting';
		assignTurn(lobby, null);
		return;
	}

	const sbPlayer = lobby.players[smallBlindSeat]!;
	const bbPlayer = lobby.players[bigBlindSeat]!;
	postChips(sbPlayer, lobby.smallBlindChips);
	postChips(bbPlayer, lobby.bigBlindChips);

	lobby.highestBetChips = bbPlayer.currentBetChips;
	lobby.lastRaiseSizeChips = Math.max(lobby.bigBlindChips, bbPlayer.currentBetChips - sbPlayer.currentBetChips);

	sbPlayer.actedThisRound = false;
	bbPlayer.actedThisRound = false;

	for (const player of lobby.players) {
		if (!player) continue;
		if (player.status === 'all-in') {
			player.actedThisRound = true;
		}
	}

	updatePot(lobby);

	const firstToAct = nextSeatWith(lobby, bigBlindSeat, playerCanAct);
	assignTurn(lobby, firstToAct);
}

function settleUncontested(lobby: PokerState): void {
	const winnerSeat = lobby.players.findIndex((player) => playerContestsPot(player));
	if (winnerSeat < 0) {
		startNewHand(lobby);
		return;
	}

	const winner = lobby.players[winnerSeat]!;
	const total = lobby.players.reduce((sum, player) => sum + (player?.totalContributionChips ?? 0), 0);
	winner.stackChips = roundChips(winner.stackChips + total);
	lobby.recentWinners = [{ userId: winner.userId, username: winner.username, amountChips: total }];

	for (const player of lobby.players) {
		if (!player) continue;
		player.currentBetChips = 0;
		player.totalContributionChips = 0;
		player.cards = [];
	}

	updatePot(lobby);
	startNewHand(lobby);
}

function settleShowdown(lobby: PokerState): void {
	const ranksBySeat = new Map<number, HandRank>();
	for (let seat = 0; seat < lobby.players.length; seat += 1) {
		const player = lobby.players[seat];
		if (!player || !playerContestsPot(player)) continue;
		if (player.cards.length < 2 || lobby.board.length < 5) continue;
		ranksBySeat.set(seat, evaluateSevenCards([...player.cards, ...lobby.board]));
	}

	const payouts = new Map<number, number>();
	const handLabels = new Map<number, string>();
	const sidePots = computeSidePots(lobby);

	for (const pot of sidePots) {
		let bestRank: HandRank | null = null;
		let winners: number[] = [];

		for (const seat of pot.eligibleSeats) {
			const rank = ranksBySeat.get(seat);
			if (!rank) continue;
			if (!bestRank || compareRanks(rank, bestRank) > 0) {
				bestRank = rank;
				winners = [seat];
			} else if (compareRanks(rank, bestRank) === 0) {
				winners.push(seat);
			}
		}

		if (!winners.length || !bestRank) continue;

		const split = splitPotEvenly(pot.amountChips, winners);
		for (const [seat, amount] of split.entries()) {
			payouts.set(seat, (payouts.get(seat) ?? 0) + amount);
			handLabels.set(seat, bestRank.label);
		}
	}

	lobby.recentWinners = [];
	for (const [seat, amount] of payouts.entries()) {
		const player = lobby.players[seat];
		if (!player || amount <= 0) continue;
		player.stackChips = roundChips(player.stackChips + amount);
		lobby.recentWinners.push({
			userId: player.userId,
			username: player.username,
			amountChips: amount,
			handLabel: handLabels.get(seat)
		});
	}

	for (const player of lobby.players) {
		if (!player) continue;
		player.currentBetChips = 0;
		player.totalContributionChips = 0;
		player.cards = [];
	}

	updatePot(lobby);
	startNewHand(lobby);
}

function advanceStreet(lobby: PokerState): void {
	if (countContestingPlayers(lobby) <= 1) {
		settleUncontested(lobby);
		return;
	}

	if (lobby.status === 'preflop') {
		lobby.status = 'flop';
		lobby.board.push(...drawCards(lobby, 3));
	} else if (lobby.status === 'flop') {
		lobby.status = 'turn';
		lobby.board.push(...drawCards(lobby, 1));
	} else if (lobby.status === 'turn') {
		lobby.status = 'river';
		lobby.board.push(...drawCards(lobby, 1));
	} else {
		settleShowdown(lobby);
		return;
	}

	resetForBettingRound(lobby);
	const firstToAct = nextSeatWith(lobby, lobby.dealerSeat, playerCanAct);
	if (firstToAct === null) {
		settleShowdown(lobby);
		return;
	}
	assignTurn(lobby, firstToAct);
	updatePot(lobby);
}

function progressAfterAction(lobby: PokerState): void {
	if (countContestingPlayers(lobby) <= 1) {
		settleUncontested(lobby);
		return;
	}

	if (roundComplete(lobby)) {
		advanceStreet(lobby);
		return;
	}

	if (lobby.currentTurnSeat === null) {
		const next = nextSeatWith(lobby, lobby.dealerSeat, playerCanAct);
		assignTurn(lobby, next);
		return;
	}

	const next = nextSeatWith(lobby, lobby.currentTurnSeat, playerCanAct);
	assignTurn(lobby, next);
}

function forceFoldCurrentTurn(lobby: PokerState): void {
	if (lobby.currentTurnSeat === null) return;
	const player = lobby.players[lobby.currentTurnSeat];
	if (!player || !playerCanAct(player)) {
		const next = nextSeatWith(lobby, lobby.currentTurnSeat, playerCanAct);
		assignTurn(lobby, next);
		return;
	}

	player.status = 'folded';
	player.actedThisRound = true;
	player.missedTurns += 1;
	progressAfterAction(lobby);
}

function processTimeouts(lobby: PokerState): void {
	let safety = 0;
	while (lobby.currentTurnSeat !== null && lobby.actionDueAt !== null && nowMs() > lobby.actionDueAt) {
		forceFoldCurrentTurn(lobby);
		safety += 1;
		if (safety > 10) break;
	}
}

function validateRaise(player: PokerPlayerState, lobby: PokerState, raiseToChips: number): { commit: number; effectiveRaise: number } {
	if (raiseToChips <= lobby.highestBetChips) {
		throw new Error('Raise must be above current highest bet');
	}

	const commit = raiseToChips - player.currentBetChips;
	if (commit <= 0) {
		throw new Error('Invalid raise amount');
	}
	if (commit > player.stackChips) {
		throw new Error('Insufficient chips for raise');
	}

	const previousHighest = lobby.highestBetChips;
	const effectiveRaise = raiseToChips - previousHighest;
	const minRaise = Math.max(lobby.lastRaiseSizeChips, lobby.bigBlindChips);
	const allInForLess = commit === player.stackChips && effectiveRaise < minRaise;
	if (!allInForLess && effectiveRaise < minRaise) {
		throw new Error(`Minimum raise is ${fromChips(previousHighest + minRaise)}`);
	}

	return { commit, effectiveRaise };
}

function runAction(lobby: PokerState, userId: number, action: PokerActionType, amount?: number): void {
	processTimeouts(lobby);

	if (lobby.status === 'waiting') {
		throw new Error('Hand has not started yet');
	}
	if (lobby.currentTurnSeat === null) {
		throw new Error('No player turn is active');
	}

	const seat = lobby.currentTurnSeat;
	const player = lobby.players[seat];
	if (!player || player.userId !== userId) {
		throw new Error('It is not your turn');
	}
	if (!playerCanAct(player)) {
		throw new Error('You cannot act right now');
	}

	const toCall = Math.max(0, lobby.highestBetChips - player.currentBetChips);

	switch (action) {
		case 'fold': {
			player.status = 'folded';
			player.actedThisRound = true;
			break;
		}
		case 'check': {
			if (toCall > 0) {
				throw new Error('Cannot check while facing a bet');
			}
			player.actedThisRound = true;
			break;
		}
		case 'call': {
			if (toCall <= 0) {
				player.actedThisRound = true;
				break;
			}
			postChips(player, toCall);
			player.actedThisRound = true;
			break;
		}
		case 'raise': {
			if (typeof amount !== 'number' || Number.isNaN(amount)) {
				throw new Error('Raise amount is required');
			}
			const raiseToChips = roundChips(toChips(amount));
			const { commit, effectiveRaise } = validateRaise(player, lobby, raiseToChips);
			postChips(player, commit);
			lobby.highestBetChips = raiseToChips;
			if (effectiveRaise >= lobby.lastRaiseSizeChips) {
				lobby.lastRaiseSizeChips = effectiveRaise;
			}

			for (let i = 0; i < lobby.players.length; i += 1) {
				const other = lobby.players[i];
				if (!other || i === seat) continue;
				if (playerCanAct(other)) {
					other.actedThisRound = false;
				}
			}
			player.actedThisRound = true;
			break;
		}
		case 'all_in': {
			if (player.stackChips <= 0) {
				throw new Error('No chips left');
			}
			const previousHighest = lobby.highestBetChips;
			const beforeBet = player.currentBetChips;
			const commit = player.stackChips;
			postChips(player, commit);
			const newBet = player.currentBetChips;

			if (newBet > previousHighest) {
				const raiseSize = newBet - previousHighest;
				lobby.highestBetChips = newBet;
				if (raiseSize >= lobby.lastRaiseSizeChips) {
					lobby.lastRaiseSizeChips = raiseSize;
					for (let i = 0; i < lobby.players.length; i += 1) {
						const other = lobby.players[i];
						if (!other || i === seat) continue;
						if (playerCanAct(other)) other.actedThisRound = false;
					}
				}
			}

			player.actedThisRound = true;
			player.status = 'all-in';
			if (beforeBet + commit <= previousHighest) {
				player.currentBetChips = beforeBet + commit;
			}
			break;
		}
		default:
			throw new Error('Unsupported action');
	}

	updatePot(lobby);
	progressAfterAction(lobby);
}

function sanitizePlayer(viewerId: number, player: PokerPlayerState | null): PokerPlayerState | null {
	if (!player) return null;

	const isSelf = player.userId === viewerId;
	const revealCards = isSelf || player.status === 'folded' || player.status === 'left';

	return {
		...player,
		stackChips: player.stackChips,
		currentBetChips: player.currentBetChips,
		totalContributionChips: player.totalContributionChips,
		cards: revealCards ? player.cards : player.cards.map(() => 'XX')
	};
}

export function sanitizeLobbyForUser(lobby: PokerState, viewerId: number): PokerState {
	const masked: PokerState = {
		...lobby,
		deck: [],
		players: lobby.players.map((player) => sanitizePlayer(viewerId, player))
	};
	return masked;
}

export function chipsToAmount(chips: number): number {
	return fromChips(chips);
}

export function amountToChips(amount: number): number {
	return toChips(amount);
}

export async function loadLobby(lobbyId: string): Promise<PokerState | null> {
	const raw = await redis.get(lobbyKey(lobbyId));
	if (!raw) return null;
	return JSON.parse(raw) as PokerState;
}

async function saveLobbyCAS(lobby: PokerState, expectedVersion: number): Promise<boolean> {
	lobby.version = expectedVersion + 1;
	lobby.updatedAt = nowMs();
	const res = (await redis.eval(LUA_COMPARE_AND_SET, {
		keys: [lobbyKey(lobby.lobbyId)],
		arguments: [String(expectedVersion), JSON.stringify(lobby)]
	})) as number;
	return res === 1;
}

async function saveLobbyDirect(lobby: PokerState): Promise<void> {
	lobby.updatedAt = nowMs();
	await redis.set(lobbyKey(lobby.lobbyId), JSON.stringify(lobby));
}

export async function mutateLobby<T>(lobbyId: string, mutator: (lobby: PokerState) => Promise<T> | T): Promise<{ value: T; lobby: PokerState }> {
	let lastError: Error | null = null;

	for (let attempt = 0; attempt < 5; attempt += 1) {
		const lobby = await loadLobby(lobbyId);
		if (!lobby) throw new Error('Lobby not found');
		const expectedVersion = lobby.version ?? 0;

		processTimeouts(lobby);
		const value = await mutator(lobby);

		const saved = await saveLobbyCAS(lobby, expectedVersion);
		if (saved) {
			await redis.publish(`poker:lobby:${lobbyId}`, JSON.stringify({ type: 'poker_state', lobbyId }));
			return { value, lobby };
		}

		lastError = new Error('Lobby was updated concurrently; please retry');
	}

	throw lastError ?? new Error('Failed to update lobby');
}

export async function createPokerLobby(options: {
	isPrivate: boolean;
	maxPlayers: number;
	smallBlind: number;
	bigBlind: number;
	minBuyIn: number;
	maxBuyIn: number;
}): Promise<PokerState> {
	const lobbyId = randomToken(8);
	const privateCode = options.isPrivate ? randomToken(6) : undefined;
	const now = nowMs();

	const lobby: PokerState = {
		lobbyId,
		version: 1,
		isPrivate: options.isPrivate,
		privateCode,
		maxPlayers: options.maxPlayers,
		smallBlindChips: toChips(options.smallBlind),
		bigBlindChips: toChips(options.bigBlind),
		minBuyInChips: toChips(options.minBuyIn),
		maxBuyInChips: toChips(options.maxBuyIn),
		status: 'waiting',
		board: [],
		deck: [],
		players: Array.from({ length: options.maxPlayers }, () => null),
		dealerSeat: -1,
		currentTurnSeat: null,
		highestBetChips: 0,
		lastRaiseSizeChips: toChips(options.bigBlind),
		actionDueAt: null,
		handNumber: 0,
		potChips: 0,
		recentWinners: [],
		createdAt: now,
		updatedAt: now
	};

	await saveLobbyDirect(lobby);
	if (options.isPrivate && privateCode) {
		await redis.set(`${POKER_PRIVATE_CODE_PREFIX}${privateCode}`, lobbyId);
	} else {
		await redis.sAdd(POKER_PUBLIC_SET, lobbyId);
	}

	return lobby;
}

export async function findPrivateLobbyByCode(code: string): Promise<PokerState | null> {
	const lobbyId = await redis.get(`${POKER_PRIVATE_CODE_PREFIX}${code.toUpperCase()}`);
	if (!lobbyId) return null;
	return loadLobby(lobbyId);
}

export async function listPublicLobbies(): Promise<PublicLobbySummary[]> {
	const lobbyIds = await redis.sMembers(POKER_PUBLIC_SET);
	if (!lobbyIds.length) return [];

	const lobbies: PublicLobbySummary[] = [];
	for (const lobbyId of lobbyIds) {
		const lobby = await loadLobby(lobbyId);
		if (!lobby) {
			await redis.sRem(POKER_PUBLIC_SET, lobbyId);
			continue;
		}

		const playerCount = lobby.players.filter((player) => player && !player.pendingLeave).length;
		lobbies.push({
			lobbyId,
			playerCount,
			maxPlayers: lobby.maxPlayers,
			smallBlind: fromChips(lobby.smallBlindChips),
			bigBlind: fromChips(lobby.bigBlindChips),
			minBuyIn: fromChips(lobby.minBuyInChips),
			maxBuyIn: fromChips(lobby.maxBuyInChips),
			status: lobby.status
		});
	}

	return lobbies.sort((a, b) => b.playerCount - a.playerCount);
}

export async function findMatchingPublicLobby(criteria: {
	smallBlind: number;
	bigBlind: number;
	minBuyIn: number;
	maxBuyIn: number;
	maxPlayers: number;
}): Promise<PokerState | null> {
	const lobbies = await listPublicLobbies();
	for (const summary of lobbies) {
		if (
			summary.smallBlind === criteria.smallBlind &&
			summary.bigBlind === criteria.bigBlind &&
			summary.minBuyIn === criteria.minBuyIn &&
			summary.maxBuyIn === criteria.maxBuyIn &&
			summary.maxPlayers === criteria.maxPlayers &&
			summary.playerCount < summary.maxPlayers
		) {
			const lobby = await loadLobby(summary.lobbyId);
			if (lobby) return lobby;
		}
	}

	return null;
}

export async function joinLobby(lobbyId: string, userProfile: PokerUserProfile, buyInAmount: number): Promise<PokerState> {
	const buyInChips = toChips(buyInAmount);
	const result = await mutateLobby(lobbyId, (lobby) => {
		if (buyInChips < lobby.minBuyInChips || buyInChips > lobby.maxBuyInChips) {
			throw new Error(`Buy-in must be between ${fromChips(lobby.minBuyInChips)} and ${fromChips(lobby.maxBuyInChips)}`);
		}

		for (const existing of lobby.players) {
			if (existing?.userId === userProfile.userId) {
				throw new Error('You are already in this lobby');
			}
		}

		const seat = firstEmptySeat(lobby);
		if (seat < 0) {
			throw new Error('Lobby is full');
		}

		lobby.players[seat] = {
			userId: userProfile.userId,
			username: userProfile.username,
			image: userProfile.image,
			seat,
			stackChips: buyInChips,
			totalBuyInChips: buyInChips,
			currentBetChips: 0,
			totalContributionChips: 0,
			status: 'active',
			cards: [],
			actedThisRound: false,
			missedTurns: 0,
			pendingLeave: false
		};

		if (lobby.status === 'waiting' && ensureAtLeastTwoPlayersWithChips(lobby)) {
			startNewHand(lobby);
		}

		return lobby;
	});

	return result.lobby;
}

export interface LeaveResult {
	payoutAmount: number;
	totalBuyInAmount: number;
	netAmount: number;
	lobby: PokerState;
}

export async function leaveLobby(lobbyId: string, userId: number): Promise<LeaveResult> {
	const result = await mutateLobby(lobbyId, (lobby) => {
		const seat = lobby.players.findIndex((player) => player?.userId === userId);
		if (seat < 0) {
			throw new Error('You are not seated in this lobby');
		}

		const player = lobby.players[seat]!;
		let payoutChips = player.stackChips;
		const totalBuyInChips = player.totalBuyInChips;

		if (lobby.status !== 'waiting' && playerContestsPot(player)) {
			player.status = 'folded';
		}

		player.stackChips = 0;
		player.pendingLeave = true;
		player.actedThisRound = true;

		if (lobby.currentTurnSeat === seat) {
			progressAfterAction(lobby);
		}

		if (lobby.status === 'waiting') {
			const payouts = applyPendingLeaves(lobby);
			const payout = payouts.find((entry) => entry.userId === userId);
			payoutChips = payout?.amountChips ?? payoutChips;
		}

		if (occupiedSeats(lobby).length === 0) {
			void redis.del(lobbyKey(lobby.lobbyId));
			if (lobby.isPrivate && lobby.privateCode) {
				void redis.del(`${POKER_PRIVATE_CODE_PREFIX}${lobby.privateCode}`);
			} else {
				void redis.sRem(POKER_PUBLIC_SET, lobby.lobbyId);
			}
		}

		return { payoutChips, totalBuyInChips };
	});

	return {
		payoutAmount: fromChips(result.value.payoutChips),
		totalBuyInAmount: fromChips(result.value.totalBuyInChips),
		netAmount: fromChips(result.value.payoutChips - result.value.totalBuyInChips),
		lobby: result.lobby
	};
}

export async function performAction(lobbyId: string, userId: number, action: PokerActionType, amount?: number): Promise<PokerState> {
	const result = await mutateLobby(lobbyId, (lobby) => {
		runAction(lobby, userId, action, amount);
		const payouts = applyPendingLeaves(lobby);
		if (payouts.length > 0 && lobby.status === 'waiting') {
			// no-op; payouts are processed in API layer by follow-up leave calls
		}
		return lobby;
	});
	return result.lobby;
}

export function lobbyPayoutsFromPendingLeaves(lobby: PokerState): PokerWinnerInfo[] {
	return applyPendingLeaves(lobby);
}

export function getPlayerSeat(lobby: PokerState, userId: number): number {
	return lobby.players.findIndex((player) => player?.userId === userId);
}

export function isUsersTurn(lobby: PokerState, userId: number): boolean {
	if (lobby.currentTurnSeat === null) return false;
	const player = lobby.players[lobby.currentTurnSeat];
	return !!player && player.userId === userId;
}

export function toPublicLobbySummary(lobby: PokerState): PublicLobbySummary {
	return {
		lobbyId: lobby.lobbyId,
		playerCount: lobby.players.filter((player) => player && !player.pendingLeave).length,
		maxPlayers: lobby.maxPlayers,
		smallBlind: fromChips(lobby.smallBlindChips),
		bigBlind: fromChips(lobby.bigBlindChips),
		minBuyIn: fromChips(lobby.minBuyInChips),
		maxBuyIn: fromChips(lobby.maxBuyInChips),
		status: lobby.status
	};
}

