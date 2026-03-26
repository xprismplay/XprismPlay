<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { Input } from '$lib/components/ui/input';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import {
		Search01Icon,
		UserGroupIcon,
		Add01Icon,
		Locker01Icon,
		Globe02Icon,
		Refresh01Icon
	} from '@hugeicons/core-free-icons';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import { USER_DATA } from '$lib/stores/user-data';
	import { formatValue } from '$lib/utils';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Switch } from '$lib/components/ui/switch';
	import { _ } from 'svelte-i18n';

	type GroupItem = {
		id: string | number;
		name: string;
		description?: string | null;
		isPublic: boolean;
		ownerName?: string | null;
		memberCount: number;
		treasuryBalance: number | string;
		role?: 'owner' | 'admin' | 'member';
	};

	let allGroups = $state<GroupItem[]>([]);
	let myGroups = $state<GroupItem[]>([]);
	let loading = $state(true);
	let myLoading = $state(true);
	let search = $state('');
	let page = $state(1);
	let totalPages = $state(1);
	let createOpen = $state(false);
	let creating = $state(false);

	let newName = $state('');
	let newDesc = $state('');
	let newPublic = $state(true);

	const CREATION_COST = 500;
	const MAX_GROUPS = 2;

	onMount(async () => {
		await Promise.all([fetchGroups(), fetchMyGroups()]);
	});

	function roleLabel(role?: GroupItem['role']) {
		switch (role) {
			case 'owner':
				return $_('groups.roles.owner');
			case 'admin':
				return $_('groups.roles.admin');
			default:
				return $_('groups.roles.member');
		}
	}

	function roleVariant(role?: GroupItem['role']) {
		switch (role) {
			case 'owner':
				return 'default';
			case 'admin':
				return 'secondary';
			default:
				return 'outline';
		}
	}

	function visibilityLabel(isPublic: boolean) {
		return isPublic ? $_('groups.visibility.public') : $_('groups.visibility.private');
	}

	async function fetchGroups() {
		loading = true;

		try {
			const params = new URLSearchParams({ page: page.toString() });
			if (search.trim()) params.set('search', search.trim());

			const r = await fetch(`/api/groups?${params}`);
			if (r.ok) {
				const d = await r.json();
				allGroups = d.groups;
				totalPages = d.totalPages;
			} else {
				toast.error('Failed to load groups');
			}
		} catch {
			toast.error('Failed to load groups');
		} finally {
			loading = false;
		}
	}

	async function fetchMyGroups() {
		if (!$USER_DATA) {
			myLoading = false;
			return;
		}

		myLoading = true;
		try {
			const r = await fetch('/api/groups?mine=true');
			if (r.ok) {
				myGroups = (await r.json()).groups;
			}
		} catch {
			// silencioso
		} finally {
			myLoading = false;
		}
	}

	async function handleCreate() {
		if (!newName.trim()) {
			toast.error($_('groups.create.errors.name_required'));
			return;
		}

		creating = true;
		try {
			const r = await fetch('/api/groups', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: newName,
					description: newDesc,
					isPublic: newPublic
				})
			});

			const d = await r.json();

			if (!r.ok) {
				toast.error(d.message || $_('groups.create.errors.failed'));
				return;
			}

			toast.success($_('groups.create.success'));
			createOpen = false;
			newName = '';
			newDesc = '';
			newPublic = true;
			goto(`/groups/${d.group.id}`);
		} catch {
			toast.error($_('groups.create.errors.failed'));
		} finally {
			creating = false;
		}
	}

	let searchTimeout: ReturnType<typeof setTimeout> | undefined;

	function onSearchInput() {
		if (searchTimeout) clearTimeout(searchTimeout);

		searchTimeout = setTimeout(() => {
			page = 1;
			fetchGroups();
		}, 400);
	}
</script>

<Dialog.Root bind:open={createOpen}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>{$_('groups.create.title')}</Dialog.Title>
			<Dialog.Description>
				{$_('groups.create.description', { values: { cost: CREATION_COST, max: MAX_GROUPS } })}
			</Dialog.Description>
		</Dialog.Header>

		<div class="space-y-4">
			<div class="space-y-1">
				<Label>{$_('groups.create.name_label')}</Label>
				<Input
					bind:value={newName}
					placeholder={$_('groups.create.name_placeholder')}
					maxlength={50}
				/>
				<p class="text-muted-foreground text-xs">{$_('groups.create.name_hint')}</p>
			</div>

			<div class="space-y-1">
				<Label>{$_('groups.create.desc_label')}</Label>
				<Textarea
					bind:value={newDesc}
					placeholder={$_('groups.create.desc_placeholder')}
					maxlength={500}
					rows={3}
				/>
			</div>

			<div class="flex items-center justify-between rounded-lg border p-3">
				<div>
					<p class="text-sm font-medium">{$_('groups.create.public_label')}</p>
					<p class="text-muted-foreground text-xs">{$_('groups.create.public_hint')}</p>
				</div>
				<Switch bind:checked={newPublic} />
			</div>
		</div>

		<Dialog.Footer>
			<Button variant="outline" onclick={() => (createOpen = false)}>
				{$_('global.cancel')}
			</Button>
			<Button onclick={handleCreate} disabled={creating || !newName.trim()}>
				{creating
					? $_('groups.create.creating')
					: $_('groups.create.submit', { values: { cost: CREATION_COST } })}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<div class="container mx-auto max-w-7xl p-6">
	<header class="mb-8">
		<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
			<div>
				<h1 class="flex items-center gap-2 text-3xl font-bold">
					<HugeiconsIcon icon={UserGroupIcon} class="h-8 w-8" />
					{$_('groups.title')}
				</h1>
				<p class="text-muted-foreground">{$_('groups.description')}</p>
			</div>

			{#if $USER_DATA}
				<Button onclick={() => (createOpen = true)}>
					<HugeiconsIcon icon={Add01Icon} class="h-4 w-4" />
					{$_('groups.create.button')}
				</Button>
			{/if}
		</div>
	</header>

	{#if $USER_DATA && myGroups.length > 0}
		<section class="mb-8">
			<h2 class="mb-4 text-xl font-semibold">{$_('groups.my_groups')}</h2>

			{#if myLoading}
				<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{#each Array(3) as _}
						<Skeleton class="h-32 rounded-xl" />
					{/each}
				</div>
			{:else}
				<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{#each myGroups as g}
						<button
							class="hover:bg-card/80 flex flex-col gap-2 rounded-xl border p-4 text-left transition-colors"
							onclick={() => goto(`/groups/${g.id}`)}
						>
							<div class="flex items-center justify-between gap-3">
								<div class="min-w-0">
									<span class="block truncate font-semibold">{g.name}</span>
								</div>

								<div class="flex items-center gap-1">
									<Badge variant={roleVariant(g.role)} class="text-xs capitalize">
										{roleLabel(g.role)}
									</Badge>

									<Badge variant={g.isPublic ? 'secondary' : 'outline'} class="text-xs">
										{visibilityLabel(g.isPublic)}
									</Badge>

									{#if !g.isPublic}
										<HugeiconsIcon
											icon={Locker01Icon}
											class="text-muted-foreground h-3 w-3"
										/>
									{/if}
								</div>
							</div>

							{#if g.description}
								<p class="text-muted-foreground line-clamp-2 text-sm">{g.description}</p>
							{/if}

							<p class="text-muted-foreground text-xs">
								{$_('groups.members_count', { values: { count: g.memberCount } })}
							</p>
						</button>
					{/each}
				</div>
			{/if}
		</section>
	{/if}

	<section>
		<div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
			<div class="relative flex-1">
				<HugeiconsIcon
					icon={Search01Icon}
					class="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
				/>
				<Input
					bind:value={search}
					oninput={onSearchInput}
					placeholder={$_('groups.search_placeholder')}
					class="pl-10"
				/>
			</div>

			<Button
				variant="outline"
				onclick={() => {
					page = 1;
					fetchGroups();
				}}
				disabled={loading}
			>
				<HugeiconsIcon icon={Refresh01Icon} class="h-4 w-4" />
			</Button>
		</div>

		<h2 class="mb-4 text-xl font-semibold">{$_('groups.browse')}</h2>

		{#if loading}
			<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{#each Array(6) as _}
					<Skeleton class="h-40 rounded-xl" />
				{/each}
			</div>
		{:else if allGroups.length === 0}
			<div class="flex h-60 flex-col items-center justify-center gap-4 text-center">
				<HugeiconsIcon icon={UserGroupIcon} class="text-muted-foreground/40 h-16 w-16" />
				<p class="text-muted-foreground">{$_('groups.no_groups')}</p>
			</div>
		{:else}
			<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{#each allGroups as g}
					<Card.Root
						class="hover:bg-card/80 cursor-pointer transition-colors"
						onclick={() => goto(`/groups/${g.id}`)}
					>
						<Card.Header class="pb-2">
							<div class="flex items-center justify-between gap-3">
								<Card.Title class="truncate text-base">{g.name}</Card.Title>
								<HugeiconsIcon
									icon={g.isPublic ? Globe02Icon : Locker01Icon}
									class="text-muted-foreground h-4 w-4"
								/>
							</div>

							<div class="flex flex-wrap items-center gap-2">
								<Badge variant={g.isPublic ? 'secondary' : 'outline'} class="text-xs">
									{visibilityLabel(g.isPublic)}
								</Badge>

								{#if g.ownerName}
									<Card.Description class="text-xs">
										{$_('groups.detail.owner')} {g.ownerName}
									</Card.Description>
								{/if}
							</div>
						</Card.Header>

						<Card.Content>
							{#if g.description}
								<p class="text-muted-foreground mb-2 line-clamp-2 text-sm">{g.description}</p>
							{/if}

							<div class="text-muted-foreground flex flex-wrap gap-4 text-xs">
								<span>{$_('groups.members_count', { values: { count: g.memberCount } })}</span>
								<span>{$_('groups.treasury', { values: { value: formatValue(Number(g.treasuryBalance)) } })}</span>
							</div>
						</Card.Content>
					</Card.Root>
				{/each}
			</div>

			{#if totalPages > 1}
				<div class="mt-6 flex justify-center gap-2">
					<Button
						variant="outline"
						size="sm"
						disabled={page <= 1}
						onclick={() => {
							page--;
							fetchGroups();
						}}
					>
						Previous
					</Button>

					<span class="flex items-center text-sm">{page} / {totalPages}</span>

					<Button
						variant="outline"
						size="sm"
						disabled={page >= totalPages}
						onclick={() => {
							page++;
							fetchGroups();
						}}
					>
						Next
					</Button>
				</div>
			{/if}
		{/if}
	</section>
</div>