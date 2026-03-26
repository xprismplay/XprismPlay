<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import * as Card from '$lib/components/ui/card';
	import * as Table from '$lib/components/ui/table';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Badge } from '$lib/components/ui/badge';
	import { Separator } from '$lib/components/ui/separator';
	import SEO from '$lib/components/self/SEO.svelte';
	import SignInConfirmDialog from '$lib/components/self/SignInConfirmDialog.svelte';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import {
		Ticket01Icon,
		InformationCircleIcon,
		Refresh01Icon
	} from '@hugeicons/core-free-icons';
	import { USER_DATA } from '$lib/stores/user-data';
	import { fetchPortfolioSummary } from '$lib/stores/portfolio-data';
	import { toast } from 'svelte-sonner';
	import { formatValue } from '$lib/utils';
	import { _ } from 'svelte-i18n';

	let { data } = $props();

	let current = $state(data.current);
	let pastDraws = $state(data.history ?? []);
	let quantity = $state(1);
	let purchasing = $state(false);
	let shouldSignIn = $state(false);
	let refreshing = $state(false);
	let countdown = $state('--h --m --s');
	let timer: ReturnType<typeof setInterval> | null = null;

	function tick() {
		if (!current?.draw?.drawDate) return;
		const diff = new Date(current.draw.drawDate).getTime() - Date.now();
		if (diff <= 0) {
			countdown = '00h 00m 00s';
			return;
		}
		const h = Math.floor(diff / 3_600_000);
		const m = Math.floor((diff % 3_600_000) / 60_000);
		const s = Math.floor((diff % 60_000) / 1_000);
		countdown = `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
	}

	async function refresh() {
		refreshing = true;
		try {
			const [cr, hr] = await Promise.all([
				fetch('/api/lottery'),
				fetch('/api/lottery/history?limit=10')
			]);
			if (cr.ok) current = await cr.json();
			if (hr.ok) pastDraws = (await hr.json()).draws ?? [];
		} finally {
			refreshing = false;
		}
	}

	async function purchase() {
		if (!$USER_DATA) {
			shouldSignIn = true;
			return;
		}
		if (purchasing) return;
		const qty = Math.floor(Number(quantity));
		if (!Number.isInteger(qty) || qty < 1 || qty > 100) {
			toast.error($_('lottery.invalid_quantity'));
			return;
		}
		purchasing = true;
		try {
			const res = await fetch('/api/lottery/purchase', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ quantity: qty })
			});
			const result = await res.json();
			if (!res.ok) {
				toast.error(result.message || $_('lottery.purchase_failed'));
				return;
			}
			toast.success($_('lottery.purchased', { values: { n: quantity } }))
			await refresh();
			fetchPortfolioSummary();
		} catch {
			toast.error($_('lottery.purchase_failed'));
		} finally {
			purchasing = false;
		}
	}

	onMount(() => {
		tick();
		timer = setInterval(tick, 1000);
	});
	onDestroy(() => {
		if (timer) clearInterval(timer);
	});

	let draw = $derived(current?.draw);
	let pool = $derived(draw?.prizePool ?? 0);
	let winnerAmt = $derived(pool * 0.9);
	let bankAmt = $derived(pool * 0.1);
	let drawChancePct = $derived(draw ? (draw.drawChance * 100).toFixed(2) : '0.00');
	let perTicketPct = $derived(
		current?.chancePerTicket ? (current.chancePerTicket * 100).toFixed(4) : '0.0000'
	);
	let combinedPct = $derived(
		current?.userCombinedChance ? (current.userCombinedChance * 100).toFixed(2) : '0.00'
	);
	let userTickets = $derived(current?.userTickets ?? 0);
	let totalTickets = $derived(draw?.totalTickets ?? 0);
	let ticketPrice = $derived(current?.ticketPrice ?? 500);
	let totalCost = $derived(Math.max(1, Math.floor(Number(quantity))) * ticketPrice);

	let drawDateShort = $derived.by(() => {
		if (!draw?.drawDate) return '';
		return new Date(draw.drawDate)
			.toLocaleDateString('en-US', {
				month: 'short',
				day: 'numeric',
				year: 'numeric',
				timeZone: 'UTC'
			})
			.toUpperCase();
	});

	let drawDateFull = $derived.by(() => {
		if (!draw?.drawDate) return '';
		return (
			new Date(draw.drawDate).toLocaleString('en-US', {
				day: 'numeric',
				month: 'short',
				year: 'numeric',
				hour: '2-digit',
				minute: '2-digit',
				timeZone: 'UTC'
			}) + ' (UTC)'
		);
	});

	let howChanceBody = $derived.by(() => {
		if (!draw) return '';
		return $_('lottery.how_chance_body')
			.replace('{{pool}}', formatValue(pool))
			.replace('{{chance}}', drawChancePct);
	});

	let purchaseSubtitle = $derived.by(() =>
		$_('lottery.purchase_subtitle').replace('{{price}}', formatValue(ticketPrice))
	);
</script>

<SEO
	title="{$_('page_names.lottery')} - XprismPlay"
	description={$_('lottery.seo_description')}
/>

<SignInConfirmDialog bind:open={shouldSignIn} />

<div class="container mx-auto max-w-5xl p-6">
	<header class="mb-8 flex items-start justify-between">
		<div>
			<h1 class="mb-1 text-3xl font-bold">{$_('lottery.title')}</h1>
			<p class="text-muted-foreground max-w-2xl">{$_('lottery.description')}</p>
		</div>
		<Button variant="outline" size="sm" onclick={refresh} disabled={refreshing} class="mt-1">
			<HugeiconsIcon icon={Refresh01Icon} class="h-4 w-4" />
		</Button>
	</header>

	{#if !draw}
		<div class="flex h-60 items-center justify-center">
			<p class="text-muted-foreground">{$_('lottery.loading')}</p>
		</div>
	{:else}
		<section class="mb-8 space-y-6">
			<div>
				<h2 class="text-xl font-semibold">{$_('lottery.active_title')}</h2>
				<p class="text-muted-foreground text-sm">{$_('lottery.active_subtitle')}</p>
			</div>

			<Card.Root>
				<Card.Content class="pt-8 pb-6 text-center">
					<p class="text-muted-foreground mb-2 text-xs font-semibold tracking-widest">
						{$_('lottery.current_draw')} · {drawDateShort}
					</p>
					<p class="my-2 text-5xl font-bold tracking-tight sm:text-6xl">
						{formatValue(pool)}
					</p>
					<p class="text-muted-foreground mb-6 text-sm">{$_('lottery.prize_pool')}</p>

					<Separator class="mb-6" />

					<div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
						<div>
							<p class="text-success text-xl font-bold">{formatValue(winnerAmt)}</p>
							<p class="text-muted-foreground text-xs">{$_('lottery.winner_share')}</p>
						</div>
						<div>
							<p class="text-xl font-bold">{formatValue(bankAmt)}</p>
							<p class="text-muted-foreground text-xs">{$_('lottery.bank_share')}</p>
						</div>
						<div>
							<p class="font-mono text-xl font-bold">{countdown}</p>
							<p class="text-muted-foreground text-xs">
								{$_('lottery.draw_at')} {drawDateFull}
							</p>
						</div>
					</div>
				</Card.Content>
			</Card.Root>

			<Card.Root>
				<Card.Header>
					<Card.Title class="flex items-center gap-2">
						<HugeiconsIcon icon={InformationCircleIcon} class="h-5 w-5" />
						{$_('lottery.how_it_works')}
					</Card.Title>
				</Card.Header>
				<Card.Content class="space-y-4">
					<div>
						<h4 class="mb-1 font-semibold">{$_('lottery.how_chance_title')}</h4>
						<p class="text-muted-foreground text-sm">{howChanceBody}</p>
					</div>
					<div>
						<h4 class="mb-1 font-semibold">{$_('lottery.how_tickets_title')}</h4>
						<p class="text-muted-foreground text-sm">{$_('lottery.how_tickets_body')}</p>
					</div>
				</Card.Content>
			</Card.Root>

			<div class="grid gap-4 md:grid-cols-2">
				<Card.Root>
					<Card.Header>
						<Card.Title class="text-base">{$_('lottery.breakdown_title')}</Card.Title>
					</Card.Header>
					<Card.Content class="space-y-2">
						{#each [
							[$_('lottery.breakdown_tickets'), draw.ticketRevenue],
							[$_('lottery.breakdown_bank'), draw.bankContribution],
							[$_('lottery.breakdown_donations'), draw.donations],
							[$_('lottery.breakdown_rollover'), draw.rolloverAmount]
						] as [label, value] (label)}
							<div class="flex justify-between text-sm">
								<span class="text-muted-foreground">{label}</span>
								<span class="font-mono">{formatValue(value as number)}</span>
							</div>
						{/each}
					</Card.Content>
				</Card.Root>

				<Card.Root>
					<Card.Header>
						<Card.Title class="text-base">{$_('lottery.odds_title')}</Card.Title>
					</Card.Header>
					<Card.Content class="space-y-2">
						{#each [
							[$_('lottery.odds_tickets_sold'), totalTickets.toLocaleString()],
							[$_('lottery.odds_draw_chance'), `${drawChancePct}%`],
							[$_('lottery.odds_per_ticket'), `${perTicketPct}%`],
							[$_('lottery.odds_your_tickets'), userTickets.toString()],
							[$_('lottery.odds_combined'), `${combinedPct}%`]
						] as [label, value] (label)}
							<div class="flex justify-between text-sm">
								<span class="text-muted-foreground">{label}</span>
								<span
									class={label === $_('lottery.odds_combined') && Number(combinedPct) > 0
										? 'font-mono font-semibold text-green-500'
										: 'font-mono'}>{value}</span
								>
							</div>
						{/each}
					</Card.Content>
				</Card.Root>
			</div>
		</section>

		<section class="mb-8">
			<h2 class="mb-1 text-xl font-semibold">{$_('lottery.purchase_title')}</h2>
			<p class="text-muted-foreground mb-4 text-sm">{purchaseSubtitle}</p>

			<Card.Root>
				<Card.Content class="pt-6">
					{#if $USER_DATA}
						<div class="max-w-xs space-y-4">
							<div>
								<label class="mb-1 block text-sm font-medium"
									>{$_('lottery.number_of_tickets')}</label
								>
								<Input type="number" min="1" max="100" step="1" bind:value={quantity} class="w-40" />
							</div>
							<p class="text-muted-foreground text-sm">
								{formatValue(ticketPrice)}
								{$_('lottery.each')} · {$_('lottery.total')}: {formatValue(totalCost)}
							</p>
							<Button onclick={purchase} disabled={purchasing || Number(quantity) < 1}>
								<HugeiconsIcon icon={Ticket01Icon} class="h-4 w-4" />
								{purchasing ? $_('lottery.purchasing') : $_('lottery.purchase_button')}
							</Button>
						</div>
					{:else}
						<div class="py-4">
							<p class="text-muted-foreground mb-3 text-sm">
								{$_('lottery.sign_in_to_purchase')}
							</p>
							<Button onclick={() => (shouldSignIn = true)}>{$_('sign_in.sign_in')}</Button>
						</div>
					{/if}
				</Card.Content>
			</Card.Root>
		</section>

		<section>
			<div class="mb-4">
				<h2 class="text-xl font-semibold">{$_('lottery.history_title')}</h2>
				<p class="text-muted-foreground text-sm">{$_('lottery.history_subtitle')}</p>
			</div>

			<Card.Root>
				<Card.Content class="p-0">
					<Table.Root>
						<Table.Header>
							<Table.Row>
								<Table.Head>{$_('lottery.history_date')}</Table.Head>
								<Table.Head>{$_('lottery.history_pool')}</Table.Head>
								<Table.Head>{$_('lottery.history_tickets')}</Table.Head>
								<Table.Head>{$_('lottery.history_status')}</Table.Head>
								<Table.Head>{$_('lottery.history_winner')}</Table.Head>
								<Table.Head>{$_('lottery.history_prize')}</Table.Head>
							</Table.Row>
						</Table.Header>
						<Table.Body>
							{#if pastDraws.length === 0}
								<Table.Row>
									<Table.Cell colspan={6} class="text-muted-foreground py-10 text-center">
										{$_('lottery.no_history')}
									</Table.Cell>
								</Table.Row>
							{:else}
								{#each pastDraws as d (d.id)}
									<Table.Row>
										<Table.Cell class="text-sm">
											{new Date(d.drawDate).toLocaleDateString('en-US', {
												month: 'short',
												day: 'numeric',
												year: 'numeric',
												timeZone: 'UTC'
											})}
										</Table.Cell>
										<Table.Cell class="font-mono text-sm">{formatValue(d.prizePool)}</Table.Cell>
										<Table.Cell class="text-sm">{d.totalTickets.toLocaleString()}</Table.Cell>
										<Table.Cell>
											<Badge variant={d.status === 'DRAWN' ? 'success' : 'secondary'}>
												{d.status === 'DRAWN'
													? $_('lottery.status_won')
													: $_('lottery.status_rollover')}
											</Badge>
										</Table.Cell>
										<Table.Cell class="text-sm">
											{d.winnerUsername ? `@${d.winnerUsername}` : '—'}
										</Table.Cell>
										<Table.Cell class="font-mono text-sm">
											{d.winnerPrize ? formatValue(d.winnerPrize) : '—'}
										</Table.Cell>
									</Table.Row>
								{/each}
							{/if}
						</Table.Body>
					</Table.Root>
				</Card.Content>
			</Card.Root>
		</section>
	{/if}
</div>