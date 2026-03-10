<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import DataTable from '$lib/components/self/DataTable.svelte';
	import PortfolioSkeleton from '$lib/components/self/skeletons/PortfolioSkeleton.svelte';
	import SEO from '$lib/components/self/SEO.svelte';
	import { formatPrice, formatValue, formatQuantity, formatDate } from '$lib/utils';
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import {
		TradeUpIcon,
		DollarCircleIcon,
		Wallet01Icon,
		ReceiptDollarIcon,
		Invoice03Icon,
		SentIcon
	} from '@hugeicons/core-free-icons';
	import { goto } from '$app/navigation';
	import { USER_DATA } from '$lib/stores/user-data';
	import { PORTFOLIO_DATA, fetchPortfolioData } from '$lib/stores/portfolio-data';
	import SendMoneyModal from '$lib/components/self/SendMoneyModal.svelte';
	import SignInConfirmDialog from '$lib/components/self/SignInConfirmDialog.svelte';
	import { _ } from 'svelte-i18n';
	// TODO: add type definitions
	let transactions = $state<any[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let sendMoneyModalOpen = $state(false);
	let shouldSignIn = $state(false);

	onMount(async () => {
		await Promise.all([loadPortfolioData(), fetchRecentTransactions()]);
		loading = false;
	});

	async function loadPortfolioData() {
		try {
			const data = await fetchPortfolioData();
			if (!data) {
				error = 'Failed to load portfolio data';
				toast.error('Failed to load portfolio data');
			} else {
				error = null;
			}
		} catch (e) {
			console.error('Failed to fetch portfolio data:', e);
			error = 'Failed to load portfolio data';
			toast.error('Failed to load portfolio data');
		}
	}

	async function fetchRecentTransactions() {
		try {
			const response = await fetch('/api/transactions');
			if (response.ok) {
				const result = await response.json();
				transactions = result.transactions.slice(0, 10); // Show last 10 transactions
			} else {
				toast.error('Failed to load transactions');
			}
		} catch (e) {
			console.error('Failed to fetch transactions:', e);
			toast.error('Failed to load transactions');
		}
	}

	async function retryFetch() {
		loading = true;
		error = null;
		await Promise.all([loadPortfolioData(), fetchRecentTransactions()]);
		loading = false;
	}

	let portfolioData = $derived($PORTFOLIO_DATA);
	let totalPortfolioValue = $derived(portfolioData ? portfolioData.totalValue : 0);
	let hasHoldings = $derived(portfolioData && portfolioData.coinHoldings.length > 0);
	let hasTransactions = $derived(transactions.length > 0);

	let holdingsColumns = $derived([
		{
			key: 'coin',
			label: $_('global.coin'),
			class: 'w-[25%] min-w-[120px] md:w-[12%]',
			render: (value: any, row: any) => ({
				component: 'coin',
				icon: row.icon,
				symbol: row.symbol,
				name: `*${row.symbol}`,
				size: 6
			})
		},
		{
			key: 'quantity',
			label: $_('global.quantity'),
			class: 'w-[15%] min-w-[80px] md:w-[10%] font-mono',
			sortable: true,
			render: (value: any) => formatQuantity(value)
		},
		{
			key: 'currentPrice',
			label: $_('global.price'),
			class: 'w-[12%] min-w-[70px] md:w-[10%] font-mono',
			sortable: true,
			render: (value: any) => `$${formatPrice(value)}`
		},
		{
			key: 'percentageChange',
			label: 'P&L %',
			class: 'w-[15%] min-w-[80px] md:w-[12%]',
			sortable: true,
			render: (value: any) => ({
				component: 'badge',
				variant: value >= 0 ? 'success' : 'destructive',
				text: `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
			})
		},
		{
			key: 'change24h',
			label: $_('coin.24hchange'),
			class: 'w-[15%] min-w-[80px] md:w-[12%]',
			sortable: true,
			render: (value: any) => ({
				component: 'badge',
				variant: value >= 0 ? 'success' : 'destructive',
				text: `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
			})
		},
		{
			key: 'value',
			label: $_('global.value'),
			class: 'w-[12%] min-w-[70px] md:w-[10%] font-mono font-medium',
			sortable: true,
			defaultSort: true,
			render: (value: any) => formatValue(value)
		},
		{
			key: 'portfolioPercent',
			label: 'Portfolio %',
			class: 'hidden md:table-cell md:w-[12%]',
			render: (value: any, row: any) => ({
				component: 'badge',
				variant: 'outline',
				text: `${((row.value / totalPortfolioValue) * 100).toFixed(1)}%`
			})
		}
	]);

	// Column configurations for transactions table
	let transactionsColumns = $derived([
		{
			key: 'type',
			label: $_('global.type'),
			class: 'w-[12%] min-w-[60px] md:w-[8%]',
			render: (value: any, row: any) => {
				if (row.isTransfer) {
					return {
						component: 'badge',
						variant: 'default',
						text: row.isIncoming ? 'Received' : 'Sent',
						class: 'text-xs'
					};
				}
				return {
					component: 'badge',
					variant: value === 'BUY' ? 'success' : 'destructive',
					text: value === 'BUY' ? 'Buy' : 'Sell',
					class: 'text-xs'
				};
			}
		},
		{
			key: 'coin',
			label: $_('global.coin'),
			class: 'w-[20%] min-w-[100px] md:w-[12%]',
			render: (value: any, row: any) => {
				if (row.isTransfer) {
					if (row.isCoinTransfer && row.coin) {
						return {
							component: 'coin',
							icon: row.coin.icon,
							symbol: row.coin.symbol,
							name: `*${row.coin.symbol}`,
							size: 4
						};
					}
					return { component: 'text', text: '-' };
				}
				return {
					component: 'coin',
					icon: row.coin.icon,
					symbol: row.coin.symbol,
					name: `*${row.coin.symbol}`,
					size: 4
				};
			}
		},
		{
			key: 'sender',
			label: $_('global.sender'),
			class: 'w-[12%] min-w-[70px] md:w-[10%]',
			render: (value: any, row: any) => ({
				component: 'text',
				text: row.isTransfer ? row.sender || 'Unknown' : '-',
				class:
					row.isTransfer && row.sender && row.sender !== 'Unknown'
						? 'font-medium'
						: 'text-muted-foreground'
			})
		},
		{
			key: 'recipient',
			label: $_('global.receiver'),
			class: 'w-[12%] min-w-[70px] md:w-[10%]',
			render: (value: any, row: any) => ({
				component: 'text',
				text: row.isTransfer ? row.recipient || 'Unknown' : '-',
				class:
					row.isTransfer && row.recipient && row.recipient !== 'Unknown'
						? 'font-medium'
						: 'text-muted-foreground'
			})
		},
		{
			key: 'quantity',
			label: $_('global.quantity'),
			class: 'w-[12%] min-w-[70px] md:w-[10%] font-mono text-sm',
			render: (value: any, row: any) =>
				row.isTransfer && value === 0 ? '-' : formatQuantity(value)
		},
		{
			key: 'totalBaseCurrencyAmount',
			label: $_('global.amount'),
			class: 'w-[12%] min-w-[70px] md:w-[10%] font-mono text-sm font-medium',
			render: (value: any) => formatValue(value)
		},
		{
			key: 'timestamp',
			label: $_('global.date'),
			class: 'hidden md:table-cell md:w-[18%] text-muted-foreground text-sm',
			render: (value: any) => formatDate(value)
		},
		{
			key: 'note',
			label: $_('global.note'),
			class: 'hidden lg:table-cell w-[20%] text-muted-foreground text-sm',
			render: (value: any, row: any) => {
				const isTransfer =
					row.isTransfer || row.type === 'TRANSFER_IN' || row.type === 'TRANSFER_OUT';
				if (!isTransfer || !value) {
					return { component: 'text', text: '-', class: 'text-muted-foreground' };
				}
				return { component: 'text', text: value, class: 'text-sm italic truncate max-w-[180px]' };
			}
		}
	]);

	async function handleTransferSuccess() {
		await Promise.all([loadPortfolioData(), fetchRecentTransactions()]);
	}
</script>

<SEO
	title="Portfolio - XprismPlay"
	description="View your virtual cryptocurrency portfolio, simulated holdings, and trading performance in the Rugplay simulation game platform."
	noindex={true}
	keywords="virtual portfolio management, crypto holdings game, trading performance simulator, investment tracking game"
/>

<SendMoneyModal bind:open={sendMoneyModalOpen} onSuccess={handleTransferSuccess} />
<SignInConfirmDialog bind:open={shouldSignIn} />

<div class="container mx-auto max-w-7xl p-6">
	<div class="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
		<div>
			<h1 class="text-3xl font-bold">{$_('portfolio.title')}</h1>
			<p class="text-muted-foreground">{$_('portfolio.description')}</p>
		</div>
		{#if $USER_DATA}
			<div class="flex gap-2">
				<Button onclick={() => (sendMoneyModalOpen = true)}>
					<HugeiconsIcon icon={SentIcon} class="h-4 w-4" />
					{$_('portfolio.send_money.title')}
				</Button>
			</div>
		{/if}
	</div>

	{#if loading}
		<PortfolioSkeleton />
	{:else if !$USER_DATA}
		<div class="flex h-96 items-center justify-center">
			<div class="text-center">
				<div class="text-muted-foreground mb-4 text-xl">
					{$_('sign_in.portfolio.0')}
				</div>
				<Button onclick={() => (shouldSignIn = true)}>
					{$_('sign_in.portfolio.1')}</Button
				>
			</div>
		</div>
	{:else if error}
		<div class="flex h-96 items-center justify-center">
			<div class="text-center">
				<div class="text-muted-foreground mb-4 text-xl">{error}</div>
				<Button onclick={retryFetch}>{$_('globals.try_again')}</Button>
			</div>
		</div>
	{:else}
		<!-- Portfolio Overview -->
		<div class="mb-8">
			<!-- Portfolio Summary Cards -->
			<div class="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-3">
				<!-- Total Portfolio Value -->
				<Card.Root class="text-success gap-1">
					<Card.Header>
						<Card.Title class="flex items-center gap-2 text-sm font-medium">
							<HugeiconsIcon icon={Wallet01Icon} class="h-4 w-4" />
							{$_('portfolio.total')}
						</Card.Title>
					</Card.Header>
					<Card.Content>
						<p class="text-3xl font-bold">{formatValue(totalPortfolioValue)}</p>
					</Card.Content>
				</Card.Root>

				<!-- Base Currency Balance -->
				<Card.Root class="gap-1">
					<Card.Header>
						<Card.Title class="flex items-center gap-2 text-sm font-medium">
							<HugeiconsIcon icon={DollarCircleIcon} class="h-4 w-4" />
							{$_('portfolio.cash_balance.0')}
						</Card.Title>
					</Card.Header>
					<Card.Content>
						<p class="text-3xl font-bold">
							{formatValue(portfolioData?.baseCurrencyBalance || 0)}
						</p>
						<p class="text-muted-foreground text-xs">
							{$_('portfolio.cash_balance.1').replace(
								'{{percent}}',
								totalPortfolioValue > 0
									? (
											((portfolioData?.baseCurrencyBalance || 0) / totalPortfolioValue) *
											100
										).toFixed(1)
									: '100.0'
							)}
						</p>
					</Card.Content>
				</Card.Root>

				<!-- Coin Holdings Value -->
				<Card.Root class="gap-1">
					<Card.Header>
						<Card.Title class="flex items-center gap-2 text-sm font-medium">
							<HugeiconsIcon icon={TradeUpIcon} class="h-4 w-4" />
							{$_('portfolio.coin_holdings.0')}
						</Card.Title>
					</Card.Header>
					<Card.Content>
						<p class="text-3xl font-bold">{formatValue(portfolioData?.totalCoinValue || 0)}</p>
						<p class="text-muted-foreground text-xs">
							{$_('portfolio.coin_holdings.1').replace(
								'{{quantity}}',
								(portfolioData?.coinHoldings.length || 0).toString()
							)}
						</p>
					</Card.Content>
				</Card.Root>
			</div>

			{#if !hasHoldings}
				<!-- Empty State -->
				<Card.Root>
					<Card.Content class="py-16 text-center">
						<div
							class="bg-muted mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full"
						>
							<HugeiconsIcon icon={Wallet01Icon} class="text-muted-foreground h-8 w-8" />
						</div>
						<h3 class="mb-2 text-lg font-semibold">{$_('portfolio.no_coins.0')}</h3>
						<p class="text-muted-foreground mb-6">
							{$_('portfolio.no_coins.1')}
						</p>
						<div class="flex justify-center">
							<Button variant="outline" onclick={() => goto('/')}
								>{$_('portfolio.no_coins.2')}</Button
							>
						</div>
					</Card.Content>
				</Card.Root>
			{:else}
				<!-- Holdings Table -->
				<Card.Root>
					<Card.Header>
						<Card.Title>{$_('portfolio.your_holdings.0')}</Card.Title>
						<Card.Description>{$_('portfolio.your_holdings.1')}</Card.Description>
					</Card.Header>
					<Card.Content>
						<DataTable
							columns={holdingsColumns}
							data={portfolioData?.coinHoldings || []}
							onRowClick={(holding) => goto(`/coin/${holding.symbol}`)}
						/>
					</Card.Content>
				</Card.Root>
			{/if}

			<!-- Recent Transactions -->
			<Card.Root class="mt-8">
				<Card.Header>
					<div class="flex items-center justify-between">
						<div>
							<Card.Title class="flex items-center gap-2">
								<HugeiconsIcon icon={ReceiptDollarIcon} class="h-5 w-5" />
								{$_('portfolio.recent_transactions.0')}
							</Card.Title>
							<Card.Description>
								{$_('portfolio.recent_transactions.1')}</Card.Description
							>
						</div>
						{#if hasTransactions}
							<Button variant="outline" size="sm" onclick={() => goto('/transactions')}>
								{$_('portfolio.recent_transactions.2')}
							</Button>
						{/if}
					</div>
				</Card.Header>
				<Card.Content>
					<DataTable
						columns={transactionsColumns}
						data={transactions}
						onRowClick={(tx) => !tx.isTransfer && goto(`/coin/${tx.coin.symbol}`)}
						emptyIcon={Invoice03Icon}
						emptyTitle={$_('portfolio.no_transactions.0')}
						emptyDescription={$_('portfolio.no_transactions.1')}
					/>
				</Card.Content>
			</Card.Root>
		</div>
	{/if}
</div>
