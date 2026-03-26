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

	let allGroups = $state<any[]>([]);
	let myGroups = $state<any[]>([]);
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

	onMount(async () => {
		await Promise.all([fetchGroups(), fetchMyGroups()]);
	});

	async function fetchGroups() {
		loading = true;
		try {
			const params = new URLSearchParams({ page: page.toString() });
			if (search) params.set('search', search);
			const r = await fetch(`/api/groups?${params}`);
			if (r.ok) {
				const d = await r.json();
				allGroups = d.groups;
				totalPages = d.totalPages;
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
			if (r.ok) myGroups = (await r.json()).groups;
		} catch {
		} finally {
			myLoading = false;
		}
	}

	async function handleCreate() {
		if (!newName.trim()) {
			toast.error('Name required');
			return;
		}
		creating = true;
		try {
			const r = await fetch('/api/groups', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: newName, description: newDesc, isPublic: newPublic })
			});
			const d = await r.json();
			if (!r.ok) {
				toast.error(d.message || 'Failed to create group');
				return;
			}
			toast.success('Group created!');
			createOpen = false;
			newName = '';
			newDesc = '';
			newPublic = true;
			goto(`/groups/${d.group.id}`);
		} catch {
			toast.error('Failed to create group');
		} finally {
			creating = false;
		}
	}

	let searchTimeout: any;
	function onSearchInput() {
		clearTimeout(searchTimeout);
		searchTimeout = setTimeout(() => {
			page = 1;
			fetchGroups();
		}, 400);
	}
</script>

<Dialog.Root bind:open={createOpen}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Create a Group</Dialog.Title>
			<Dialog.Description
				>Costs ${CREATION_COST} to create a group. You can create up to 2 groups.</Dialog.Description
			>
		</Dialog.Header>
		<div class="space-y-4">
			<div class="space-y-1">
				<Label>Name</Label>
				<Input bind:value={newName} placeholder="My Awesome Group" maxlength={50} />
				<p class="text-muted-foreground text-xs">Letters, numbers, spaces, dashes, underscores</p>
			</div>
			<div class="space-y-1">
				<Label>Description</Label>
				<Textarea
					bind:value={newDesc}
					placeholder="What is this group about?"
					maxlength={500}
					rows={3}
				/>
			</div>
			<div class="flex items-center justify-between rounded-lg border p-3">
				<div>
					<p class="text-sm font-medium">Public Group</p>
					<p class="text-muted-foreground text-xs">Anyone can join without approval</p>
				</div>
				<Switch bind:checked={newPublic} />
			</div>
		</div>
		<Dialog.Footer>
			<Button variant="outline" onclick={() => (createOpen = false)}>Cancel</Button>
			<Button onclick={handleCreate} disabled={creating || !newName.trim()}>
				{creating ? 'Creating...' : `Create ($${CREATION_COST})`}
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
					Groups
				</h1>
				<p class="text-muted-foreground">Join communities and manage a shared treasury</p>
			</div>
			{#if $USER_DATA}
				<Button onclick={() => (createOpen = true)}>
					<HugeiconsIcon icon={Add01Icon} class="h-4 w-4" />
					Create Group
				</Button>
			{/if}
		</div>
	</header>

	{#if $USER_DATA && myGroups.length > 0}
		<section class="mb-8">
			<h2 class="mb-4 text-xl font-semibold">My Groups</h2>
			{#if myLoading}
				<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{#each Array(3) as _}<Skeleton class="h-32 rounded-xl" />{/each}
				</div>
			{:else}
				<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{#each myGroups as g}
						<button
							class="hover:bg-card/80 flex flex-col gap-2 rounded-xl border p-4 text-left transition-colors"
							onclick={() => goto(`/groups/${g.id}`)}
						>
							<div class="flex items-center justify-between">
								<span class="font-semibold">{g.name}</span>
								<div class="flex gap-1">
									<Badge
										variant={g.role === 'owner'
											? 'default'
											: g.role === 'admin'
												? 'secondary'
												: 'outline'}
										class="text-xs capitalize">{g.role}</Badge
									>
									{#if !g.isPublic}<HugeiconsIcon
											icon={Lock01Icon}
											class="text-muted-foreground h-3 w-3"
										/>{/if}
								</div>
							</div>
							{#if g.description}<p class="text-muted-foreground line-clamp-2 text-sm">
									{g.description}
								</p>{/if}
							<p class="text-muted-foreground text-xs">{g.memberCount} members</p>
						</button>
					{/each}
				</div>
			{/if}
		</section>
	{/if}

	<section>
		<div class="mb-4 flex items-center gap-2">
			<div class="relative flex-1">
				<HugeiconsIcon
					icon={Search01Icon}
					class="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
				/>
				<Input
					bind:value={search}
					oninput={onSearchInput}
					placeholder="Search groups..."
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

		{#if loading}
			<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{#each Array(6) as _}<Skeleton class="h-40 rounded-xl" />{/each}
			</div>
		{:else if allGroups.length === 0}
			<div class="flex h-60 flex-col items-center justify-center gap-4 text-center">
				<HugeiconsIcon icon={UserGroupIcon} class="text-muted-foreground/40 h-16 w-16" />
				<p class="text-muted-foreground">No groups found</p>
			</div>
		{:else}
			<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{#each allGroups as g}
					<Card.Root
						class="hover:bg-card/80 cursor-pointer transition-colors"
						onclick={() => goto(`/groups/${g.id}`)}
					>
						<Card.Header class="pb-2">
							<div class="flex items-center justify-between">
								<Card.Title class="text-base">{g.name}</Card.Title>
								<HugeiconsIcon
									icon={g.isPublic ? Globe02Icon : Locker01Icon}
									class="text-muted-foreground h-4 w-4"
								/>
							</div>
							{#if g.ownerName}
								<Card.Description class="text-xs">by {g.ownerName}</Card.Description>
							{/if}
						</Card.Header>
						<Card.Content>
							{#if g.description}
								<p class="text-muted-foreground mb-2 line-clamp-2 text-sm">{g.description}</p>
							{/if}
							<div class="text-muted-foreground flex gap-4 text-xs">
								<span>{g.memberCount} members</span>
								<span>Treasury: {formatValue(Number(g.treasuryBalance))}</span>
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
						}}>Previous</Button
					>
					<span class="flex items-center text-sm">{page} / {totalPages}</span>
					<Button
						variant="outline"
						size="sm"
						disabled={page >= totalPages}
						onclick={() => {
							page++;
							fetchGroups();
						}}>Next</Button
					>
				</div>
			{/if}
		{/if}
	</section>
</div>
