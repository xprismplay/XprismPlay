<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { Input } from '$lib/components/ui/input';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { Coins01Icon } from '@hugeicons/core-free-icons';
	import { formatValue } from '$lib/utils';

	interface Props {
		coin: {
			currentPrice: number;
			volume24h: number;
			circulatingSupply: number;
			initialSupply: number;
			marketCap: number;
		};
		userHolding?: number;
	}

	let { coin, userHolding = 0 }: Props = $props();

	const POOL_FEE_RATE = 0.003;
	const HOLDERS_SHARE_RATE = 0.5;

	let customBalance = $state('');

	let burnedCoins = $derived.by(() =>
		Math.max(0, Number(coin.initialSupply ?? 0) - Number(coin.circulatingSupply ?? 0))
	);

	let dailyTotalPayout = $derived.by(() => {
		const vol = Number(coin.volume24h ?? 0);
		if (!Number.isFinite(vol) || vol <= 0) return 0;
		return vol * POOL_FEE_RATE * HOLDERS_SHARE_RATE;
	});

	let holdingBalance = $derived.by(() => {
		const custom = Number(customBalance);
		return Number.isFinite(custom) && custom > 0 ? custom : Number(userHolding ?? 0);
	});

	let userPayouts = $derived.by(() => {
		const bal = holdingBalance;
		const supply = Number(coin.circulatingSupply ?? 0);
		const daily = dailyTotalPayout;

		if (bal <= 0 || supply <= 0 || daily <= 0) {
			return { daily: 0, weekly: 0, monthly: 0, sharePercent: 0 };
		}

		const share = bal / supply;
		const payout = daily * share;

		return {
			daily: payout,
			weekly: payout * 7,
			monthly: payout * 30,
			sharePercent: share * 100
		};
	});

	let hasPersonalEstimate = $derived.by(() => userHolding > 0 || Number(customBalance) > 0);

	function fmt(v: number): string {
		if (!Number.isFinite(v)) return '$0.00';
		if (v < 0.001) return `$${v.toFixed(8)}`;
		return formatValue(v);
	}
</script>

<Card.Root class="rounded-2xl">
	<Card.Header class="space-y-1 pb-3">
		<Card.Title class="flex items-center gap-2 text-base">
			<HugeiconsIcon icon={Coins01Icon} class="h-5 w-5 text-yellow-500" />
			Dividend Metrics
		</Card.Title>
		<Card.Description>Daily fees distributed to holders</Card.Description>
	</Card.Header>

	<Card.Content class="space-y-4">
		<div class="grid grid-cols-3 gap-2 text-sm">
			<div class="rounded-lg bg-muted/40 p-3">
				<p class="text-muted-foreground text-xs">Circulating</p>
				<p class="mt-1 font-mono font-medium">
					{coin.circulatingSupply.toLocaleString(undefined, { maximumFractionDigits: 0 })}
				</p>
			</div>

			<div class="rounded-lg bg-muted/40 p-3">
				<p class="text-muted-foreground text-xs">Burned</p>
				<p class="mt-1 font-mono font-medium text-orange-500">
					{burnedCoins.toLocaleString(undefined, { maximumFractionDigits: 0 })}
				</p>
			</div>

			<div class="rounded-lg bg-muted/40 p-3">
				<p class="text-muted-foreground text-xs">Daily</p>
				<p class="mt-1 font-mono font-medium text-green-500">{fmt(dailyTotalPayout)}</p>
			</div>
		</div>

		<div class="flex flex-wrap gap-2 text-xs">
			<Badge variant="outline">Fee 0.30%</Badge>
			<Badge variant="outline">Holder 50%</Badge>
		</div>

		{#if hasPersonalEstimate}
			<div class="rounded-lg border bg-background p-3">
				<div class="mb-2 flex items-center justify-between">
					<p class="text-sm font-medium">Your estimate</p>
					<span class="font-mono text-xs text-muted-foreground">
						{userPayouts.sharePercent.toFixed(4)}%
					</span>
				</div>

				<div class="grid grid-cols-3 gap-2 text-sm">
					<div>
						<p class="text-muted-foreground text-xs">Daily</p>
						<p class="font-mono text-green-500">{fmt(userPayouts.daily)}</p>
					</div>
					<div>
						<p class="text-muted-foreground text-xs">7d</p>
						<p class="font-mono text-green-500">{fmt(userPayouts.weekly)}</p>
					</div>
					<div>
						<p class="text-muted-foreground text-xs">30d</p>
						<p class="font-mono text-green-500">{fmt(userPayouts.monthly)}</p>
					</div>
				</div>
			</div>
		{/if}

		<div class="space-y-2">
			<p class="text-muted-foreground text-xs">Simulate with a custom balance</p>
			<Input
				type="number"
				min="0"
				placeholder="Enter coin amount…"
				bind:value={customBalance}
				class="h-9 text-sm"
			/>
		</div>

		{#if Number(customBalance) > 0}
			<div class="grid grid-cols-3 gap-2 text-sm">
				<div class="rounded-lg bg-muted/40 p-3">
					<p class="text-muted-foreground text-xs">Daily</p>
					<p class="mt-1 font-mono text-green-500">{fmt(userPayouts.daily)}</p>
				</div>
				<div class="rounded-lg bg-muted/40 p-3">
					<p class="text-muted-foreground text-xs">Weekly</p>
					<p class="mt-1 font-mono text-green-500">{fmt(userPayouts.weekly)}</p>
				</div>
				<div class="rounded-lg bg-muted/40 p-3">
					<p class="text-muted-foreground text-xs">Monthly</p>
					<p class="mt-1 font-mono text-green-500">{fmt(userPayouts.monthly)}</p>
				</div>
			</div>
		{/if}
	</Card.Content>
</Card.Root>