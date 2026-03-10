<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import * as Popover from '$lib/components/ui/popover';
	import * as Pagination from '$lib/components/ui/pagination';
	import * as Select from '$lib/components/ui/select';
	import * as Table from '$lib/components/ui/table';
	import { Input } from '$lib/components/ui/input';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { Label } from '$lib/components/ui/label';
	import CoinIcon from '$lib/components/self/CoinIcon.svelte';
	import SEO from '$lib/components/self/SEO.svelte';
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import {
		Search01Icon,
		Refresh01Icon,
		SlidersHorizontalIcon,
		ArrowLeft01Icon,
		ArrowRight01Icon,
		ReceiptDollarIcon,
		Invoice03Icon,
		ArrowDown01Icon,
		FileEditIcon
	} from '@hugeicons/core-free-icons';
	import { formatPrice, formatValue, formatQuantity, formatDate, debounce } from '$lib/utils';
	import { MediaQuery } from 'svelte/reactivity';

	let transactions = $state<any[]>([]);
	let totalCount = $state(0);
	let loading = $state(true);
	let searchQuery = $state($page.url.searchParams.get('search') || '');
	let typeFilter = $state($page.url.searchParams.get('type') || 'all');
	let sortBy = $state($page.url.searchParams.get('sortBy') || 'timestamp');
	let sortOrder = $state($page.url.searchParams.get('sortOrder') || 'desc');
	let showFilterPopover = $state(false);
	let currentPage = $state(parseInt($page.url.searchParams.get('page') || '1'));
	let expandedRows = $state<Set<number>>(new Set());

	function toggleRow(id: number) {
		const next = new Set(expandedRows);
		if (next.has(id)) {
			next.delete(id);
		} else {
			next.add(id);
		}
		expandedRows = next;
	}

	const isDesktop = new MediaQuery('(min-width: 768px)');
	let perPage = $derived(isDesktop.current ? 20 : 15);
	let siblingCount = $derived(isDesktop.current ? 1 : 0);

	const typeFilterOptions = [
		{ value: 'all', label: 'All transactions' },
		{ value: 'BUY', label: 'Buys only' },
		{ value: 'SELL', label: 'Sells only' },
		{ value: 'TRANSFER_IN', label: 'Received transfers' },
		{ value: 'TRANSFER_OUT', label: 'Sent transfers' }
	];

	const sortOrderOptions = [
		{ value: 'desc', label: 'Newest first' },
		{ value: 'asc', label: 'Oldest first' }
	];

	const debouncedSearch = debounce(performSearch, 300);
	let previousSearchQueryForEffect = $state('');

	onMount(() => {
		fetchTransactions();
	});

	function updateURL() {
		const url = new URL($page.url);

		if (searchQuery) {
			url.searchParams.set('search', searchQuery);
		} else {
			url.searchParams.delete('search');
		}

		if (typeFilter !== 'all') {
			url.searchParams.set('type', typeFilter);
		} else {
			url.searchParams.delete('type');
		}

		if (sortBy !== 'timestamp') {
			url.searchParams.set('sortBy', sortBy);
		} else {
			url.searchParams.delete('sortBy');
		}

		if (sortOrder !== 'desc') {
			url.searchParams.set('sortOrder', sortOrder);
		} else {
			url.searchParams.delete('sortOrder');
		}

		if (currentPage !== 1) {
			url.searchParams.set('page', currentPage.toString());
		} else {
			url.searchParams.delete('page');
		}

		goto(url.toString(), { noScroll: true, replaceState: true });
	}

	async function fetchTransactions() {
		loading = true;
		try {
			const params = new URLSearchParams({
				search: searchQuery,
				type: typeFilter,
				sortBy,
				sortOrder,
				page: currentPage.toString(),
				limit: perPage.toString()
			});

			const response = await fetch(`/api/transactions?${params}`);
			if (response.ok) {
				const result = await response.json();
				transactions = result.transactions;
				totalCount = result.total;
			} else {
				toast.error('Failed to load transactions');
			}
		} catch (e) {
			console.error('Failed to fetch transactions:', e);
			toast.error('Failed to load transactions');
		} finally {
			loading = false;
		}
	}

	function performSearch() {
		currentPage = 1;
		fetchTransactions();
	}

	function updateSearchUrl() {
		updateURL();
	}

	function handleSearchKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			updateSearchUrl();
		}
	}

	$effect(() => {
		if (searchQuery !== previousSearchQueryForEffect) {
			debouncedSearch();
			previousSearchQueryForEffect = searchQuery;
		}
	});

	function handleSortChange(newSortBy: string) {
		if (sortBy === newSortBy) {
			sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
		} else {
			sortBy = newSortBy;
			sortOrder = newSortBy === 'timestamp' ? 'desc' : 'desc';
		}
		currentPage = 1;
		updateURL();
		fetchTransactions();
	}

	function handleTypeFilterChange() {
		currentPage = 1;
		updateURL();
		fetchTransactions();
	}

	function handleSortOrderChange() {
		currentPage = 1;
		updateURL();
		fetchTransactions();
	}

	function resetFilters() {
		searchQuery = '';
		typeFilter = 'all';
		sortBy = 'timestamp';
		sortOrder = 'desc';
		currentPage = 1;

		goto('/transactions', { noScroll: true, replaceState: true });
		fetchTransactions();
		showFilterPopover = false;
	}

	function applyFilters() {
		currentPage = 1;
		updateURL();
		fetchTransactions();
		showFilterPopover = false;
	}

	let hasActiveFilters = $derived(
		searchQuery !== '' || typeFilter !== 'all' || sortBy !== 'timestamp' || sortOrder !== 'desc'
	);

	let totalPages = $derived(Math.ceil(totalCount / perPage));
	let startIndex = $derived((currentPage - 1) * perPage + 1);
	let endIndex = $derived(Math.min(currentPage * perPage, totalCount));

	function handlePageChange(page: number) {
		currentPage = page;
		updateURL();
		fetchTransactions();
	}

	let currentTypeFilterLabel = $derived(
		typeFilterOptions.find((option) => option.value === typeFilter)?.label || 'All transactions'
	);
	let currentSortOrderLabel = $derived(
		sortOrderOptions.find((option) => option.value === sortOrder)?.label || 'Newest first'
	);
</script>

<SEO
	title="Transactions - XprismPlay"
	description="View your complete trading history and transaction records in the Rugplay cryptocurrency simulation game."
	noindex={true}
	keywords="trading history game, transaction records simulator, crypto trading log, virtual trading history"
/>

<div class="container mx-auto max-w-7xl p-6">
	<header class="mb-8">
		<div class="text-center">
			<h1 class="mb-2 text-3xl font-bold">Transactions</h1>
			<p class="text-muted-foreground mb-6">
				Complete record of your trading activity and transactions
			</p>

			<div class="mx-auto flex max-w-2xl items-center justify-center gap-2">
				<div class="relative flex-1">
					<HugeiconsIcon
						icon={Search01Icon}
						class="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
					/>
					<Input
						bind:value={searchQuery}
						placeholder="Search by coin name or symbol..."
						class="pr-4 pl-10"
						onblur={updateSearchUrl}
						onkeydown={handleSearchKeydown}
					/>
				</div>

				<Popover.Root bind:open={showFilterPopover}>
					<Popover.Trigger>
						<Button variant="outline" size="default" class="flex items-center gap-2">
							<HugeiconsIcon icon={SlidersHorizontalIcon} class="h-4 w-4" />
							Filters
							{#if hasActiveFilters}
								<Badge variant="secondary" class="h-5 w-5 rounded-full p-0 text-xs">•</Badge>
							{/if}
						</Button>
					</Popover.Trigger>
					<Popover.Content class="w-80 p-4" align="end">
						<div class="space-y-4">
							<div class="space-y-2">
								<Label class="text-sm font-medium">Sort By</Label>
								<div class="grid grid-cols-2 gap-2">
									<Button
										variant={sortBy === 'timestamp' ? 'default' : 'outline'}
										size="sm"
										onclick={() => handleSortChange('timestamp')}
									>
										Date
									</Button>
									<Button
										variant={sortBy === 'totalBaseCurrencyAmount' ? 'default' : 'outline'}
										size="sm"
										onclick={() => handleSortChange('totalBaseCurrencyAmount')}
									>
										Amount
									</Button>
									<Button
										variant={sortBy === 'quantity' ? 'default' : 'outline'}
										size="sm"
										onclick={() => handleSortChange('quantity')}
									>
										Quantity
									</Button>
									<Button
										variant={sortBy === 'pricePerCoin' ? 'default' : 'outline'}
										size="sm"
										onclick={() => handleSortChange('pricePerCoin')}
									>
										Price
									</Button>
								</div>
							</div>

							<div class="space-y-2">
								<Label class="text-sm font-medium">Sort Order</Label>
								<Select.Root
									type="single"
									bind:value={sortOrder}
									onValueChange={handleSortOrderChange}
								>
									<Select.Trigger class="w-full">
										{currentSortOrderLabel}
									</Select.Trigger>
									<Select.Content>
										<Select.Group>
											{#each sortOrderOptions as option}
												<Select.Item value={option.value} label={option.label}>
													{option.label}
												</Select.Item>
											{/each}
										</Select.Group>
									</Select.Content>
								</Select.Root>
							</div>

							<div class="space-y-2">
								<Label class="text-sm font-medium">Transaction Type</Label>
								<Select.Root
									type="single"
									bind:value={typeFilter}
									onValueChange={handleTypeFilterChange}
								>
									<Select.Trigger class="w-full">
										{currentTypeFilterLabel}
									</Select.Trigger>
									<Select.Content>
										<Select.Group>
											{#each typeFilterOptions as option}
												<Select.Item value={option.value} label={option.label}>
													{option.label}
												</Select.Item>
											{/each}
										</Select.Group>
									</Select.Content>
								</Select.Root>
							</div>

							<div class="flex gap-2 pt-2">
								<Button variant="outline" size="sm" onclick={resetFilters} class="flex-1">
									Reset
								</Button>
								<Button size="sm" onclick={applyFilters} class="flex-1">Apply</Button>
							</div>
						</div>
					</Popover.Content>
				</Popover.Root>

				<Button variant="outline" size="default" onclick={fetchTransactions} disabled={loading}>
					<HugeiconsIcon icon={Refresh01Icon} class="h-4 w-4" />
				</Button>
			</div>
		</div>
	</header>

	<!-- Pagination Info -->
	{#if !loading && totalCount > 0}
		<div class="mb-4 flex items-center justify-between">
			<div class="text-muted-foreground text-sm">
				Showing {startIndex}-{endIndex} of {totalCount} transactions
			</div>
			{#if hasActiveFilters}
				<Button variant="link" size="sm" onclick={resetFilters} class="h-auto p-0">
					Clear all filters
				</Button>
			{/if}
		</div>
	{/if}

	<!-- Transactions Table -->
	<Card.Root>
		<Card.Header>
			<Card.Title class="flex items-center gap-2">
				<HugeiconsIcon icon={ReceiptDollarIcon} class="h-5 w-5" />
				History
			</Card.Title>
			<Card.Description>Complete record of your trading activity and transfers</Card.Description>
		</Card.Header>
		<Card.Content>
			{#if loading}
				<div class="space-y-4">
					{#each Array(10) as _}
						<div class="bg-muted h-16 animate-pulse rounded-lg"></div>
					{/each}
				</div>
			{:else if transactions.length === 0}
				<div class="py-12 text-center">
					<div
						class="bg-muted mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full"
					>
						<HugeiconsIcon icon={Invoice03Icon} class="text-muted-foreground h-6 w-6" />
					</div>
					<h3 class="mb-2 text-lg font-semibold">No transactions found</h3>
					<p class="text-muted-foreground">
						{hasActiveFilters
							? 'No transactions match your current filters. Try adjusting your search criteria.'
							: "You haven't made any trades or transfers yet. Start by buying coins or sending money to other users."}
					</p>
				</div>
			{:else}
				<Table.Root>
					<Table.Header>
						<Table.Row>
							<Table.Head class="w-[10%] min-w-[80px]">Type</Table.Head>
							<Table.Head class="w-[20%] min-w-[120px]">Asset</Table.Head>
							<Table.Head class="w-[12%] min-w-[80px]">Sender</Table.Head>
							<Table.Head class="w-[12%] min-w-[80px]">Receiver</Table.Head>
							<Table.Head class="w-[15%] min-w-[100px] font-mono">Quantity</Table.Head>
							<Table.Head class="w-[15%] min-w-[80px] font-mono">Price</Table.Head>
							<Table.Head class="w-[15%] min-w-[80px] font-mono">Total</Table.Head>
							<Table.Head class="w-[25%] min-w-[120px]">Date</Table.Head>
							<!-- chevron column -->
							<Table.Head class="w-8"></Table.Head>
						</Table.Row>
					</Table.Header>
					<Table.Body>
						{#each transactions as tx (tx.id)}
							{@const isExpanded = expandedRows.has(tx.id)}
							{@const hasNote = tx.isTransfer && tx.note}
							<!-- Main row -->
							<Table.Row
								class="hover:bg-muted/50 cursor-pointer transition-colors select-none"
								onclick={() => toggleRow(tx.id)}
							>
								<!-- Type -->
								<Table.Cell>
									{#if tx.isTransfer}
										<Badge variant="default" class="text-xs">
											{tx.isIncoming ? 'Received' : 'Sent'}
										</Badge>
									{:else}
										<Badge variant={tx.type === 'BUY' ? 'success' : 'destructive'} class="text-xs">
											{tx.type === 'BUY' ? 'Buy' : 'Sell'}
										</Badge>
									{/if}
								</Table.Cell>
								<!-- Asset — link stops propagation so clicking coin navigates, not expands -->
								<Table.Cell>
									{#if tx.isTransfer && !tx.isCoinTransfer}
										<span class="font-medium">Cash ($)</span>
									{:else if tx.coin}
										<a
											href="/coin/{tx.coin.symbol}"
											class="flex items-center gap-2 hover:underline"
											onclick={(e) => e.stopPropagation()}
										>
											<CoinIcon icon={tx.coin.icon} symbol={tx.coin.symbol} size={6} />
											<span class="max-w-44 truncate font-medium">*{tx.coin.symbol}</span>
										</a>
									{/if}
								</Table.Cell>
								<!-- Sender -->
								<Table.Cell>
									{#if tx.isTransfer && tx.sender}
										<span class="font-medium">{tx.sender}</span>
									{:else}
										<span class="text-muted-foreground">-</span>
									{/if}
								</Table.Cell>
								<!-- Receiver -->
								<Table.Cell>
									{#if tx.isTransfer && tx.recipient}
										<span class="font-medium">{tx.recipient}</span>
									{:else}
										<span class="text-muted-foreground">-</span>
									{/if}
								</Table.Cell>
								<!-- Quantity -->
								<Table.Cell class="font-mono">
									{#if tx.isTransfer && tx.quantity === 0}
										<span class="text-muted-foreground">-</span>
									{:else}
										{formatQuantity(tx.quantity)}
									{/if}
								</Table.Cell>
								<!-- Price -->
								<Table.Cell class="font-mono">
									{#if tx.isTransfer || tx.pricePerCoin === 0}
										<span class="text-muted-foreground">-</span>
									{:else}
										${formatPrice(tx.pricePerCoin)}
									{/if}
								</Table.Cell>
								<!-- Total -->
								<Table.Cell class="font-mono font-medium">
									{tx.type === 'TRANSFER_IN' || tx.type === 'BUY' ? '+' : '-'}{formatValue(
										tx.totalBaseCurrencyAmount
									)}
								</Table.Cell>
								<!-- Date -->
								<Table.Cell class="text-muted-foreground text-sm">
									{formatDate(tx.timestamp)}
								</Table.Cell>
								<!-- Chevron -->
								<Table.Cell class="w-8 pr-3 text-right">
									<HugeiconsIcon
										icon={ArrowDown01Icon}
										class="text-muted-foreground h-4 w-4 transition-transform duration-200 {isExpanded
											? 'rotate-180'
											: ''} {hasNote ? '' : 'opacity-30'}"
									/>
								</Table.Cell>
							</Table.Row>
							<!-- Expanded detail row -->
							{#if isExpanded}
								<Table.Row class="bg-muted/30 hover:bg-muted/30">
									<Table.Cell colspan={9} class="px-6 py-3">
										<div class="flex items-start gap-2 text-sm">
											<HugeiconsIcon
												icon={FileEditIcon}
												class="text-muted-foreground mt-0.5 h-4 w-4 shrink-0"
											/>
											{#if hasNote}
												<p class="text-foreground whitespace-pre-wrap">{tx.note}</p>
											{:else}
												<p class="text-muted-foreground italic">
													No note attached to this transfer.
												</p>
											{/if}
										</div>
									</Table.Cell>
								</Table.Row>
							{/if}
						{/each}
					</Table.Body>
				</Table.Root>
			{/if}
		</Card.Content>
	</Card.Root>

	<!-- Pagination -->
	{#if !loading && totalPages > 1}
		<div class="mt-8 flex justify-center">
			<Pagination.Root
				count={totalCount}
				{perPage}
				{siblingCount}
				page={currentPage}
				onPageChange={handlePageChange}
			>
				{#snippet children({ pages, currentPage: paginationCurrentPage })}
					<Pagination.Content>
						<Pagination.Item>
							<Pagination.PrevButton>
								<HugeiconsIcon icon={ArrowLeft01Icon} class="h-4 w-4" />
								<span class="hidden sm:block">Previous</span>
							</Pagination.PrevButton>
						</Pagination.Item>
						{#each pages as page (page.key)}
							{#if page.type === 'ellipsis'}
								<Pagination.Item>
									<Pagination.Ellipsis />
								</Pagination.Item>
							{:else}
								<Pagination.Item>
									<Pagination.Link {page} isActive={paginationCurrentPage === page.value}>
										{page.value}
									</Pagination.Link>
								</Pagination.Item>
							{/if}
						{/each}
						<Pagination.Item>
							<Pagination.NextButton>
								<span class="hidden sm:block">Next</span>
								<HugeiconsIcon icon={ArrowRight01Icon} class="h-4 w-4" />
							</Pagination.NextButton>
						</Pagination.Item>
					</Pagination.Content>
				{/snippet}
			</Pagination.Root>
		</div>
	{/if}
</div>
