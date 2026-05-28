<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import * as Dialog from '$lib/components/ui/dialog';
	import * as Avatar from '$lib/components/ui/avatar';
	import { ScrollArea } from '$lib/components/ui/scroll-area/index.js';
	import { Badge } from '$lib/components/ui/badge';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { UserGroupIcon, MoneyBag02Icon } from '@hugeicons/core-free-icons';
	import { goto } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import { getPublicUrl, formatQuantity, formatValue } from '$lib/utils';
	import DataTable from './DataTable.svelte';
	import HoldersSkeleton from './skeletons/HoldersSkeleton.svelte';

	interface Staker {
		rank: number;
		userId: number;
		username: string;
		name: string;
		image: string | null;
		quantity: number;
		percentage: number;
		value: number;
	}

	interface StakersData {
		coinSymbol: string;
		totalStakers: number;
		totalStaked: number;
		stakers: Staker[];
	}

	let { coinSymbol } = $props<{ coinSymbol: string }>();

	let loading = $state(true);
	let stakersData = $state<StakersData | null>(null);
	let modalOpen = $state(false);

	async function fetchStakers() {
		try {
			const response = await fetch(`/api/coin/${coinSymbol}/stakers?limit=50`);
			if (!response.ok) {
				if (response.status === 404) return;
				throw new Error('Failed to fetch stakers');
			}
			stakersData = await response.json();
		} catch (e) {
			toast.error('Failed to load top stakers');
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		if (coinSymbol) {
			loading = true;
			stakersData = null;
			fetchStakers();
		}
	});

	let stakersColumns = $derived([
		{
			key: 'rank',
			label: 'Rank',
			class: 'w-[10%] min-w-[60px]',
			render: (value: any) => `#${value}`
		},
		{
			key: 'user',
			label: 'User',
			class: 'w-[35%] min-w-[150px]',
			render: (value: any, row: any) => ({
				component: 'user',
				image: row.image,
				name: row.name || 'Anonymous',
				username: row.username
			})
		},
		{
			key: 'quantity',
			label: 'Staked',
			class: 'w-[20%] min-w-[100px] font-mono',
			sortable: false,
			render: (value: any) => formatQuantity(value)
		},
		{
			key: 'percentage',
			label: '% of Pool',
			class: 'w-[12%] min-w-[70px]',
			sortable: false,
			render: (value: any) => ({
				component: 'badge',
				variant: 'secondary',
				text: `${value.toFixed(1)}%`
			})
		},
		{
			key: 'value',
			label: 'Est. Value',
			class: 'w-[23%] min-w-[90px] font-mono font-medium',
			sortable: true,
			defaultSort: 'desc' as const,
			render: (value: any) => formatValue(value)
		}
	]);
</script>

<Card.Root
	class="gap-2 {stakersData && stakersData.stakers.length > 3
		? 'hover:bg-card/90 cursor-pointer transition-colors'
		: ''}"
	onclick={() => stakersData && stakersData.stakers.length > 3 && (modalOpen = true)}
>
	<Card.Header>
		<Card.Title class="flex items-center gap-2">Top Stakers</Card.Title>
	</Card.Header>
	<Card.Content class="relative">
		{#if loading}
			<HoldersSkeleton />
		{:else if !stakersData || stakersData.stakers.length === 0}
			<div class="py-4 text-center">
				<HugeiconsIcon icon={MoneyBag02Icon} class="text-muted-foreground mx-auto mb-2 h-8 w-8" />
				<p class="text-muted-foreground text-sm">No stakers found</p>
			</div>
		{:else}
			<div class="space-y-3">
				{#each stakersData.stakers.slice(0, 3) as staker}
					<div class="flex items-center gap-2">
						<div
							class="flex min-w-0 flex-1 cursor-pointer items-center gap-3 border-none bg-transparent p-0 text-left"
						>
							<Avatar.Root class="h-8 w-8 flex-shrink-0">
								<Avatar.Image
									src={getPublicUrl(staker.image)}
									alt={staker.name || staker.username}
								/>
								<Avatar.Fallback class="text-xs"
									>{(staker.name || staker.username).charAt(0)}</Avatar.Fallback
								>
							</Avatar.Root>
							<div class="min-w-0 flex-1">
								<p class="truncate text-sm font-medium">{staker.name || 'Anonymous'}</p>
								<p class="text-muted-foreground truncate text-xs">@{staker.username}</p>
							</div>
						</div>
						<div class="flex flex-shrink-0 items-center gap-1.5 text-right">
							<div class="hidden sm:block">
								<Badge variant="secondary" class="text-xs">{staker.percentage.toFixed(1)}%</Badge>
							</div>
							<div class="flex flex-col items-end gap-0.5">
								<p class="text-muted-foreground font-mono text-xs">
									{formatQuantity(staker.quantity)}
								</p>
								<p class="text-muted-foreground/80 font-mono text-xs font-medium">
									{formatValue(staker.value)}
								</p>
							</div>
						</div>
					</div>
				{/each}
			</div>
		{/if}

		{#if stakersData && stakersData.stakers.length > 3}
			<div
				class="from-card/80 pointer-events-none absolute inset-0 bg-gradient-to-t via-transparent to-transparent"
			></div>
		{/if}
	</Card.Content>
</Card.Root>

<Dialog.Root bind:open={modalOpen}>
	<Dialog.Content
		class="flex max-h-[90vh] w-full max-w-[calc(100%-2rem)] flex-col sm:max-w-[800px] md:max-w-2xl"
	>
		<Dialog.Header class="flex-shrink-0">
			<Dialog.Title class="flex items-center gap-2">
				<HugeiconsIcon icon={MoneyBag02Icon} class="h-5 w-5" />
				Top Stakers (*{stakersData?.coinSymbol})
			</Dialog.Title>
			<Dialog.Description>This list is limited to the top 50 stakers.</Dialog.Description>
		</Dialog.Header>

		<div class="min-h-0 flex-1">
			{#if stakersData && stakersData.stakers.length > 0}
				<ScrollArea class="h-[600px] rounded-md border">
					<div class="bg-card p-2">
						<DataTable
							columns={stakersColumns}
							data={stakersData.stakers}
							onRowClick={(staker) => goto(`/user/${staker.username}`)}
							enableUserPreview={true}
							emptyTitle="No stakers found"
							emptyDescription="This coin doesn't have any stakers yet."
						/>
					</div>
				</ScrollArea>
			{:else}
				<div class="flex h-full items-center justify-center py-12 text-center">
					<div>
						<HugeiconsIcon
							icon={MoneyBag02Icon}
							class="text-muted-foreground mx-auto mb-4 h-12 w-12"
						/>
						<h3 class="mb-2 text-lg font-semibold">No stakers found</h3>
						<p class="text-muted-foreground">This coin doesn't have any stakers yet.</p>
					</div>
				</div>
			{/if}
		</div>
	</Dialog.Content>
</Dialog.Root>
