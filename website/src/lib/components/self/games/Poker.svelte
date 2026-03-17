<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { fly, scale } from 'svelte/transition';
	import { toast } from 'svelte-sonner';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { websocketController } from '$lib/stores/websocket';
	import { USER_DATA } from '$lib/stores/user-data';
	import { formatValue } from '$lib/utils';

	type PlayerStatus = 'active' | 'folded' | 'all-in' | 'sitting-out' | 'left';
	type Street = 'waiting' | 'preflop' | 'flop' | 'turn' | 'river';

	interface PokerPlayer {
		userId: number;
		username: string;
		image: string | null;
		seat: number;
		stackChips: number;
		totalBuyInChips: number;
		currentBetChips: number;
		totalContributionChips: number;
		status: PlayerStatus;
		cards: string[];
		actedThisRound: boolean;
		missedTurns: number;
		pendingLeave: boolean;
	}

	interface PokerWinner {
		userId: number;
		username: string;
		amountChips: number;
		handLabel?: string;
	}

	interface PokerState {
		lobbyId: string;
		isPrivate: boolean;
		privateCode?: string;
		maxPlayers: number;
		smallBlindChips: number;
		bigBlindChips: number;
		minBuyInChips: number;
		maxBuyInChips: number;
		status: Street;
		board: string[];
		players: Array<PokerPlayer | null>;
		dealerSeat: number;
		currentTurnSeat: number | null;
		highestBetChips: number;
		actionDueAt: number | null;
		handNumber: number;
		potChips: number;
		recentWinners: PokerWinner[];
	}

	interface LobbySummary {
		lobbyId: string;
		playerCount: number;
		maxPlayers: number;
		smallBlind: number;
		bigBlind: number;
		minBuyIn: number;
		maxBuyIn: number;
		status: Street;
	}

	interface PokerChatMessage {
		id: string;
		lobbyId: string;
		userId: number;
		username: string;
		image: string | null;
		text: string;
		timestamp: number;
	}

	export let balance: number;
	export let onBalanceUpdate: ((newBalance: number) => void) | undefined = undefined;

	let lobbies: LobbySummary[] = [];
	let loadingLobbies = false;
	let working = false;

	let lobbyId = '';
	let pokerState: PokerState | null = null;
	let privateCodeInput = '';
	let buyInAmount = 500;
	let raiseToAmount = 0;

	let createMaxPlayers = 6;
	let createSmallBlind = 5;
	let createBigBlind = 10;
	let createMinBuyIn = 500;
	let createMaxBuyIn = 3000;

	let subscribedLobbyId = '';
	let chatMessages: PokerChatMessage[] = [];
	let chatInput = '';
	let sendingChat = false;

	const quickTables = [
		{ label: '$5/$10', smallBlind: 5, bigBlind: 10, minBuyIn: 500, maxBuyIn: 3000, buyIn: 1000 },
		{ label: '$10/$20', smallBlind: 10, bigBlind: 20, minBuyIn: 1000, maxBuyIn: 6000, buyIn: 2000 },
		{ label: '$25/$50', smallBlind: 25, bigBlind: 50, minBuyIn: 2500, maxBuyIn: 15000, buyIn: 5000 }
	];

	const chipsToAmount = (chips: number) => chips / 100000000;

	let selfSeat = -1;
	let selfPlayer: PokerPlayer | null = null;
	let isMyTurn = false;
	let toCall = 0;
	let minRaiseTo = 0;
	let isSpectator = false;

	$: selfSeat =
		pokerState && $USER_DATA
			? pokerState.players.findIndex((player: PokerPlayer | null) => player?.userId === Number($USER_DATA.id))
			: -1;
	$: selfPlayer = pokerState && selfSeat >= 0 ? pokerState.players[selfSeat] : null;
	$: isMyTurn = pokerState && selfSeat >= 0 ? pokerState.currentTurnSeat === selfSeat : false;
	$: toCall = pokerState && selfPlayer ? Math.max(0, chipsToAmount(pokerState.highestBetChips - selfPlayer.currentBetChips)) : 0;
	$: minRaiseTo = pokerState ? chipsToAmount(pokerState.highestBetChips + pokerState.bigBlindChips) : 0;
	$: isSpectator = !!pokerState && selfSeat < 0;

	async function loadPublicLobbies() {
		loadingLobbies = true;
		try {
			const res = await fetch('/api/arcade/poker/lobbies');
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || 'Failed to load lobbies');
			lobbies = data.lobbies ?? [];
		} catch (error) {
			console.error(error);
		} finally {
			loadingLobbies = false;
		}
	}

	async function refreshState() {
		if (!lobbyId) return;
		try {
			const res = await fetch(`/api/arcade/poker/state?lobbyId=${encodeURIComponent(lobbyId)}`);
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || 'Failed to refresh state');
			pokerState = data.state;
			if (pokerState) {
				raiseToAmount = Math.max(minRaiseTo, chipsToAmount(pokerState.highestBetChips + pokerState.bigBlindChips));
			}
		} catch (error) {
			console.error(error);
		}
	}

	async function loadChat() {
		if (!lobbyId) return;
		try {
			const res = await fetch(`/api/arcade/poker/chat?lobbyId=${encodeURIComponent(lobbyId)}`);
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || 'Failed to load chat');
			chatMessages = data.messages ?? [];
		} catch (error) {
			console.error(error);
		}
	}

	function handleIncomingChat(message: PokerChatMessage) {
		chatMessages = [...chatMessages.slice(-49), message];
	}

	function setLobbySubscription(nextLobbyId: string) {
		if (subscribedLobbyId) {
			websocketController.unsubscribeFromPokerLobby(subscribedLobbyId);
			websocketController.unsubscribeFromPokerChat(subscribedLobbyId);
			subscribedLobbyId = '';
		}

		if (nextLobbyId) {
			subscribedLobbyId = nextLobbyId;
			websocketController.subscribeToPokerLobby(nextLobbyId, refreshState);
			websocketController.subscribeToPokerChat(nextLobbyId, handleIncomingChat);
		}
	}

	function applyJoinedState(data: any) {
		lobbyId = data.lobbyId;
		pokerState = data.state;
		if (typeof data.newBalance === 'number') {
			balance = data.newBalance;
			onBalanceUpdate?.(data.newBalance);
		}
		setLobbySubscription(lobbyId);
		void loadChat();
	}

	async function quickMatch(table: typeof quickTables[number]) {
		working = true;
		try {
			const res = await fetch('/api/arcade/poker/matchmake', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					maxPlayers: 6,
					smallBlind: table.smallBlind,
					bigBlind: table.bigBlind,
					minBuyIn: table.minBuyIn,
					maxBuyIn: table.maxBuyIn,
					buyInAmount: table.buyIn
				})
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || 'Failed to join poker table');
			applyJoinedState(data);
		} catch (error) {
			toast.error('Poker join failed', { description: error instanceof Error ? error.message : 'Unknown error' });
		} finally {
			working = false;
			loadPublicLobbies();
		}
	}

	async function createPrivate() {
		working = true;
		try {
			const res = await fetch('/api/arcade/poker/create-private', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					maxPlayers: createMaxPlayers,
					smallBlind: createSmallBlind,
					bigBlind: createBigBlind,
					minBuyIn: createMinBuyIn,
					maxBuyIn: createMaxBuyIn,
					buyInAmount
				})
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || 'Failed to create private table');
			applyJoinedState(data);
		} catch (error) {
			toast.error('Create private table failed', { description: error instanceof Error ? error.message : 'Unknown error' });
		} finally {
			working = false;
		}
	}

	async function joinByCode() {
		if (!privateCodeInput.trim()) {
			toast.error('Enter a private code');
			return;
		}

		working = true;
		try {
			const res = await fetch('/api/arcade/poker/join', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ privateCode: privateCodeInput.trim().toUpperCase(), buyInAmount })
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || 'Failed to join private table');
			applyJoinedState(data);
		} catch (error) {
			toast.error('Private table join failed', { description: error instanceof Error ? error.message : 'Unknown error' });
		} finally {
			working = false;
		}
	}

	async function spectateByCode() {
		if (!privateCodeInput.trim()) {
			toast.error('Enter a private code');
			return;
		}

		working = true;
		try {
			const res = await fetch(`/api/arcade/poker/state?privateCode=${encodeURIComponent(privateCodeInput.trim().toUpperCase())}`);
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || 'Failed to spectate private table');
			lobbyId = data.state.lobbyId;
			pokerState = data.state;
			setLobbySubscription(lobbyId);
			await loadChat();
		} catch (error) {
			toast.error('Spectate failed', { description: error instanceof Error ? error.message : 'Unknown error' });
		} finally {
			working = false;
		}
	}

	async function joinPublic(lobby: LobbySummary) {
		working = true;
		try {
			const res = await fetch('/api/arcade/poker/join', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ lobbyId: lobby.lobbyId, buyInAmount })
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || 'Failed to join table');
			applyJoinedState(data);
		} catch (error) {
			toast.error('Public table join failed', { description: error instanceof Error ? error.message : 'Unknown error' });
		} finally {
			working = false;
			loadPublicLobbies();
		}
	}

	async function spectateLobby(targetLobbyId: string) {
		working = true;
		try {
			const res = await fetch(`/api/arcade/poker/state?lobbyId=${encodeURIComponent(targetLobbyId)}`);
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || 'Failed to spectate table');
			lobbyId = data.state.lobbyId;
			pokerState = data.state;
			setLobbySubscription(lobbyId);
			await loadChat();
		} catch (error) {
			toast.error('Spectate failed', { description: error instanceof Error ? error.message : 'Unknown error' });
		} finally {
			working = false;
		}
	}

	async function joinAsPlayerFromSpectator() {
		if (!lobbyId) return;
		working = true;
		try {
			const res = await fetch('/api/arcade/poker/join', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ lobbyId, buyInAmount })
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || 'Failed to buy in');
			applyJoinedState(data);
		} catch (error) {
			toast.error('Buy-in failed', { description: error instanceof Error ? error.message : 'Unknown error' });
		} finally {
			working = false;
		}
	}

	async function act(action: 'fold' | 'check' | 'call' | 'raise' | 'all_in') {
		if (!pokerState) return;
		working = true;
		try {
			const payload: Record<string, unknown> = { lobbyId: pokerState.lobbyId, action };
			if (action === 'raise') {
				payload.amount = raiseToAmount;
			}

			const res = await fetch('/api/arcade/poker/action', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || 'Failed action');
			pokerState = data.state;
		} catch (error) {
			toast.error('Action failed', { description: error instanceof Error ? error.message : 'Unknown error' });
		} finally {
			working = false;
		}
	}

	async function leaveCurrentLobby() {
		if (!lobbyId) return;
		working = true;
		try {
			const res = await fetch('/api/arcade/poker/leave', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ lobbyId })
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || 'Failed to leave table');

			if (typeof data.newBalance === 'number') {
				balance = data.newBalance;
				onBalanceUpdate?.(data.newBalance);
			}

			pokerState = null;
			lobbyId = '';
			chatMessages = [];
			setLobbySubscription('');
			await loadPublicLobbies();
		} catch (error) {
			toast.error('Leave failed', { description: error instanceof Error ? error.message : 'Unknown error' });
		} finally {
			working = false;
		}
	}

	async function sendChat() {
		const text = chatInput.trim();
		if (!text || !lobbyId) return;
		sendingChat = true;
		try {
			const res = await fetch('/api/arcade/poker/chat', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ lobbyId, text })
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || 'Failed to send message');
			chatInput = '';
		} catch (error) {
			toast.error('Chat failed', { description: error instanceof Error ? error.message : 'Unknown error' });
		} finally {
			sendingChat = false;
		}
	}

	onMount(() => {
		loadPublicLobbies();
	});

	onDestroy(() => {
		setLobbySubscription('');
	});
</script>

<Card>
	<CardHeader>
		<CardTitle>Poker</CardTitle>
		<CardDescription>No-limit Texas Hold'em with public and private lobbies.</CardDescription>
	</CardHeader>
	<CardContent>
		<div class="mb-4 flex flex-wrap items-end gap-3">
			<div>
				<label for="poker-buyin" class="mb-1 block text-xs">Buy-in</label>
				<Input id="poker-buyin" type="number" min="1" bind:value={buyInAmount} class="w-32" />
			</div>
			<div class="text-muted-foreground text-sm">Balance: {formatValue(balance)}</div>
		</div>

		{#if !pokerState}
			<div class="space-y-5">
				<div>
					<h3 class="mb-2 text-sm font-semibold">Quick Play</h3>
					<div class="flex flex-wrap gap-2">
						{#each quickTables as table}
							<Button disabled={working} onclick={() => quickMatch(table)}>{table.label}</Button>
						{/each}
					</div>
				</div>

				<div class="grid gap-4 md:grid-cols-2">
					<div class="rounded-lg border p-3">
						<h3 class="mb-2 text-sm font-semibold">Create Private Table</h3>
						<div class="grid grid-cols-2 gap-2 text-sm">
							<Input type="number" bind:value={createSmallBlind} placeholder="SB" />
							<Input type="number" bind:value={createBigBlind} placeholder="BB" />
							<Input type="number" bind:value={createMinBuyIn} placeholder="Min buy-in" />
							<Input type="number" bind:value={createMaxBuyIn} placeholder="Max buy-in" />
						</div>
						<div class="mt-2 flex items-center gap-2">
							<label for="poker-seats" class="text-xs">Seats</label>
							<Input id="poker-seats" type="number" bind:value={createMaxPlayers} min="2" max="9" class="w-20" />
							<Button disabled={working} onclick={createPrivate}>Create</Button>
						</div>
					</div>

					<div class="rounded-lg border p-3">
						<h3 class="mb-2 text-sm font-semibold">Join Private Table</h3>
						<div class="flex gap-2">
							<Input bind:value={privateCodeInput} placeholder="Enter code" />
							<Button disabled={working} onclick={joinByCode}>Join</Button>
							<Button variant="outline" disabled={working} onclick={spectateByCode}>Watch</Button>
						</div>
					</div>
				</div>

				<div>
					<div class="mb-2 flex items-center justify-between">
						<h3 class="text-sm font-semibold">Public Lobbies</h3>
						<Button variant="outline" size="sm" disabled={loadingLobbies} onclick={loadPublicLobbies}>Refresh</Button>
					</div>
					<div class="space-y-2">
						{#if loadingLobbies}
							<div class="text-muted-foreground text-sm">Loading...</div>
						{:else if lobbies.length === 0}
							<div class="text-muted-foreground text-sm">No public tables yet.</div>
						{:else}
							{#each lobbies as lobby}
								<div class="flex items-center justify-between rounded-lg border p-3">
									<div class="text-sm">
										<div class="font-medium">{formatValue(lobby.smallBlind)}/{formatValue(lobby.bigBlind)} - {lobby.playerCount}/{lobby.maxPlayers}</div>
										<div class="text-muted-foreground">Buy-in: {formatValue(lobby.minBuyIn)} - {formatValue(lobby.maxBuyIn)} - {lobby.status}</div>
									</div>
									<div class="flex gap-2">
										<Button disabled={working || lobby.playerCount >= lobby.maxPlayers} onclick={() => joinPublic(lobby)}>Join</Button>
										<Button variant="outline" disabled={working} onclick={() => spectateLobby(lobby.lobbyId)}>Watch</Button>
									</div>
								</div>
							{/each}
						{/if}
					</div>
				</div>
			</div>
		{:else}
			<div class="space-y-4">
				<div class="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
					<div class="text-sm">
						<div class="font-semibold">Lobby {pokerState.lobbyId}</div>
						<div class="text-muted-foreground">
							{formatValue(chipsToAmount(pokerState.smallBlindChips))}/{formatValue(chipsToAmount(pokerState.bigBlindChips))}
							- Hand #{pokerState.handNumber}
							{#if pokerState.privateCode}- Code {pokerState.privateCode}{/if}
							{#if isSpectator}- Spectating{/if}
						</div>
					</div>
					<div class="text-right text-sm">
						<div class="font-semibold">Pot {formatValue(chipsToAmount(pokerState.potChips))}</div>
						<div class="text-muted-foreground">Street: {pokerState.status}</div>
					</div>
					<Button variant="destructive" disabled={working} onclick={leaveCurrentLobby}>Leave</Button>
				</div>

				<div class="rounded-xl border bg-green-900/15 p-4">
					<div class="mb-3 flex justify-center gap-2">
						{#each pokerState.board as card}
							<div class="poker-card w-12 rounded border bg-background p-2 text-center text-sm font-semibold" in:scale={{ start: 0.65, duration: 180 }}>{card}</div>
						{/each}
						{#if pokerState.board.length === 0}
							<div class="text-muted-foreground text-sm">Waiting for cards...</div>
						{/if}
					</div>

					<div class="grid gap-2 md:grid-cols-3">
						{#each pokerState.players as player, seat}
							<div class="rounded-lg border bg-background/70 p-2 text-xs {pokerState.currentTurnSeat === seat ? 'ring-primary ring-2 current-turn' : ''}">
								{#if player}
									<div class="mb-1 flex items-center justify-between">
										<div class="font-semibold">{player.username}</div>
										<div class="text-muted-foreground">Seat {seat + 1}</div>
									</div>
									<div>Stack: {formatValue(chipsToAmount(player.stackChips))}</div>
									<div>Bet: {formatValue(chipsToAmount(player.currentBetChips))}</div>
									<div class="text-muted-foreground">{player.status}</div>
									<div class="mt-1 flex gap-1">
										{#each player.cards as card}
											<div class="poker-card w-8 rounded border bg-background p-1 text-center" in:fly={{ y: 8, duration: 140 }}>{card}</div>
										{/each}
									</div>
								{:else}
									<div class="text-muted-foreground">Empty seat</div>
								{/if}
							</div>
						{/each}
					</div>
				</div>

				{#if pokerState.recentWinners?.length}
					<div class="rounded-lg border p-3 text-sm">
						<div class="mb-1 font-semibold">Last Pot</div>
						{#each pokerState.recentWinners as winner}
							<div class="text-muted-foreground">
								{winner.username} won {formatValue(chipsToAmount(winner.amountChips))}
								{#if winner.handLabel}({winner.handLabel}){/if}
							</div>
						{/each}
					</div>
				{/if}

				<div class="rounded-lg border p-3">
					<div class="mb-2 text-sm font-semibold">Actions</div>
					{#if isSpectator}
						<div class="mb-2 text-muted-foreground text-sm">You are spectating this table.</div>
						<Button disabled={working} onclick={joinAsPlayerFromSpectator}>Buy In & Join</Button>
					{:else if !isMyTurn}
						<div class="text-muted-foreground text-sm">Waiting for your turn...</div>
					{:else}
						<div class="mb-2 text-sm">To call: <span class="font-semibold">{formatValue(toCall)}</span></div>
						<div class="mb-2 flex flex-wrap gap-2">
							<Button disabled={working} onclick={() => act('fold')}>Fold</Button>
							<Button disabled={working || toCall > 0} onclick={() => act('check')}>Check</Button>
							<Button disabled={working || toCall <= 0} onclick={() => act('call')}>Call {formatValue(toCall)}</Button>
							<Button disabled={working} onclick={() => act('all_in')}>All-in</Button>
						</div>
						<div class="flex flex-wrap items-center gap-2">
							<Input type="number" min={minRaiseTo} bind:value={raiseToAmount} class="w-36" />
							<Button disabled={working} onclick={() => act('raise')}>Raise To</Button>
							<span class="text-muted-foreground text-xs">Min: {formatValue(minRaiseTo)}</span>
						</div>
					{/if}
				</div>

				<div class="rounded-lg border p-3">
					<div class="mb-2 text-sm font-semibold">Table Chat</div>
					<div class="bg-muted/30 mb-2 max-h-52 space-y-1 overflow-y-auto rounded p-2 text-xs">
						{#if chatMessages.length === 0}
							<div class="text-muted-foreground">No messages yet.</div>
						{:else}
							{#each chatMessages as message (message.id)}
								<div><span class="font-semibold">{message.username}:</span> {message.text}</div>
							{/each}
						{/if}
					</div>
					<div class="flex gap-2">
						<Input bind:value={chatInput} maxlength={240} placeholder="Type a message..." onkeydown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendChat())} />
						<Button disabled={sendingChat || !chatInput.trim()} onclick={sendChat}>Send</Button>
					</div>
				</div>
			</div>
		{/if}
	</CardContent>
</Card>

<style>
	.poker-card {
		animation: card-deal 140ms ease-out;
	}

	.current-turn {
		animation: turn-pulse 1s ease-in-out infinite;
	}

	@keyframes card-deal {
		from {
			transform: translateY(6px) scale(0.96);
			opacity: 0.75;
		}
		to {
			transform: translateY(0) scale(1);
			opacity: 1;
		}
	}

	@keyframes turn-pulse {
		0%,
		100% {
			box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.35);
		}
		50% {
			box-shadow: 0 0 0 8px rgba(34, 197, 94, 0);
		}
	}
</style>
