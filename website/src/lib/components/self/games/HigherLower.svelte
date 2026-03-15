<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle
	} from '$lib/components/ui/card';
	import confetti from 'canvas-confetti';
	import { toast } from 'svelte-sonner';
	import { formatValue, playSound, showConfetti, showSchoolPrideCannons } from '$lib/utils';
	import { volumeSettings } from '$lib/stores/volume-settings';
	import { onMount } from 'svelte';
	import { fetchPortfolioSummary } from '$lib/stores/portfolio-data';
	import { haptic } from '$lib/stores/haptics';

	interface higherLowerResult {
		won: boolean;
		number: number;
		hiddenNumber: number;
		result: 'higher' | 'lower' | 'exact';
		newBalance: number;
		payout: number;
		amountWagered: number;
	}

	interface higherLowerStartResult {
		sessionToken: any;
		newBalance: number;
		number: number;
	}

	const MAX_BET_AMOUNT = 1000000;

	let {
		balance = $bindable(),
		onBalanceUpdate
	}: {
		balance: number;
		onBalanceUpdate?: (newBalance: number) => void;
	} = $props();

	let betAmount = $state(10);
	let betAmountDisplay = $state('10');
	let isPlaying = $state(false);
	let lastResult = $state<higherLowerResult | null>(null);
	let activeSoundTimeouts = $state<NodeJS.Timeout[]>([]);
	let diceElement: HTMLElement | null = null;
	let numberElement: HTMLElement | null = null;

	let sessionToken = $state<string | null>(null);
	let revealing = $state(false);

	let canBet = $derived(
		betAmount > 0 && betAmount <= balance && betAmount <= MAX_BET_AMOUNT && !isPlaying
	);

	function setBetAmount(amount: number) {
		const clampedAmount = Math.min(amount, Math.min(balance, MAX_BET_AMOUNT));
		if (clampedAmount >= 0) {
			betAmount = clampedAmount;
			betAmountDisplay = clampedAmount.toLocaleString();
		}
	}

	function handleBetAmountInput(event: Event) {
		const target = event.target as HTMLInputElement;
		const value = target.value.replace(/,/g, '');
		const numValue = parseFloat(value) || 0;
		const clampedValue = Math.min(numValue, Math.min(balance, MAX_BET_AMOUNT));

		betAmount = clampedValue;
		betAmountDisplay = target.value;
	}

	function handleBetAmountBlur() {
		betAmountDisplay = betAmount.toLocaleString();
	}

	async function guess(guess: 'higher' | 'lower' | 'exact') {
		if (!isPlaying || !sessionToken || revealing) return;
		haptic.trigger('selection');
		revealing = true;
		try {
			const response = await fetch('/api/arcade/higherlower', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					action: 'end',
					guess: guess,
					sessionToken: sessionToken
				})
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || 'Failed to place bet');
			}

			const resultData: higherLowerResult = await response.json();

			balance = resultData.newBalance;
			lastResult = resultData;
			onBalanceUpdate?.(resultData.newBalance);

			if (resultData.won) {
				haptic.trigger('success');
				showConfetti(confetti);
				if (resultData.result == 'exact') {
					showSchoolPrideCannons(confetti);
				}
			} else {
				haptic.trigger('error');
				playSound('lose');
			}
			isPlaying = false;
			revealing = false;
			console.log(lastResult);
		} catch (error) {
			console.error('Number roll error:', error);
			haptic.trigger('error');
			toast.error('Roll failed', {
				description: error instanceof Error ? error.message : 'Unknown error occurred'
			});
			activeSoundTimeouts.forEach(clearTimeout);
			activeSoundTimeouts = [];
			revealing = false;
		}
	}

	async function startGame() {
		if (!canBet) return;

		balance -= betAmount;
		onBalanceUpdate?.(balance);

		isPlaying = true;
		lastResult = null;

		activeSoundTimeouts.forEach(clearTimeout);
		activeSoundTimeouts = [];

		try {
			const response = await fetch('/api/arcade/higherlower', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					action: 'start',
					amount: betAmount
				})
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || 'Failed to place bet');
			}

			const resultData: higherLowerStartResult = await response.json();

			playSound('flip');

			if (numberElement) {
				numberElement.innerText = resultData.number.toString();
			}

			sessionToken = resultData.sessionToken;
		} catch (error) {
			console.error('Number roll error:', error);
			haptic.trigger('error');
			toast.error('Roll failed', {
				description: error instanceof Error ? error.message : 'Unknown error occurred'
			});
			isPlaying = false;
			activeSoundTimeouts.forEach(clearTimeout);
			activeSoundTimeouts = [];
		}
	}

	onMount(async () => {
		volumeSettings.load();

		try {
			const data = await fetchPortfolioSummary();
			if (data) {
				balance = data.baseCurrencyBalance;
				onBalanceUpdate?.(data.baseCurrencyBalance);
			}
		} catch (error) {
			console.error('Failed to fetch balance:', error);
		}
	});
</script>

<Card>
	<CardHeader>
		<CardTitle>Higher/Lower</CardTitle>
		<CardDescription>Guess if the next number will be higher or lower!</CardDescription>
	</CardHeader>
	<CardContent>
		<div class="grid grid-cols-1 gap-8 md:grid-cols-2">
			<div class="flex flex-col space-y-4">
				<div class="text-center">
					<p class="text-muted-foreground text-sm">Balance</p>
					<p class="text-2xl font-bold">{formatValue(balance)}</p>
				</div>

				<div class="flex flex-1 items-center justify-center">
					<div class="dice-container">
						<div class="dice" bind:this={diceElement}>
							<div class="face">
								<p bind:this={numberElement}></p>
							</div>
						</div>
					</div>
				</div>

				<div class="flex items-center justify-center text-center">
					{#if lastResult && !isPlaying}
						<div class="bg-muted/50 w-full rounded-lg p-3">
							{#if lastResult.won}
								<p class="text-success font-semibold">WIN</p>
								<p class="text-sm">
									Won {formatValue(lastResult.payout)}
									<br />
									The number was {lastResult.hiddenNumber}
								</p>
							{:else}
								<p class="text-destructive font-semibold">LOSS</p>
								<p class="text-sm">
									Lost {formatValue(lastResult.amountWagered)}
									<br />
									The number was {lastResult.hiddenNumber}
								</p>
							{/if}
						</div>
					{/if}
				</div>
			</div>

			<div class="space-y-4">
				{#if isPlaying}
					<div>
						<div class="mb-2 block text-sm font-medium">The hidden number is...</div>
						<div class="grid grid-cols-3 gap-2">
							<Button
								variant={'outline'}
								onclick={function () {
									guess('lower');
								}}
								disabled={!isPlaying}>Lower</Button
							>
							<Button
								variant={'outline'}
								onclick={function () {
									guess('higher');
								}}
								disabled={!isPlaying}>Higher</Button
							>
							<Button
								variant={'outline'}
								onclick={function () {
									guess('exact');
								}}
								disabled={!isPlaying}>Exact</Button
							>
						</div>
						<div class="mb-2 block text-sm font-medium">than the shown number</div>
					</div>
				{/if}

				<div>
					<label for="bet-amount" class="mb-2 block text-sm font-medium">Bet Amount</label>
					<Input
						id="bet-amount"
						type="text"
						value={betAmountDisplay}
						oninput={handleBetAmountInput}
						onblur={handleBetAmountBlur}
						disabled={isPlaying}
						placeholder="Enter bet amount"
					/>
					<p class="text-muted-foreground mt-1 text-xs">
						Max bet: {MAX_BET_AMOUNT.toLocaleString()}
					</p>
				</div>

				<div>
					<div class="grid grid-cols-4 gap-2">
						<Button
							size="sm"
							variant="outline"
							onclick={() =>
								setBetAmount(Math.floor(Math.min(balance || 0, MAX_BET_AMOUNT) * 0.25))}
							disabled={isPlaying}>25%</Button
						>
						<Button
							size="sm"
							variant="outline"
							onclick={() => setBetAmount(Math.floor(Math.min(balance || 0, MAX_BET_AMOUNT) * 0.5))}
							disabled={isPlaying}>50%</Button
						>
						<Button
							size="sm"
							variant="outline"
							onclick={() =>
								setBetAmount(Math.floor(Math.min(balance || 0, MAX_BET_AMOUNT) * 0.75))}
							disabled={isPlaying}>75%</Button
						>
						<Button
							size="sm"
							variant="outline"
							onclick={() => setBetAmount(Math.floor(Math.min(balance || 0, MAX_BET_AMOUNT)))}
							disabled={isPlaying}>Max</Button
						>
					</div>
				</div>

				<Button class="h-12 w-full text-lg" onclick={startGame} disabled={!canBet}>
					{isPlaying ? 'Playing...' : 'Start Game'}
				</Button>
			</div>
		</div>
	</CardContent>
</Card>

<style>
	.dice {
		width: 150px;
		height: 150px;
		transform-style: preserve-3d;
		transition: transform 4s cubic-bezier(0.1, 0.9, 0.1, 1);
	}

	.face {
		position: absolute;
		width: 150px;
		height: 150px;
		background: #fff;
		color: black;
		border: 2px solid #363131;
		border-radius: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		backface-visibility: hidden;
		box-sizing: border-box;
		font-size: 64px;
	}
</style>
