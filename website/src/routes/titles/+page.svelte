<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Badge } from '$lib/components/ui/badge';
	import { Separator } from '$lib/components/ui/separator';
	import SEO from '$lib/components/self/SEO.svelte';
	import SignInConfirmDialog from '$lib/components/self/SignInConfirmDialog.svelte';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import {
		LockIcon,
		Loading03Icon,
		Tick01Icon,
		Alert02Icon,
		Clock01Icon
	} from '@hugeicons/core-free-icons';
	import { USER_DATA } from '$lib/stores/user-data';
	import { PORTFOLIO_SUMMARY, fetchPortfolioSummary } from '$lib/stores/portfolio-data';
	import { toast } from 'svelte-sonner';
	import { formatValue, formatRelativeTime } from '$lib/utils';
	import { onMount } from 'svelte';
	import { _ } from 'svelte-i18n';

	let shouldSignIn = $state(false);
	let titles = $state<any[]>([]);
	let totalFund = $state(0);
	let loading = $state(true);
	let withdrawingId = $state<number | null>(null);

	let newLabel = $state('');
	let newAmount = $state('');
	let newDuration = $state(30);
	let creating = $state(false);

	async function loadTitles() {
		try {
			const res = await fetch('/api/titles');
			if (res.ok) {
				const d = await res.json();
				titles = d.titles;
				totalFund = d.totalFund;
			}
		} catch {
			toast.error($_('titles.errors.load_failed'));
		} finally {
			loading = false;
		}
	}

	async function createTitle() {
		const amt = Number(newAmount);
		if (!newLabel.trim() || !Number.isFinite(amt) || amt <= 0) {
			toast.error($_('titles.errors.invalid_input'));
			return;
		}
		creating = true;
		try {
			const res = await fetch('/api/titles', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ label: newLabel.trim(), amount: amt, durationDays: newDuration })
			});
			const d = await res.json();
			if (!res.ok) {
				toast.error(d.message || $_('titles.errors.create_failed'));
				return;
			}
			toast.success($_('titles.toast.created'));
			newLabel = '';
			newAmount = '';
			newDuration = 30;
			await loadTitles();
			fetchPortfolioSummary();
		} catch {
			toast.error($_('titles.errors.create_failed'));
		} finally {
			creating = false;
		}
	}

	async function withdraw(id: number) {
		withdrawingId = id;
		try {
			const res = await fetch(`/api/titles/${id}/withdraw`, { method: 'POST' });
			const d = await res.json();
			if (!res.ok) {
				toast.error(d.message || $_('titles.errors.withdraw_failed'));
				return;
			}
			const msg =
				d.forfeited > 0
					? $_('titles.toast.withdraw_early')
							.replace('{{payout}}', formatValue(d.payout))
							.replace('{{forfeited}}', formatValue(d.forfeited))
					: $_('titles.toast.withdraw_full')
							.replace('{{payout}}', formatValue(d.payout))
							.replace('{{rewards}}', formatValue(d.pendingRewards));
			toast.success(msg);
			await loadTitles();
			fetchPortfolioSummary();
		} catch {
			toast.error($_('titles.errors.withdraw_failed'));
		} finally {
			withdrawingId = null;
		}
	}

	onMount(() => {
		if ($USER_DATA) loadTitles();
		else loading = false;
	});

	let activeTitles = $derived(titles.filter((t) => !t.withdrawn));
	let withdrawnTitles = $derived(titles.filter((t) => t.withdrawn));
	let balance = $derived($PORTFOLIO_SUMMARY?.baseCurrencyBalance ?? 0);
	let totalLocked = $derived(activeTitles.reduce((s, t) => s + t.initialDeposit, 0));
	let totalCurrentValue = $derived(activeTitles.reduce((s, t) => s + t.currentValue, 0));
	let totalRewards = $derived(totalCurrentValue - totalLocked);
	let projectedShare = $derived(
		totalFund > 0 && Number(newAmount) > 0
			? ((Number(newAmount) / (totalFund + Number(newAmount))) * 100).toFixed(2)
			: '100.00'
	);
</script>

<SEO
	title="{$_('titles.seo.title')} - XprismPlay"
	description={$_('titles.seo.description')}
/>

<SignInConfirmDialog bind:open={shouldSignIn} />

<div class="container mx-auto max-w-5xl p-6">
	<header class="mb-8">
		<h1 class="flex items-center gap-2 text-3xl font-bold">
			<HugeiconsIcon icon={LockIcon} class="h-7 w-7 text-yellow-500" />
			{$_('titles.page.title')}
		</h1>
		<p class="text-muted-foreground mt-1">{$_('titles.page.description')}</p>
	</header>

	{#if !$USER_DATA}
		<div class="flex h-60 flex-col items-center justify-center gap-4 text-center">
			<HugeiconsIcon icon={LockIcon} class="text-muted-foreground/40 h-16 w-16" />
			<p class="text-muted-foreground">{$_('titles.page.sign_in_prompt')}</p>
			<Button onclick={() => (shouldSignIn = true)}>{$_('sign_in.sign_in')}</Button>
		</div>
	{:else}
		<div class="grid gap-6 lg:grid-cols-3">
			<div class="space-y-4 lg:col-span-2">
				<div class="grid grid-cols-3 gap-3">
					<Card.Root class="py-0">
						<Card.Content class="p-4">
							<p class="text-muted-foreground text-xs">{$_('titles.stats.total_locked')}</p>
							<p class="mt-1 text-xl font-bold">{formatValue(totalLocked)}</p>
						</Card.Content>
					</Card.Root>
					<Card.Root class="py-0">
						<Card.Content class="p-4">
							<p class="text-muted-foreground text-xs">{$_('titles.stats.current_value')}</p>
							<p class="mt-1 text-xl font-bold text-green-500">{formatValue(totalCurrentValue)}</p>
						</Card.Content>
					</Card.Root>
					<Card.Root class="py-0">
						<Card.Content class="p-4">
							<p class="text-muted-foreground text-xs">{$_('titles.stats.rewards_earned')}</p>
							<p class="mt-1 text-xl font-bold text-yellow-500">+{formatValue(totalRewards)}</p>
						</Card.Content>
					</Card.Root>
				</div>

				{#if loading}
					<div class="space-y-3">
						{#each Array(2) as _}
							<div class="bg-muted h-24 animate-pulse rounded-xl"></div>
						{/each}
					</div>
				{:else if activeTitles.length === 0}
					<Card.Root>
						<Card.Content class="py-12 text-center">
							<HugeiconsIcon icon={LockIcon} class="text-muted-foreground/40 mx-auto mb-3 h-10 w-10" />
							<p class="text-muted-foreground">{$_('titles.list.empty')}</p>
						</Card.Content>
					</Card.Root>
				{:else}
					{#each activeTitles as title}
						{@const gainPct =
							title.initialDeposit > 0
								? ((title.currentValue - title.initialDeposit) / title.initialDeposit) * 100
								: 0}
						<Card.Root class="overflow-hidden">
							<Card.Content class="p-5">
								<div class="flex items-start justify-between gap-4">
									<div class="min-w-0 flex-1">
										<div class="mb-2 flex flex-wrap items-center gap-2">
											<h3 class="font-semibold">{title.label}</h3>
											{#if title.expired}
												<Badge variant="success" class="text-xs">
													{$_('titles.badge.expired')}
												</Badge>
											{:else}
												<Badge variant="outline" class="text-xs">
													<HugeiconsIcon icon={Clock01Icon} class="mr-1 h-3 w-3" />
													{$_('titles.badge.expires').replace('{{time}}', formatRelativeTime(title.expiresAt))}
												</Badge>
											{/if}
										</div>
										<div class="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
											<div>
												<p class="text-muted-foreground text-xs">{$_('titles.card.deposited')}</p>
												<p class="font-mono font-medium">{formatValue(title.initialDeposit)}</p>
											</div>
											<div>
												<p class="text-muted-foreground text-xs">{$_('titles.card.current_value')}</p>
												<p class="font-mono font-medium text-green-500">{formatValue(title.currentValue)}</p>
											</div>
											<div>
												<p class="text-muted-foreground text-xs">{$_('titles.card.rewards')}</p>
												<p class="font-mono font-medium text-yellow-500">+{formatValue(title.pendingRewards)}</p>
											</div>
											<div>
												<p class="text-muted-foreground text-xs">{$_('titles.card.pool_share')}</p>
												<p class="font-mono font-medium">{title.sharePercent.toFixed(2)}%</p>
											</div>
										</div>
										{#if gainPct > 0}
											<p class="text-muted-foreground mt-2 text-xs">
												{$_('titles.card.gain_info')
													.replace('{{pct}}', gainPct.toFixed(4))
													.replace('{{days}}', String(title.durationDays))}
											</p>
										{/if}
									</div>
									<div class="flex-shrink-0">
										<Button
											size="sm"
											variant={title.expired ? 'default' : 'outline'}
											onclick={() => withdraw(title.id)}
											disabled={withdrawingId === title.id}
										>
											{#if withdrawingId === title.id}
												<HugeiconsIcon icon={Loading03Icon} class="h-3 w-3 animate-spin" />
											{:else if title.expired}
												<HugeiconsIcon icon={Tick01Icon} class="h-3 w-3" />
												{$_('titles.card.claim')}
											{:else}
												<HugeiconsIcon icon={Alert02Icon} class="h-3 w-3" />
												{$_('titles.card.early_exit')}
											{/if}
										</Button>
									</div>
								</div>
								{#if !title.expired}
									<div class="mt-3 flex items-start gap-1.5 rounded-md bg-yellow-500/10 px-3 py-2">
										<HugeiconsIcon
											icon={Alert02Icon}
											class="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-yellow-600"
										/>
										<p class="text-xs text-yellow-700 dark:text-yellow-400">
											{$_('titles.card.early_warning')
												.replace('{{deposit}}', formatValue(title.initialDeposit))
												.replace('{{rewards}}', formatValue(title.pendingRewards))}
										</p>
									</div>
								{/if}
							</Card.Content>
						</Card.Root>
					{/each}
				{/if}

				{#if withdrawnTitles.length > 0}
					<div>
						<Separator class="my-4" />
						<p class="text-muted-foreground mb-3 text-sm">
							{$_('titles.list.withdrawn_header').replace('{{n}}', String(withdrawnTitles.length))}
						</p>
						<div class="space-y-2">
							{#each withdrawnTitles as title}
								<div
									class="bg-muted/30 flex items-center justify-between rounded-lg border px-4 py-3 opacity-60"
								>
									<div>
										<p class="text-sm font-medium">{title.label}</p>
										<p class="text-muted-foreground text-xs">
											{$_('titles.list.withdrawn_meta')
												.replace('{{amount}}', formatValue(title.initialDeposit))
												.replace('{{days}}', String(title.durationDays))
												.replace('{{time}}', formatRelativeTime(title.withdrawnAt))}
										</p>
									</div>
									<Badge variant="secondary" class="text-xs">{$_('titles.badge.withdrawn')}</Badge>
								</div>
							{/each}
						</div>
					</div>
				{/if}
			</div>

			<div>
				<Card.Root>
					<Card.Header>
						<Card.Title class="text-base">{$_('titles.form.title')}</Card.Title>
						<Card.Description>{$_('titles.form.description')}</Card.Description>
					</Card.Header>
					<Card.Content class="space-y-4">
						<div class="space-y-1">
							<Label class="text-sm">{$_('titles.form.label')}</Label>
							<Input
								bind:value={newLabel}
								placeholder={$_('titles.form.label_placeholder')}
								maxlength={100}
							/>
						</div>

						<div class="space-y-1">
							<div class="flex items-center justify-between">
								<Label class="text-sm">{$_('titles.form.amount')}</Label>
								<button
									type="button"
									class="text-primary hover:text-primary/80 text-xs font-medium transition-colors"
									onclick={() => (newAmount = String(balance))}
								>
									{$_('titles.form.max')}
								</button>
							</div>
							<Input
								type="number"
								bind:value={newAmount}
								placeholder="0.00"
								min="0.01"
								step="0.01"
							/>
							<p class="text-muted-foreground text-xs">
								{$_('titles.form.balance').replace('{{balance}}', formatValue(balance))}
							</p>
						</div>

						<div class="space-y-1">
							<Label class="text-sm">
								{$_('titles.form.duration').replace('{{n}}', String(newDuration))}
							</Label>
							<input
								type="range"
								bind:value={newDuration}
								min="1"
								max="60"
								step="1"
								class="w-full accent-primary"
							/>
							<div class="flex justify-between text-xs text-muted-foreground">
								<span>{$_('titles.form.duration_min')}</span>
								<span>{$_('titles.form.duration_max')}</span>
							</div>
						</div>

						<div class="space-y-1 rounded-lg border bg-muted/30 p-3 text-xs">
							<div class="flex justify-between">
								<span class="text-muted-foreground">{$_('titles.summary.fee_rate')}</span>
								<span class="font-mono">{$_('titles.summary.fee_rate_value')}</span>
							</div>
							<div class="flex justify-between">
								<span class="text-muted-foreground">{$_('titles.summary.pool_share')}</span>
								<span class="font-mono">{projectedShare}%</span>
							</div>
							<div class="flex justify-between">
								<span class="text-muted-foreground">{$_('titles.summary.early_exit')}</span>
								<span class="font-mono text-red-500">{$_('titles.summary.early_exit_value')}</span>
							</div>
						</div>

						<Button
							class="w-full"
							onclick={createTitle}
							disabled={creating || !newLabel.trim() || !newAmount || Number(newAmount) <= 0}
						>
							{#if creating}
								<HugeiconsIcon icon={Loading03Icon} class="h-4 w-4 animate-spin" />
								{$_('titles.form.creating')}
							{:else}
								<HugeiconsIcon icon={LockIcon} class="h-4 w-4" />
								{$_('titles.form.submit')}
							{/if}
						</Button>
					</Card.Content>
				</Card.Root>

				<Card.Root class="mt-4">
					<Card.Header class="pb-2">
						<Card.Title class="text-sm">{$_('titles.fund.title')}</Card.Title>
					</Card.Header>
					<Card.Content class="space-y-2 text-sm">
						<div class="flex justify-between">
							<span class="text-muted-foreground">{$_('titles.fund.total_shares')}</span>
							<span class="font-mono">{formatValue(totalFund)}</span>
						</div>
						<div class="flex justify-between">
							<span class="text-muted-foreground">{$_('titles.fund.active_titles')}</span>
							<span class="font-mono">{activeTitles.length}</span>
						</div>
					</Card.Content>
				</Card.Root>
			</div>
		</div>
	{/if}
</div>