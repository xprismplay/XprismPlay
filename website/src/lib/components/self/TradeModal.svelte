<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Badge } from '$lib/components/ui/badge';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import {
		TradeUpIcon,
		TradeDownIcon,
		Loading03Icon,
		Coins01Icon,
		Dollar02Icon
	} from '@hugeicons/core-free-icons';
	import { PORTFOLIO_SUMMARY } from '$lib/stores/portfolio-data';
	import { toast } from 'svelte-sonner';
	import { haptic } from '$lib/stores/haptics';

	let {
		open = $bindable(false),
		type, // Upgraded Type Definitions
		coin,
		userHolding = 0,
		userStaked = 0, // New reactive state input to reference current staking allocations
		onSuccess
	} = $props<{
		open?: boolean;
		type: 'BUY' | 'SELL' | 'BURN' | 'STAKE' | 'UNSTAKE';
		coin: any;
		userHolding?: number;
		userStaked?: number;
		onSuccess?: () => void;
	}>();

	let amount = $state('');
	let loading = $state(false);
	let sellByDollar = $state(false);

	let numericAmount = $derived(parseFloat(amount) || 0);
	let currentPrice = $derived(coin.currentPrice || 0);

	let maxSellableAmount = $derived(
		type === 'SELL' && coin
			? Math.min(userHolding, Math.floor(Number(coin.poolCoinAmount) * 0.995))
			: userHolding
	);

	let effectiveSellCoinAmount = $derived(() => {
		if (type !== 'SELL' || !sellByDollar || numericAmount <= 0) return numericAmount;
		const poolCoin = Number(coin.poolCoinAmount);
		const poolBase = Number(coin.poolBaseCurrencyAmount);
		if (poolCoin <= 0 || poolBase <= 0) return 0;
		const k = poolCoin * poolBase;

		const targetBase = poolBase - numericAmount;
		if (targetBase <= 0) return maxSellableAmount;
		const requiredCoins = k / targetBase - poolCoin;
		return Math.max(0, requiredCoins);
	});

	let estimatedResult = $derived(
		sellByDollar && type === 'SELL'
			? calculateEstimate(effectiveSellCoinAmount(), type, currentPrice)
			: calculateEstimate(numericAmount, type, currentPrice)
	);

	let hasValidAmount = $derived(numericAmount > 0);
	let userBalance = $derived($PORTFOLIO_SUMMARY ? $PORTFOLIO_SUMMARY.baseCurrencyBalance : 0);

	// Dynamic constraint logic mapping across all platform wallet mechanics
	let hasEnoughFunds = $derived(() => {
		if (type === 'BUY') return numericAmount <= userBalance;
		if (type === 'STAKE') return numericAmount <= userHolding;
		if (type === 'UNSTAKE') return numericAmount <= userStaked;
		if (type === 'BURN') return numericAmount <= userHolding;
		if (sellByDollar) return effectiveSellCoinAmount() <= userHolding;
		return numericAmount <= userHolding;
	});

	let canTrade = $derived(hasValidAmount && hasEnoughFunds() && !loading);

	function calculateEstimate(amount: number, tradeType: string, price: number) {
		if (!amount || !price || !coin || ['STAKE', 'UNSTAKE', 'BURN'].includes(tradeType))
			return { result: 0 };
		const poolCoin = Number(coin.poolCoinAmount);
		const poolBase = Number(coin.poolBaseCurrencyAmount);

		if (poolCoin <= 0 || poolBase <= 0) return { result: 0 };
		const k = poolCoin * poolBase;

		if (tradeType === 'BUY') {
			const newPoolBase = poolBase + amount;
			const newPoolCoin = k / newPoolBase;
			return { result: poolCoin - newPoolCoin };
		} else {
			const newPoolCoin = poolCoin + amount;
			const newPoolBase = k / newPoolCoin;
			return { result: poolBase - newPoolBase };
		}
	}

	function handleClose() {
		open = false;
		amount = '';
		loading = false;
		sellByDollar = false;
	}

	async function handleTrade() {
		if (!canTrade) return;
		loading = true;

		// Dynamically fork the route and structure parameters depending on context action
		const isStakingAction = ['STAKE', 'UNSTAKE'].includes(type);
		const targetUrl = isStakingAction
			? `/api/coin/${coin.symbol}/stake`
			: `/api/coin/${coin.symbol}/trade`;
		const tradeAmount = type === 'SELL' && sellByDollar ? effectiveSellCoinAmount() : numericAmount;

		try {
			const response = await fetch(targetUrl, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ type, amount: tradeAmount })
			});

			const result = await response.json();
			if (!response.ok) throw new Error(result.message || 'Transaction context failed');

			haptic.trigger('success');

			// Dynamic visual feedback notifications matching your exact system structures
			const actionLabels = {
				BUY: 'Bought',
				SELL: 'Sold',
				BURN: 'Burned',
				STAKE: 'Staked',
				UNSTAKE: 'Unstaked'
			};
			const descriptions = {
				BUY: `Purchased ${result.coinsBought?.toFixed(6)} ${coin.symbol} for $${result.totalCost?.toFixed(6)}`,
				SELL: `Sold ${result.coinsSold?.toFixed(6)} ${coin.symbol} for $${result.totalReceived?.toFixed(6)}`,
				BURN: `Burned ${result.coinsBurned?.toFixed(6)} ${coin.symbol}`,
				STAKE: `Deposited ${amount} ${coin.symbol} into the compounding yield pool.`,
				UNSTAKE: `Withdrew ${amount} ${coin.symbol} back to active balance wallet.`
			};

			toast.success(`${actionLabels[type]} successfully!`, {
				description: descriptions[type]
			});

			onSuccess?.();
			handleClose();
		} catch (e) {
			haptic.trigger('error');
			toast.error('Transaction processing halted', {
				description: (e as Error).message
			});
		} finally {
			loading = false;
		}
	}

	function setMaxAmount() {
		if (type === 'SELL') {
			if (sellByDollar) {
				const est = calculateEstimate(maxSellableAmount, 'SELL', currentPrice);
				amount = (Math.floor(est.result * 100) / 100).toFixed(2);
			} else {
				amount = maxSellableAmount.toString();
			}
		} else if (type === 'BURN') {
			amount = userHolding.toString();
		} else if (type === 'STAKE') {
			amount = userHolding.toString();
		} else if (type === 'UNSTAKE') {
			amount = userStaked.toString();
		} else if ($PORTFOLIO_SUMMARY) {
			amount = userBalance.toString();
		}
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title class="flex items-center gap-2">
				{#if type === 'BUY'}
					<HugeiconsIcon icon={TradeUpIcon} class="h-5 w-5 text-green-500" />
					Buy {coin.symbol}
				{:else if type === 'STAKE'}
					<HugeiconsIcon icon={TradeUpIcon} class="h-5 w-5 text-indigo-500" />
					Stake {coin.symbol}
				{:else if type === 'SELL'}
					<HugeiconsIcon icon={TradeDownIcon} class="h-5 w-5 text-red-500" />
					Sell {coin.symbol}
				{:else if type === 'UNSTAKE'}
					<HugeiconsIcon icon={TradeDownIcon} class="h-5 w-5 text-amber-500" />
					Unstake {coin.symbol}
				{:else}
					<HugeiconsIcon icon={TradeDownIcon} class="h-5 w-5 text-red-500" />
					Burn {coin.symbol}
				{/if}
			</Dialog.Title>
			<Dialog.Description>
				Current price: ${coin.currentPrice.toFixed(6)} per {coin.symbol}
			</Dialog.Description>
		</Dialog.Header>

		<div class="space-y-4">
			<div class="space-y-2">
				<Label for="amount">
					{#if type === 'BUY'}
						Amount to spend ($)
					{:else if type === 'STAKE'}
						Tokens to stake ({coin.symbol})
					{:else if type === 'UNSTAKE'}
						Tokens to unlock ({coin.symbol})
					{:else if sellByDollar}
						Dollar amount to receive ($)
					{:else}
						Amount ({coin.symbol})
					{/if}
				</Label>
				<div class="flex gap-2">
					<Input
						id="amount"
						type="number"
						step={type === 'BUY' || sellByDollar ? '0.01' : '1'}
						min="0"
						bind:value={amount}
						placeholder="0.00"
						class="flex-1"
					/>
					{#if type === 'SELL'}
						<Button
							variant="outline"
							size="icon"
							class="h-9 w-9 shrink-0"
							onclick={() => {
								haptic.trigger('selection');
								sellByDollar = !sellByDollar;
								amount = '';
							}}
						>
							{#key sellByDollar}
								<HugeiconsIcon icon={sellByDollar ? Dollar02Icon : Coins01Icon} class="h-4 w-4" />
							{/key}
						</Button>
					{/if}
					<Button variant="outline" size="sm" class="h-9 shrink-0" onclick={setMaxAmount}
						>Max</Button
					>
				</div>

				{#if type === 'SELL' || type === 'BURN' || type === 'STAKE'}
					<p class="text-muted-foreground text-xs">
						Available in wallet: {userHolding.toFixed(6)}
						{coin.symbol}
						{#if type === 'SELL' && maxSellableAmount < userHolding}
							<br />Max sellable: {maxSellableAmount.toFixed(0)} {coin.symbol} (pool limit)
						{/if}
					</p>
				{:else if type === 'UNSTAKE'}
					<p class="text-muted-foreground text-xs">
						Active Staked Deposit: {userStaked.toFixed(6)}
						{coin.symbol}
					</p>
				{:else if $PORTFOLIO_SUMMARY}
					<p class="text-muted-foreground text-xs">
						Balance: ${userBalance.toFixed(6)}
					</p>
				{/if}
			</div>

			{#if hasValidAmount && !['STAKE', 'UNSTAKE', 'BURN'].includes(type)}
				<div class="bg-muted/50 rounded-lg p-3">
					<div class="flex items-center justify-between">
						<span class="text-sm font-medium">
							{type === 'BUY'
								? `${coin.symbol} you'll get:`
								: sellByDollar
									? `${coin.symbol} to sell:`
									: "You'll receive:"}
						</span>
						<span class="font-bold">
							{#if type === 'BUY'}
								~{estimatedResult.result.toFixed(6)} {coin.symbol}
							{:else if sellByDollar}
								~{effectiveSellCoinAmount().toFixed(6)} {coin.symbol}
							{:else}
								~${estimatedResult.result.toFixed(6)}
							{/if}
						</span>
					</div>
					<p class="text-muted-foreground mt-1 text-xs">
						AMM estimation - includes slippage from pool impact
					</p>
				</div>
			{/if}

			{#if !hasEnoughFunds() && hasValidAmount}
				<Badge variant="destructive" class="text-xs">
					{type === 'BUY' ? 'Insufficient funds' : 'Insufficient coin allocation'}
				</Badge>
			{/if}
		</div>

		<Dialog.Footer class="flex gap-2">
			<Button variant="outline" onclick={handleClose} disabled={loading}>Cancel</Button>
			<Button
				onclick={handleTrade}
				disabled={!canTrade}
				variant={['BUY', 'STAKE'].includes(type) ? 'default' : 'destructive'}
			>
				{#if loading}
					<HugeiconsIcon icon={Loading03Icon} class="h-4 w-4 animate-spin" />
					Processing...
				{:else}
					{#if type === 'BUY'}Buy{:else if type === 'SELL'}Sell{:else if type === 'STAKE'}Stake{:else if type === 'UNSTAKE'}Unstake{:else}Burn{/if}
					{coin.symbol}
				{/if}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
