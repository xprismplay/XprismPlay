<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import * as Card from '$lib/components/ui/card';
	import * as Table from '$lib/components/ui/table';
	import * as Tabs from '$lib/components/ui/tabs';
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
		Refresh01Icon,
		DollarCircleIcon
	} from '@hugeicons/core-free-icons';
	import { USER_DATA } from '$lib/stores/user-data';
	import { fetchPortfolioSummary } from '$lib/stores/portfolio-data';
	import { toast } from 'svelte-sonner';
	import { formatValue } from '$lib/utils';
	import { _ } from 'svelte-i18n';

	let { data } = $props();

	let current = $state(data.current);
	let pastDraws = $state(data.history ?? []);
	let weekly = $state(data.weekly);
	let weeklyHistory = $state(data.weeklyHistory ?? []);

	let activeTab = $state('daily');
	let quantity = $state(1);
	let purchasing = $state(false);
	let shouldSignIn = $state(false);
	let refreshing = $state(false);
	let countdown = $state('--h --m --s');
	let weeklyCountdown = $state('--h --m --s');
	let timer: ReturnType<typeof setInterval> | null = null;

	let pickedNumbers = $state<number[]>([]);
	let weeklyPurchasing = $state(false);
	let randomCount = $state(1);

	let donateAmount = $state('');
	let donating = $state(false);

	let news = $state<any[]>([]);
	let newsLoading = $state(false);
	let newsLoaded = $state(false);

	function tick() {
		if (current?.draw?.drawDate) {
			const diff = new Date(current.draw.drawDate).getTime() - Date.now();
			if (diff <= 0) {
				countdown = '00h 00m 00s';
			} else {
				const h = Math.floor(diff / 3_600_000);
				const m = Math.floor((diff % 3_600_000) / 60_000);
				const s = Math.floor((diff % 60_000) / 1_000);
				countdown = `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
			}
		}
		if (weekly?.draw?.drawDate) {
			const diff = new Date(weekly.draw.drawDate).getTime() - Date.now();
			if (diff <= 0) {
				weeklyCountdown = '00h 00m 00s';
			} else {
				const d = Math.floor(diff / 86_400_000);
				const h = Math.floor((diff % 86_400_000) / 3_600_000);
				const m = Math.floor((diff % 3_600_000) / 60_000);
				const s = Math.floor((diff % 60_000) / 1_000);
				weeklyCountdown = `${d}d ${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
			}
		}
	}

	async function refresh() {
		refreshing = true;
		try {
			const [cr, hr, wr, whr] = await Promise.all([
				fetch('/api/lottery'),
				fetch('/api/lottery/history?limit=10'),
				fetch('/api/lottery/weekly'),
				fetch('/api/lottery/weekly/history?limit=5')
			]);
			if (cr.ok) current = await cr.json();
			if (hr.ok) pastDraws = (await hr.json()).draws ?? [];
			if (wr.ok) weekly = await wr.json();
			if (whr.ok) weeklyHistory = (await whr.json()).draws ?? [];
			if (newsLoaded) await loadNews(true);
		} finally {
			refreshing = false;
		}
	}

	async function loadNews(force = false) {
		if (newsLoaded && !force) return;
		newsLoading = true;
		try {
			const r = await fetch('/api/lottery/news?limit=40');
			if (r.ok) news = (await r.json()).news ?? [];
			newsLoaded = true;
		} finally {
			newsLoading = false;
		}
	}

	$effect(() => {
		if (activeTab === 'news' && !newsLoaded) loadNews();
	});

	async function purchase() {
		if (!$USER_DATA) {
			shouldSignIn = true;
			return;
		}
		if (purchasing) return;
		const qty = Math.floor(Number(quantity));
		if (!Number.isInteger(qty) || qty < 1 || qty > 1000) {
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
			toast.success($_('lottery.purchased').replace('{{n}}', String(qty)));
			await refresh();
			fetchPortfolioSummary();
		} catch {
			toast.error($_('lottery.purchase_failed'));
		} finally {
			purchasing = false;
		}
	}

	async function purchaseWeekly() {
		if (!$USER_DATA) {
			shouldSignIn = true;
			return;
		}
		if (weeklyPurchasing) return;
		const need = weekly?.numbersCount ?? 6;
		if (pickedNumbers.length !== need) {
			toast.error($_('lottery.weekly.pick_exactly').replace('{{n}}', String(need)));
			return;
		}
		weeklyPurchasing = true;
		try {
			const res = await fetch('/api/lottery/weekly/purchase', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ numbers: pickedNumbers })
			});
			const result = await res.json();
			if (!res.ok) {
				toast.error(result.message || $_('lottery.purchase_failed'));
				return;
			}
			toast.success($_('lottery.weekly.ticket_bought'));
			pickedNumbers = [];
			await refresh();
			fetchPortfolioSummary();
		} catch {
			toast.error($_('lottery.purchase_failed'));
		} finally {
			weeklyPurchasing = false;
		}
	}

	async function purchaseRandomWeekly() {
		if (!$USER_DATA) {
			shouldSignIn = true;
			return;
		}
		if (weeklyPurchasing) return;
		const cnt = Math.floor(Number(randomCount));
		if (!Number.isInteger(cnt) || cnt < 1 || cnt > 1000) {
			toast.error($_('lottery.invalid_quantity'));
			return;
		}
		weeklyPurchasing = true;
		try {
			const res = await fetch('/api/lottery/weekly/purchase', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ random: cnt })
			});
			const result = await res.json();
			if (!res.ok) {
				toast.error(result.message || $_('lottery.purchase_failed'));
				return;
			}
			toast.success(`${cnt} ${$_('lottery.weekly.ticket_bought')}`);
			await refresh();
			fetchPortfolioSummary();
		} catch {
			toast.error($_('lottery.purchase_failed'));
		} finally {
			weeklyPurchasing = false;
		}
	}

	async function donate() {
		if (!$USER_DATA) {
			shouldSignIn = true;
			return;
		}
		if (donating) return;
		const amt = Number(donateAmount);
		if (!Number.isFinite(amt) || amt < 1) {
			toast.error('Minimum donation is $1');
			return;
		}
		if (amt > 1_000_000) {
			toast.error('Maximum donation is $1,000,000');
			return;
		}
		donating = true;
		try {
			const res = await fetch('/api/lottery/donate', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ amount: amt })
			});
			const result = await res.json();
			if (!res.ok) {
				toast.error(result.message || 'Donation failed');
				return;
			}
			toast.success($_('lottery.donate.success').replace('{{amount}}', formatValue(amt)));
			donateAmount = '';
			await refresh();
			fetchPortfolioSummary();
		} catch {
			toast.error('Donation failed');
		} finally {
			donating = false;
		}
	}

	function toggleNumber(n: number) {
		const max = weekly?.numbersCount ?? 6;
		if (pickedNumbers.includes(n)) {
			pickedNumbers = pickedNumbers.filter((x) => x !== n);
		} else if (pickedNumbers.length < max) {
			pickedNumbers = [...pickedNumbers, n].sort((a, b) => a - b);
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
	let perTicketPct = $derived(current?.chancePerTicket ? (current.chancePerTicket * 100).toFixed(4) : '0.0000');
	let combinedPct = $derived(current?.userCombinedChance ? (current.userCombinedChance * 100).toFixed(2) : '0.00');
	let userTickets = $derived(current?.userTickets ?? 0);
	let ticketPrice = $derived(current?.ticketPrice ?? 500);
	let totalCost = $derived(Math.max(1, Math.floor(Number(quantity))) * ticketPrice);
	let drawDateFull = $derived(
		draw?.drawDate
			? new Date(draw.drawDate).toLocaleString('en-US', {
					day: 'numeric',
					month: 'short',
					year: 'numeric',
					hour: '2-digit',
					minute: '2-digit',
					timeZone: 'UTC'
				}) + ' (UTC)'
			: ''
	);

	let wDraw = $derived(weekly?.draw);
	let wPool = $derived(wDraw?.prizePool ?? 0);
	let wDrawDateFull = $derived(
		wDraw?.drawDate
			? new Date(wDraw.drawDate).toLocaleString('en-US', {
					day: 'numeric',
					month: 'short',
					year: 'numeric',
					hour: '2-digit',
					minute: '2-digit',
					timeZone: 'UTC'
				}) + ' (UTC)'
			: ''
	);
	let numbersCount = $derived(weekly?.numbersCount ?? 6);
	let numbersMax = $derived(weekly?.numbersMax ?? 60);
	let weeklyTicketPrice = $derived(weekly?.ticketPrice ?? 2500);
	let userWeeklyTickets = $derived(weekly?.userTickets ?? []);
</script>

<SEO title="{$_('page_names.lottery')} - XprismPlay" description={$_('lottery.seo_description')} />
<SignInConfirmDialog bind:open={shouldSignIn} />

<div class="container mx-auto max-w-5xl p-6">
	<header class="mb-6 flex items-start justify-between">
		<div>
			<h1 class="mb-1 text-3xl font-bold">{$_('lottery.title')}</h1>
			<p class="text-muted-foreground max-w-2xl">{$_('lottery.description')}</p>
		</div>
		<Button variant="outline" size="sm" onclick={refresh} disabled={refreshing} class="mt-1">
			<HugeiconsIcon icon={Refresh01Icon} class="h-4 w-4" />
		</Button>
	</header>

	<Tabs.Root bind:value={activeTab}>
		<Tabs.List class="mb-6">
			<Tabs.Trigger value="daily">{$_('lottery.tabs.daily')}</Tabs.Trigger>
			<Tabs.Trigger value="weekly">{$_('lottery.tabs.weekly')}</Tabs.Trigger>
			<Tabs.Trigger value="news">{$_('lottery.tabs.news')}</Tabs.Trigger>
		</Tabs.List>

		<Tabs.Content value="daily">
			{#if !draw}
				<div class="flex h-60 items-center justify-center">
					<p class="text-muted-foreground">{$_('lottery.loading')}</p>
				</div>
			{:else}
				<div class="space-y-6">
					<Card.Root>
						<Card.Content class="pt-8 pb-6 text-center">
							<p class="text-muted-foreground mb-2 text-xs font-semibold tracking-widest">
								{$_('lottery.current_draw')} ·
								{new Date(draw.drawDate)
									.toLocaleDateString('en-US', {
										month: 'short',
										day: 'numeric',
										year: 'numeric',
										timeZone: 'UTC'
									})
									.toUpperCase()}
							</p>
							<p class="my-2 text-5xl font-bold tracking-tight sm:text-6xl">{formatValue(pool)}</p>
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
									<p class="text-muted-foreground text-xs">{$_('lottery.draw_at')} {drawDateFull}</p>
								</div>
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
									[$_('lottery.odds_tickets_sold'), draw.totalTickets.toLocaleString()],
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
												: 'font-mono'}
										>
											{value}
										</span>
									</div>
								{/each}
							</Card.Content>
						</Card.Root>
					</div>

					<Card.Root>
						<Card.Header>
							<Card.Title class="text-base">{$_('lottery.purchase_title')}</Card.Title>
							<Card.Description>{$_('lottery.purchase_subtitle').replace('{{price}}', formatValue(ticketPrice))}</Card.Description>
						</Card.Header>
						<Card.Content>
							{#if $USER_DATA}
								<div class="max-w-xs space-y-4">
									<div>
										<label class="mb-1 block text-sm font-medium">{$_('lottery.number_of_tickets')}</label>
										<Input type="number" min="1" max="1000" step="1" bind:value={quantity} class="w-40" />
									</div>
									<p class="text-muted-foreground text-sm">
										{formatValue(ticketPrice)} {$_('lottery.each')} · {$_('lottery.total')}: {formatValue(totalCost)}
									</p>
									<Button onclick={purchase} disabled={purchasing || Number(quantity) < 1}>
										<HugeiconsIcon icon={Ticket01Icon} class="h-4 w-4" />
										{purchasing ? $_('lottery.purchasing') : $_('lottery.purchase_button')}
									</Button>
								</div>
							{:else}
								<div class="py-4">
									<p class="text-muted-foreground mb-3 text-sm">{$_('lottery.sign_in_to_purchase')}</p>
									<Button onclick={() => (shouldSignIn = true)}>{$_('sign_in.sign_in')}</Button>
								</div>
							{/if}
						</Card.Content>
					</Card.Root>

					<Card.Root>
						<Card.Header>
							<Card.Title class="flex items-center gap-2 text-base">
								<HugeiconsIcon icon={DollarCircleIcon} class="h-4 w-4 text-green-500" />
								{$_('lottery.donate.title')}
							</Card.Title>
							<Card.Description>{$_('lottery.donate.subtitle')}</Card.Description>
						</Card.Header>
						<Card.Content>
							{#if $USER_DATA}
								<div class="flex max-w-xs gap-2">
									<Input
										type="number"
										min="1"
										max="1000000"
										step="1"
										bind:value={donateAmount}
										placeholder={$_('lottery.donate.placeholder')}
										class="w-40"
									/>
									<Button onclick={donate} disabled={donating || !donateAmount || Number(donateAmount) < 1}>
										{donating ? $_('lottery.donating') : $_('lottery.donate.button')}
									</Button>
								</div>
							{:else}
								<div class="py-2">
									<p class="text-muted-foreground mb-3 text-sm">{$_('lottery.sign_in_to_purchase')}</p>
									<Button onclick={() => (shouldSignIn = true)}>{$_('sign_in.sign_in')}</Button>
								</div>
							{/if}
						</Card.Content>
					</Card.Root>

					<Card.Root>
						<Card.Header>
							<Card.Title class="text-base">{$_('lottery.history_title')}</Card.Title>
							<Card.Description>{$_('lottery.history_subtitle')}</Card.Description>
						</Card.Header>
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
														{d.status === 'DRAWN' ? $_('lottery.status_won') : $_('lottery.status_rollover')}
													</Badge>
												</Table.Cell>
												<Table.Cell class="text-sm">{d.winnerUsername ? `@${d.winnerUsername}` : '—'}</Table.Cell>
												<Table.Cell class="font-mono text-sm">{d.winnerPrize ? formatValue(d.winnerPrize) : '—'}</Table.Cell>
											</Table.Row>
										{/each}
									{/if}
								</Table.Body>
							</Table.Root>
						</Card.Content>
					</Card.Root>
				</div>
			{/if}
		</Tabs.Content>

		<Tabs.Content value="weekly">
			{#if !wDraw}
				<div class="flex h-60 items-center justify-center">
					<p class="text-muted-foreground">{$_('lottery.loading')}</p>
				</div>
			{:else}
				<div class="space-y-6">
					<Card.Root>
						<Card.Content class="pt-8 pb-6 text-center">
							<p class="text-muted-foreground mb-2 text-xs font-semibold tracking-widest">
								{$_('lottery.weekly.title')} ·
								{new Date(wDraw.drawDate)
									.toLocaleDateString('en-US', {
										month: 'short',
										day: 'numeric',
										year: 'numeric',
										timeZone: 'UTC'
									})
									.toUpperCase()}
							</p>
							<p class="my-2 text-5xl font-bold tracking-tight sm:text-6xl">{formatValue(wPool)}</p>
							<p class="text-muted-foreground mb-6 text-sm">{$_('lottery.weekly.prize_pool')}</p>
							<Separator class="mb-6" />
							<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
								<div>
									<p class="font-mono text-xl font-bold">{weeklyCountdown}</p>
									<p class="text-muted-foreground text-xs">{$_('lottery.draw_at')} {wDrawDateFull}</p>
								</div>
								<div>
									<p class="text-xl font-bold">{wDraw.totalTickets.toLocaleString()}</p>
									<p class="text-muted-foreground text-xs">{$_('lottery.odds_tickets_sold')}</p>
								</div>
							</div>
						</Card.Content>
					</Card.Root>

					<Card.Root>
						<Card.Header>
							<Card.Title class="flex items-center gap-2 text-base">
								<HugeiconsIcon icon={InformationCircleIcon} class="h-4 w-4" />
								{$_('lottery.weekly.how_title')}
							</Card.Title>
						</Card.Header>
						<Card.Content class="space-y-2 text-sm">
							<div class="flex justify-between">
								<span>{$_('lottery.weekly.jackpot')}</span>
								<span class="font-mono text-yellow-500">{$_('lottery.weekly.jackpot_pct')}</span>
							</div>
							<div class="flex justify-between">
								<span>{$_('lottery.weekly.match5')}</span>
								<span class="font-mono text-blue-500">{$_('lottery.weekly.match5_pct')}</span>
							</div>
							<div class="flex justify-between">
								<span>{$_('lottery.weekly.match4')}</span>
								<span class="font-mono text-purple-500">{$_('lottery.weekly.match4_pct')}</span>
							</div>
							<p class="text-muted-foreground pt-1 text-xs">{$_('lottery.weekly.note')}</p>
						</Card.Content>
					</Card.Root>

					<Card.Root>
						<Card.Header>
							<Card.Title class="text-base">{$_('lottery.weekly.pick_numbers_title')}</Card.Title>
							<Card.Description>
								{$_('lottery.weekly.numbers_picked')
									.replace('{{n}}', String(pickedNumbers.length))
									.replace('{{total}}', String(numbersCount))}
								· {formatValue(weeklyTicketPrice)} {$_('lottery.each')}
							</Card.Description>
						</Card.Header>
						<Card.Content class="space-y-4">
							<div class="grid grid-cols-10 gap-1">
								{#each Array.from({ length: numbersMax }, (_, i) => i + 1) as n}
									{@const picked = pickedNumbers.includes(n)}
									<button
										class="rounded py-1.5 text-xs font-mono transition-colors {picked
											? 'bg-primary text-primary-foreground font-bold'
											: 'bg-muted hover:bg-muted/80'} disabled:cursor-not-allowed disabled:opacity-40"
										onclick={() => toggleNumber(n)}
										disabled={!picked && pickedNumbers.length >= numbersCount}
									>
										{n}
									</button>
								{/each}
							</div>

							<div class="flex flex-wrap gap-2">
								<Button
									variant="outline"
									size="sm"
									onclick={() => (pickedNumbers = [])}
									disabled={pickedNumbers.length === 0}
								>
									{$_('lottery.weekly.clear')}
								</Button>
								{#if $USER_DATA}
									<Button
										size="sm"
										onclick={purchaseWeekly}
										disabled={weeklyPurchasing || pickedNumbers.length !== numbersCount}
									>
										<HugeiconsIcon icon={Ticket01Icon} class="h-4 w-4" />
										{weeklyPurchasing ? $_('lottery.purchasing') : $_('lottery.weekly.buy_ticket')} ({formatValue(weeklyTicketPrice)})
									</Button>
								{:else}
									<Button size="sm" onclick={() => (shouldSignIn = true)}>{$_('sign_in.sign_in')}</Button>
								{/if}
							</div>

							<Separator />

							<div>
								<p class="mb-2 text-sm font-medium">{$_('lottery.weekly.random_tickets')}</p>
								<div class="flex items-center gap-2">
									<Input type="number" min="1" max="1000" step="1" bind:value={randomCount} class="w-24" />
									{#if $USER_DATA}
										<Button
											variant="outline"
											size="sm"
											onclick={purchaseRandomWeekly}
											disabled={weeklyPurchasing}
										>
											{weeklyPurchasing ? $_('lottery.purchasing') : $_('lottery.weekly.buy_random')}
										</Button>
										<span class="text-muted-foreground text-xs">
											{formatValue(Math.max(1, Math.floor(Number(randomCount))) * weeklyTicketPrice)}
										</span>
									{:else}
										<Button variant="outline" size="sm" onclick={() => (shouldSignIn = true)}>{$_('sign_in.sign_in')}</Button>
									{/if}
								</div>
							</div>
						</Card.Content>
					</Card.Root>

					{#if userWeeklyTickets.length > 0}
						<Card.Root>
							<Card.Header>
								<Card.Title class="text-base">{$_('lottery.weekly.your_tickets_title')}</Card.Title>
							</Card.Header>
							<Card.Content>
								<div class="space-y-2">
									{#each userWeeklyTickets as t}
										<div class="flex items-center justify-between rounded-lg border p-2 text-sm">
											<div class="flex flex-wrap gap-1">
												{#each t.numbers as n}
													<span class="bg-primary/10 text-primary rounded px-1.5 py-0.5 font-mono text-xs">{n}</span>
												{/each}
											</div>
											{#if t.matchCount != null}
												<Badge variant={t.winnings ? 'success' : 'secondary'}>
													{t.matchCount} {$_('lottery.weekly.match_count')}
													{#if t.winnings} · {formatValue(t.winnings)}{/if}
												</Badge>
											{/if}
										</div>
									{/each}
								</div>
							</Card.Content>
						</Card.Root>
					{/if}

					{#if weeklyHistory.length > 0}
						<Card.Root>
							<Card.Header>
								<Card.Title class="text-base">{$_('lottery.weekly.history_title')}</Card.Title>
							</Card.Header>
							<Card.Content class="p-0">
								<Table.Root>
									<Table.Header>
										<Table.Row>
											<Table.Head>{$_('lottery.history_date')}</Table.Head>
											<Table.Head>{$_('lottery.weekly.drawn_numbers')}</Table.Head>
											<Table.Head>{$_('lottery.history_pool')}</Table.Head>
											<Table.Head>{$_('lottery.weekly.jackpot_winners')}</Table.Head>
											<Table.Head>{$_('lottery.weekly.match5_winners')}</Table.Head>
											<Table.Head>{$_('lottery.weekly.match4_winners')}</Table.Head>
										</Table.Row>
									</Table.Header>
									<Table.Body>
										{#each weeklyHistory as d (d.id)}
											<Table.Row>
												<Table.Cell class="text-sm">
													{new Date(d.drawDate).toLocaleDateString('en-US', {
														month: 'short',
														day: 'numeric',
														year: 'numeric',
														timeZone: 'UTC'
													})}
												</Table.Cell>
												<Table.Cell>
													<div class="flex flex-wrap gap-0.5">
														{#each d.drawnNumbers as n}
															<span class="bg-primary text-primary-foreground rounded px-1 py-0.5 text-xs font-mono">{n}</span>
														{/each}
													</div>
												</Table.Cell>
												<Table.Cell class="font-mono text-sm">{formatValue(d.prizePool)}</Table.Cell>
												<Table.Cell class="text-sm">{d.jackpotWinnersCount ?? 0}</Table.Cell>
												<Table.Cell class="text-sm">{d.match5WinnersCount ?? 0}</Table.Cell>
												<Table.Cell class="text-sm">{d.match4WinnersCount ?? 0}</Table.Cell>
											</Table.Row>
										{/each}
									</Table.Body>
								</Table.Root>
							</Card.Content>
						</Card.Root>
					{/if}
				</div>
			{/if}
		</Tabs.Content>

		<Tabs.Content value="news">
			<div class="space-y-4">
				<div>
					<h2 class="text-xl font-semibold">{$_('lottery.news.title')}</h2>
					<p class="text-muted-foreground text-sm">{$_('lottery.news.subtitle')}</p>
				</div>

				{#if newsLoading}
					<div class="flex h-40 items-center justify-center">
						<p class="text-muted-foreground animate-pulse">{$_('lottery.loading')}</p>
					</div>
				{:else if news.length === 0}
					<div class="flex h-40 items-center justify-center">
						<p class="text-muted-foreground">{$_('lottery.news.no_data')}</p>
					</div>
				{:else}
					<div class="space-y-3">
						{#each news as item (item.type + '-' + item.id)}
							<Card.Root>
								<Card.Content class="p-4">
									<div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
										<div class="flex items-center gap-3">
											<Badge variant={item.type === 'daily' ? 'default' : 'secondary'}>
												{item.type === 'daily' ? $_('lottery.news.daily') : $_('lottery.news.weekly')}
											</Badge>
											<div>
												<p class="text-sm font-medium">
													{new Date(item.drawDate).toLocaleDateString('en-US', {
														weekday: 'short',
														month: 'short',
														day: 'numeric',
														year: 'numeric',
														timeZone: 'UTC'
													})}
												</p>
												<p class="text-muted-foreground text-xs">
													{item.totalTickets.toLocaleString()} tickets · {formatValue(item.prizePool)} pool
												</p>
											</div>
										</div>
										<div class="text-right">
											{#if item.type === 'daily'}
												{#if item.winnerUsername}
													<p class="text-success text-sm font-medium">Winner: @{item.winnerUsername}</p>
													{#if item.winnerPrize}
														<p class="font-mono text-sm">{formatValue(item.winnerPrize)}</p>
													{/if}
												{:else}
													<p class="text-muted-foreground text-sm">{$_('lottery.status_rollover')}</p>
												{/if}
											{:else if item.drawnNumbers}
												<div class="mb-1 flex flex-wrap justify-end gap-0.5">
													{#each item.drawnNumbers as n}
														<span class="bg-primary text-primary-foreground rounded px-1 text-xs font-mono">{n}</span>
													{/each}
												</div>
												<p class="text-muted-foreground text-xs">
													{$_('lottery.weekly.jackpot_winners')}: {item.jackpotWinnersCount ?? 0} ·
													{$_('lottery.weekly.match5_winners')}: {item.match5WinnersCount ?? 0} ·
													{$_('lottery.weekly.match4_winners')}: {item.match4WinnersCount ?? 0}
												</p>
											{:else}
												<p class="text-muted-foreground text-sm">{$_('lottery.status_rollover')}</p>
											{/if}
											<Badge
												variant={item.status === 'DRAWN' ? 'success' : item.status === 'ROLLED_OVER' ? 'secondary' : 'outline'}
												class="mt-1 text-xs"
											>
												{item.status === 'DRAWN' ? $_('lottery.status_won') : $_('lottery.status_rollover')}
											</Badge>
										</div>
									</div>
								</Card.Content>
							</Card.Root>
						{/each}
					</div>
				{/if}
			</div>
		</Tabs.Content>
	</Tabs.Root>
</div>