<script lang="ts">
	import { onMount } from 'svelte';
	import { USER_DATA } from '$lib/stores/user-data';
	import { adminLogStore, type AdminLogEntry } from '$lib/stores/websocket';
	import * as Card from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import {
		Shield01Icon,
		LegalHammerIcon,
		UserCheck01Icon,
		Ticket01Icon,
		Cancel01Icon
	} from '@hugeicons/core-free-icons';
	import { hasFlag, UserFlags } from '$lib/data/flags';

	let historicalLogs = $state<AdminLogEntry[]>([]);
	let isLoading = $state(true);
	let hasMore = $state(false);
	let offset = $state(0);
	const LIMIT = 25;

	// Merge live logs from websocket store with historical, deduplicating by id
	let allLogs = $derived.by(() => {
		const live = $adminLogStore;
		const merged = [...live];
		for (const log of historicalLogs) {
			if (!merged.find((l) => l.id === log.id)) {
				merged.push(log);
			}
		}
		return merged.sort((a, b) => b.createdAt - a.createdAt);
	});

	async function loadLogs(reset = false) {
		if (reset) {
			offset = 0;
			historicalLogs = [];
		}
		try {
			const response = await fetch(`/api/admin/logs?limit=${LIMIT}&offset=${offset}`);
			if (response.ok) {
				const data = await response.json();
				historicalLogs = reset ? data.logs : [...historicalLogs, ...data.logs];
				hasMore = data.logs.length === LIMIT;
				offset += data.logs.length;
			}
		} catch (e) {
			console.error('Failed to load admin logs:', e);
		} finally {
			isLoading = false;
		}
	}

	function actionLabel(action: AdminLogEntry['action']) {
		switch (action) {
			case 'BAN':
				return 'Ban';
			case 'UNBAN':
				return 'Unban';
			case 'PROMO_CREATE':
				return 'Promo Created';
			case 'PROMO_DELETE':
				return 'Promo Deleted';
		}
	}

	function actionIcon(action: AdminLogEntry['action']) {
		switch (action) {
			case 'BAN':
				return LegalHammerIcon;
			case 'UNBAN':
				return UserCheck01Icon;
			case 'PROMO_CREATE':
				return Ticket01Icon;
			case 'PROMO_DELETE':
				return Cancel01Icon;
		}
	}

	function actionVariant(
		action: AdminLogEntry['action']
	): 'default' | 'secondary' | 'destructive' | 'outline' {
		switch (action) {
			case 'BAN':
				return 'destructive';
			case 'UNBAN':
				return 'default';
			case 'PROMO_CREATE':
				return 'secondary';
			case 'PROMO_DELETE':
				return 'outline';
		}
	}

	function formatTime(ts: number) {
		return new Date(ts).toLocaleString();
	}

	onMount(() => {
		if (hasFlag($USER_DATA?.flags ?? 0n, 'IS_ADMIN', 'IS_HEAD_ADMIN')) {
			loadLogs(true);
		}
	});
</script>

<svelte:head>
	<title>Admin Logs | XprismPlay</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

{#if !$USER_DATA || !hasFlag($USER_DATA?.flags ?? 0n, 'IS_ADMIN', 'IS_HEAD_ADMIN')}
	<div class="flex h-[80vh] items-center justify-center">
		<div class="text-center">
			<h1 class="text-2xl font-bold">Access Denied</h1>
			<p class="text-muted-foreground">You don't have permission to access this page.</p>
		</div>
	</div>
{:else}
	<div class="container mx-auto max-w-4xl space-y-4 py-6">
		<div class="flex items-center gap-3">
			<div class="bg-primary/10 rounded-lg p-2">
				<HugeiconsIcon icon={Shield01Icon} class="text-primary h-6 w-6" />
			</div>
			<div>
				<h1 class="text-2xl font-bold tracking-tight">Admin Logs</h1>
				<p class="text-muted-foreground flex items-center gap-1 text-sm">
					<span class="relative flex h-2 w-2">
						<span
							class="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75"
						></span>
						<span class="relative inline-flex h-2 w-2 rounded-full bg-green-500"></span>
					</span>
					Live — new actions appear instantly
				</p>
			</div>
		</div>

		<Card.Root>
			<Card.Content class="p-0">
				{#if isLoading}
					<div class="space-y-0 divide-y">
						{#each Array(8) as _}
							<div class="flex items-start gap-4 p-4">
								<Skeleton class="h-8 w-8 flex-shrink-0 rounded-full" />
								<div class="flex-1 space-y-2">
									<Skeleton class="h-4 w-48" />
									<Skeleton class="h-3 w-72" />
								</div>
								<Skeleton class="h-3 w-28" />
							</div>
						{/each}
					</div>
				{:else if allLogs.length === 0}
					<div class="text-muted-foreground py-16 text-center">
						<HugeiconsIcon icon={Shield01Icon} class="mx-auto mb-3 h-10 w-10 opacity-30" />
						<p class="text-sm">No admin actions logged yet.</p>
					</div>
				{:else}
					<div class="divide-y">
						{#each allLogs as log (log.id)}
							<div class="hover:bg-muted/30 flex items-start gap-4 p-4 transition-colors">
								<div
									class="bg-muted flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full"
								>
									<HugeiconsIcon icon={actionIcon(log.action)} class="h-4 w-4" />
								</div>
								<div class="min-w-0 flex-1 space-y-1">
									<div class="flex flex-wrap items-center gap-2">
										<Badge variant={actionVariant(log.action)} class="text-xs">
											{actionLabel(log.action)}
										</Badge>
										<span class="text-sm">
											by
											<a
												href="/user/{log.adminId}"
												class="text-primary font-medium hover:underline"
											>
												@{log.adminUsername}
											</a>
										</span>
										{#if log.targetUserId && log.targetUsername}
											<span class="text-muted-foreground text-sm">
												→
												<a href="/user/{log.targetUserId}" class="font-medium hover:underline">
													@{log.targetUsername}
												</a>
											</span>
										{/if}
									</div>
									{#if log.details}
										<p class="text-muted-foreground text-xs">{log.details}</p>
									{/if}
								</div>
								<time class="text-muted-foreground flex-shrink-0 text-xs tabular-nums">
									{formatTime(log.createdAt)}
								</time>
							</div>
						{/each}
					</div>

					{#if hasMore}
						<div class="border-t p-4 text-center">
							<button onclick={() => loadLogs()} class="text-primary text-sm hover:underline">
								Load more
							</button>
						</div>
					{/if}
				{/if}
			</Card.Content>
		</Card.Root>
	</div>
{/if}
