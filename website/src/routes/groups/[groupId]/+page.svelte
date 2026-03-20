<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { Input } from '$lib/components/ui/input';
	import { Textarea } from '$lib/components/ui/textarea';
	import * as Avatar from '$lib/components/ui/avatar';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Switch } from '$lib/components/ui/switch';
	import { Label } from '$lib/components/ui/label';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import {
		UserGroupIcon,
		Locker01Icon,
		Globe02Icon,
		Delete01Icon,
		Settings01Icon,
		UserAdd01Icon,
		UserRemove01Icon,
		MoneyBag02Icon,
		Message01Icon,
		Loading03Icon,
		ArrowLeft01Icon
	} from '@hugeicons/core-free-icons';
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { goto } from '$app/navigation';
	import { USER_DATA } from '$lib/stores/user-data';
	import { formatValue, getPublicUrl, formatDate } from '$lib/utils';
	import { PORTFOLIO_SUMMARY, fetchPortfolioSummary } from '$lib/stores/portfolio-data';

	let { data } = $props();
	let group = $state(data.group);
	let activeTab = $state('wall');

	let members = $state<any[]>([]);
	let wallPosts = $state<any[]>([]);
	let treasury = $state<{ treasuryBalance: string; transactions: any[] } | null>(null);
	let requests = $state<any[]>([]);
	let membersLoaded = $state(false);
	let wallLoaded = $state(false);
	let treasuryLoaded = $state(false);
	let requestsLoaded = $state(false);

	let wallContent = $state('');
	let postingWall = $state(false);
	let depositAmount = $state('');
	let withdrawAmount = $state('');
	let depositNote = $state('');
	let withdrawNote = $state('');
	let treasuryLoading = $state(false);

	let settingsOpen = $state(false);
	let settingsDesc = $state(group.description || '');
	let settingsPublic = $state(group.isPublic);
	let savingSettings = $state(false);

	let deleteOpen = $state(false);
	let deleting = $state(false);

	const isOwner = $derived(group.memberRole === 'owner');
	const isAdmin = $derived(group.memberRole === 'admin' || group.memberRole === 'owner');
	const isMember = $derived(!!group.memberRole);

	onMount(() => {
		loadWall();
	});

	async function reload() {
		const r = await fetch(`/api/groups/${group.id}`);
		if (r.ok) group = await r.json();
	}

	async function loadMembers() {
		if (membersLoaded) return;
		const r = await fetch(`/api/groups/${group.id}/members`);
		if (r.ok) {
			const d = await r.json();
			members = d.members;
		}
		membersLoaded = true;
	}

	async function loadWall() {
		if (wallLoaded) return;
		const r = await fetch(`/api/groups/${group.id}/wall`);
		if (r.ok) {
			const d = await r.json();
			wallPosts = d.posts;
		}
		wallLoaded = true;
	}

	async function loadTreasury() {
		if (treasuryLoaded) return;
		const r = await fetch(`/api/groups/${group.id}/treasury`);
		if (r.ok) {
			treasury = await r.json();
		}
		treasuryLoaded = true;
	}

	async function loadRequests() {
		if (requestsLoaded) return;
		const r = await fetch(`/api/groups/${group.id}/requests`);
		if (r.ok) {
			const d = await r.json();
			requests = d.requests;
		}
		requestsLoaded = true;
	}

	function switchTab(tab: string) {
		activeTab = tab;
		if (tab === 'members') loadMembers();
		if (tab === 'treasury') loadTreasury();
		if (tab === 'requests' && isAdmin) loadRequests();
		if (tab === 'wall') loadWall();
	}

	async function joinOrRequest() {
		const r = await fetch(`/api/groups/${group.id}/members`, { method: 'POST' });
		const d = await r.json();
		if (!r.ok) {
			toast.error(d.message || 'Failed');
			return;
		}
		if (d.joined) {
			toast.success('Joined group!');
			await reload();
			membersLoaded = false;
			loadMembers();
		} else if (d.requested) {
			toast.success('Join request sent!');
		}
	}

	async function leaveGroup() {
		const r = await fetch(`/api/groups/${group.id}/members`, { method: 'DELETE' });
		const d = await r.json();
		if (!r.ok) {
			toast.error(d.message || 'Failed');
			return;
		}
		toast.success('Left group');
		goto('/groups');
	}

	async function postWall() {
		if (!wallContent.trim()) return;
		postingWall = true;
		try {
			const r = await fetch(`/api/groups/${group.id}/wall`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ content: wallContent })
			});
			const d = await r.json();
			if (!r.ok) {
				toast.error(d.message || 'Failed');
				return;
			}
			wallPosts = [d.post, ...wallPosts];
			wallContent = '';
		} finally {
			postingWall = false;
		}
	}

	async function deletePost(postId: number) {
		const r = await fetch(`/api/groups/${group.id}/wall?postId=${postId}`, { method: 'DELETE' });
		if (!r.ok) {
			toast.error('Failed to delete');
			return;
		}
		wallPosts = wallPosts.filter((p) => p.id !== postId);
	}

	async function kickMember(userId: number) {
		const r = await fetch(`/api/groups/${group.id}/members/${userId}`, { method: 'DELETE' });
		const d = await r.json();
		if (!r.ok) {
			toast.error(d.message || 'Failed');
			return;
		}
		members = members.filter((m) => m.userId !== userId);
		toast.success('Member kicked');
	}

	async function changeRole(userId: number, newRole: string) {
		const r = await fetch(`/api/groups/${group.id}/members/${userId}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ role: newRole })
		});
		const d = await r.json();
		if (!r.ok) {
			toast.error(d.message || 'Failed');
			return;
		}
		members = members.map((m) => (m.userId === userId ? { ...m, role: newRole } : m));
		toast.success('Role updated');
	}

	async function handleRequest(requestId: number, action: 'accept' | 'deny') {
		const r = await fetch(`/api/groups/${group.id}/requests`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ requestId, action })
		});
		const d = await r.json();
		if (!r.ok) {
			toast.error(d.message || 'Failed');
			return;
		}
		requests = requests.filter((req) => req.id !== requestId);
		if (action === 'accept') {
			toast.success('Request accepted');
			membersLoaded = false;
			loadMembers();
			await reload();
		} else toast.success('Request denied');
	}

	async function doDeposit() {
		const amount = Number(depositAmount);
		if (!amount || amount <= 0) {
			toast.error('Invalid amount');
			return;
		}
		treasuryLoading = true;
		try {
			const r = await fetch(`/api/groups/${group.id}/treasury`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ type: 'deposit', amount, note: depositNote || null })
			});
			const d = await r.json();
			if (!r.ok) {
				toast.error(d.message || 'Failed');
				return;
			}
			toast.success(`Deposited ${formatValue(amount)}`);
			depositAmount = '';
			depositNote = '';
			treasury = null;
			treasuryLoaded = false;
			loadTreasury();
			await reload();
			fetchPortfolioSummary();
		} finally {
			treasuryLoading = false;
		}
	}

	async function doWithdraw() {
		const amount = Number(withdrawAmount);
		if (!amount || amount <= 0) {
			toast.error('Invalid amount');
			return;
		}
		treasuryLoading = true;
		try {
			const r = await fetch(`/api/groups/${group.id}/treasury`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ type: 'withdraw', amount, note: withdrawNote || null })
			});
			const d = await r.json();
			if (!r.ok) {
				toast.error(d.message || 'Failed');
				return;
			}
			toast.success(`Withdrew ${formatValue(amount)}`);
			withdrawAmount = '';
			withdrawNote = '';
			treasury = null;
			treasuryLoaded = false;
			loadTreasury();
			await reload();
			fetchPortfolioSummary();
		} finally {
			treasuryLoading = false;
		}
	}

	async function saveSettings() {
		savingSettings = true;
		try {
			const r = await fetch(`/api/groups/${group.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ description: settingsDesc, isPublic: settingsPublic })
			});
			const d = await r.json();
			if (!r.ok) {
				toast.error(d.message || 'Failed');
				return;
			}
			toast.success('Settings saved');
			settingsOpen = false;
			await reload();
		} finally {
			savingSettings = false;
		}
	}

	async function deleteGroup() {
		deleting = true;
		try {
			const r = await fetch(`/api/groups/${group.id}`, { method: 'DELETE' });
			const d = await r.json();
			if (!r.ok) {
				toast.error(d.message || 'Failed');
				return;
			}
			toast.success('Group deleted');
			goto('/groups');
		} finally {
			deleting = false;
		}
	}

	const tabs = [
		{ id: 'wall', label: 'Wall' },
		{ id: 'members', label: 'Members' },
		{ id: 'treasury', label: 'Treasury' },
		...(isAdmin ? [{ id: 'requests', label: 'Requests' }] : [])
	];
</script>

<Dialog.Root bind:open={settingsOpen}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>Group Settings</Dialog.Title>
		</Dialog.Header>
		<div class="space-y-4">
			<div class="space-y-1">
				<Label>Description</Label>
				<Textarea bind:value={settingsDesc} maxlength={500} rows={3} />
			</div>
			<div class="flex items-center justify-between rounded-lg border p-3">
				<div>
					<p class="text-sm font-medium">Public Group</p>
					<p class="text-muted-foreground text-xs">Anyone can join without approval</p>
				</div>
				<Switch bind:checked={settingsPublic} />
			</div>
		</div>
		<Dialog.Footer>
			<Button variant="outline" onclick={() => (settingsOpen = false)}>Cancel</Button>
			<Button onclick={saveSettings} disabled={savingSettings}
				>{savingSettings ? 'Saving...' : 'Save'}</Button
			>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<Dialog.Root bind:open={deleteOpen}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title class="text-destructive">Delete Group</Dialog.Title>
			<Dialog.Description
				>This is permanent. Treasury funds will be refunded to you.</Dialog.Description
			>
		</Dialog.Header>
		<Dialog.Footer>
			<Button variant="outline" onclick={() => (deleteOpen = false)}>Cancel</Button>
			<Button variant="destructive" onclick={deleteGroup} disabled={deleting}>
				{deleting ? 'Deleting...' : 'Delete'}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<div class="container mx-auto max-w-5xl p-6">
	<Button variant="ghost" size="sm" onclick={() => goto('/groups')} class="mb-4">
		<HugeiconsIcon icon={ArrowLeft01Icon} class="h-4 w-4" />
		Back to Groups
	</Button>

	<Card.Root class="mb-6">
		<Card.Content class="p-6">
			<div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
				<div class="flex items-center gap-4">
					<div
						class="bg-primary/10 flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-3xl"
					>
						{group.name.charAt(0).toUpperCase()}
					</div>
					<div>
						<div class="flex flex-wrap items-center gap-2">
							<h1 class="text-2xl font-bold">{group.name}</h1>
							<Badge variant={group.isPublic ? 'outline' : 'secondary'} class="text-xs">
								<HugeiconsIcon
									icon={group.isPublic ? Globe02Icon : Locker01Icon}
									class="mr-1 h-3 w-3"
								/>
								{group.isPublic ? 'Public' : 'Private'}
							</Badge>
						</div>
						{#if group.description}<p class="text-muted-foreground mt-1">
								{group.description}
							</p>{/if}
						<div class="text-muted-foreground mt-2 flex flex-wrap gap-4 text-sm">
							<span>{group.memberCount} members</span>
							{#if isMember}<span>Treasury: {formatValue(Number(group.treasuryBalance))}</span>{/if}
							{#if group.ownerName}<span>Owner: {group.ownerName}</span>{/if}
						</div>
					</div>
				</div>

				<div class="flex flex-wrap gap-2">
					{#if $USER_DATA}
						{#if isMember}
							{#if isOwner}
								<Button
									variant="outline"
									size="sm"
									onclick={() => {
										settingsDesc = group.description || '';
										settingsPublic = group.isPublic;
										settingsOpen = true;
									}}
								>
									<HugeiconsIcon icon={Settings01Icon} class="h-4 w-4" />
									Settings
								</Button>
								<Button variant="destructive" size="sm" onclick={() => (deleteOpen = true)}>
									<HugeiconsIcon icon={Delete01Icon} class="h-4 w-4" />
									Delete
								</Button>
							{:else}
								<Button variant="outline" size="sm" onclick={leaveGroup}>
									<HugeiconsIcon icon={UserRemove01Icon} class="h-4 w-4" />
									Leave
								</Button>
							{/if}
							{#if group.memberRole}
								<Badge variant="secondary" class="capitalize">{group.memberRole}</Badge>
							{/if}
						{:else}
							<Button size="sm" onclick={joinOrRequest}>
								<HugeiconsIcon icon={UserAdd01Icon} class="h-4 w-4" />
								{group.isPublic ? 'Join' : 'Request to Join'}
							</Button>
						{/if}
					{/if}
				</div>
			</div>
		</Card.Content>
	</Card.Root>

	<div class="mb-4 flex gap-2 overflow-x-auto">
		{#each tabs as tab}
			<button
				onclick={() => switchTab(tab.id)}
				class="rounded-md px-4 py-2 text-sm font-medium transition-colors
					{activeTab === tab.id
					? 'bg-primary text-primary-foreground'
					: 'hover:bg-muted text-muted-foreground'}"
			>
				{tab.label}
			</button>
		{/each}
	</div>

	{#if activeTab === 'wall'}
		<div class="space-y-4">
			{#if isMember}
				<Card.Root>
					<Card.Content class="p-4">
						<Textarea
							bind:value={wallContent}
							placeholder="Post something on the wall..."
							maxlength={500}
							rows={2}
						/>
						<div class="mt-2 flex justify-between">
							<span class="text-muted-foreground text-xs">{wallContent.length}/500</span>
							<Button size="sm" onclick={postWall} disabled={postingWall || !wallContent.trim()}>
								{postingWall ? 'Posting...' : 'Post'}
							</Button>
						</div>
					</Card.Content>
				</Card.Root>
			{/if}
			{#if !wallLoaded}
				{#each Array(3) as _}<Skeleton class="h-20 rounded-xl" />{/each}
			{:else if wallPosts.length === 0}
				<div class="flex h-40 flex-col items-center justify-center gap-2 text-center">
					<HugeiconsIcon icon={Message01Icon} class="text-muted-foreground/40 h-10 w-10" />
					<p class="text-muted-foreground">No posts yet</p>
				</div>
			{:else}
				{#each wallPosts as post}
					<Card.Root>
						<Card.Content class="p-4">
							<div class="flex items-start justify-between gap-3">
								<div class="flex items-start gap-3">
									<Avatar.Root class="h-8 w-8 shrink-0">
										<Avatar.Image src={getPublicUrl(post.userImage)} alt={post.userName} />
										<Avatar.Fallback class="text-xs"
											>{(post.userName || '?').charAt(0)}</Avatar.Fallback
										>
									</Avatar.Root>
									<div>
										<button
											class="text-sm font-medium hover:underline"
											onclick={() => goto(`/user/${post.username}`)}
										>
											{post.userName || 'Deleted User'}
										</button>
										<p class="mt-1 text-sm">{post.content}</p>
										<p class="text-muted-foreground mt-1 text-xs">{formatDate(post.createdAt)}</p>
									</div>
								</div>
								{#if $USER_DATA && (post.userId === Number($USER_DATA.id) || isAdmin)}
									<Button
										variant="ghost"
										size="sm"
										class="h-7 w-7 p-0 text-red-500"
										onclick={() => deletePost(post.id)}
									>
										<HugeiconsIcon icon={Delete01Icon} class="h-3 w-3" />
									</Button>
								{/if}
							</div>
						</Card.Content>
					</Card.Root>
				{/each}
			{/if}
		</div>
	{/if}

	{#if activeTab === 'members'}
		<div class="space-y-2">
			{#if !membersLoaded}
				{#each Array(5) as _}<Skeleton class="h-14 rounded-xl" />{/each}
			{:else}
				{#each members as member}
					<Card.Root>
						<Card.Content class="flex items-center justify-between p-3">
							<button
								class="flex items-center gap-3"
								onclick={() => goto(`/user/${member.username}`)}
							>
								<Avatar.Root class="h-8 w-8">
									<Avatar.Image src={getPublicUrl(member.image)} alt={member.name} />
									<Avatar.Fallback class="text-xs">{member.name.charAt(0)}</Avatar.Fallback>
								</Avatar.Root>
								<div class="text-left">
									<p class="text-sm font-medium hover:underline">{member.name}</p>
									<p class="text-muted-foreground text-xs">@{member.username}</p>
								</div>
							</button>
							<div class="flex items-center gap-2">
								<Badge
									variant={member.role === 'owner'
										? 'default'
										: member.role === 'admin'
											? 'secondary'
											: 'outline'}
									class="text-xs capitalize"
								>
									{member.role}
								</Badge>
								{#if isAdmin && member.userId !== Number($USER_DATA?.id) && member.role !== 'owner'}
									{#if isOwner}
										{#if member.role === 'member'}
											<Button
												variant="ghost"
												size="sm"
												class="h-7 text-xs"
												onclick={() => changeRole(member.userId, 'admin')}>Promote</Button
											>
										{:else if member.role === 'admin'}
											<Button
												variant="ghost"
												size="sm"
												class="h-7 text-xs"
												onclick={() => changeRole(member.userId, 'member')}>Demote</Button
											>
										{/if}
									{/if}
									{#if member.role === 'member' || (isOwner && member.role === 'admin')}
										<Button
											variant="ghost"
											size="sm"
											class="h-7 w-7 p-0 text-red-500"
											onclick={() => kickMember(member.userId)}
										>
											<HugeiconsIcon icon={UserRemove01Icon} class="h-3 w-3" />
										</Button>
									{/if}
								{/if}
							</div>
						</Card.Content>
					</Card.Root>
				{/each}
			{/if}
		</div>
	{/if}

	{#if activeTab === 'treasury' && isMember}
		<div class="grid gap-4 lg:grid-cols-2">
			<Card.Root>
				<Card.Header>
					<Card.Title class="flex items-center gap-2">
						<HugeiconsIcon icon={MoneyBag02Icon} class="h-5 w-5" />
						Treasury
					</Card.Title>
				</Card.Header>
				<Card.Content class="space-y-4">
					<div class="rounded-lg border p-4 text-center">
						<p class="text-muted-foreground text-sm">Balance</p>
						<p class="text-3xl font-bold">{formatValue(Number(group.treasuryBalance))}</p>
					</div>
					<div class="space-y-2">
						<Label>Deposit</Label>
						<div class="flex gap-2">
							<Input
								type="number"
								bind:value={depositAmount}
								placeholder="Amount"
								min="0.01"
								step="0.01"
							/>
							<Input bind:value={depositNote} placeholder="Note (optional)" maxlength={200} />
						</div>
						<Button class="w-full" onclick={doDeposit} disabled={treasuryLoading || !depositAmount}>
							{treasuryLoading ? 'Processing...' : 'Deposit'}
						</Button>
					</div>
					{#if isAdmin}
						<div class="space-y-2">
							<Label>Withdraw</Label>
							<div class="flex gap-2">
								<Input
									type="number"
									bind:value={withdrawAmount}
									placeholder="Amount"
									min="0.01"
									step="0.01"
								/>
								<Input bind:value={withdrawNote} placeholder="Note (optional)" maxlength={200} />
							</div>
							<Button
								variant="outline"
								class="w-full"
								onclick={doWithdraw}
								disabled={treasuryLoading || !withdrawAmount}
							>
								{treasuryLoading ? 'Processing...' : 'Withdraw'}
							</Button>
						</div>
					{/if}
				</Card.Content>
			</Card.Root>

			<Card.Root>
				<Card.Header>
					<Card.Title>Recent Transactions</Card.Title>
				</Card.Header>
				<Card.Content>
					{#if !treasuryLoaded}
						{#each Array(4) as _}<Skeleton class="mb-2 h-10 rounded" />{/each}
					{:else if !treasury || treasury.transactions.length === 0}
						<p class="text-muted-foreground text-sm">No transactions yet</p>
					{:else}
						<div class="space-y-2">
							{#each treasury.transactions as tx}
								<div class="flex items-center justify-between text-sm">
									<div>
										<span class={tx.type === 'deposit' ? 'text-green-600' : 'text-red-600'}>
											{tx.type === 'deposit' ? '+' : '-'}{formatValue(Number(tx.amount))}
										</span>
										{#if tx.username}<span class="text-muted-foreground ml-1">by {tx.username}</span
											>{/if}
										{#if tx.note}<p class="text-muted-foreground text-xs italic">{tx.note}</p>{/if}
									</div>
									<span class="text-muted-foreground text-xs">{formatDate(tx.createdAt)}</span>
								</div>
							{/each}
						</div>
					{/if}
				</Card.Content>
			</Card.Root>
		</div>
	{/if}

	{#if activeTab === 'requests' && isAdmin}
		<div class="space-y-2">
			{#if !requestsLoaded}
				{#each Array(3) as _}<Skeleton class="h-14 rounded-xl" />{/each}
			{:else if requests.length === 0}
				<div class="flex h-40 flex-col items-center justify-center gap-2 text-center">
					<p class="text-muted-foreground">No pending join requests</p>
				</div>
			{:else}
				{#each requests as req}
					<Card.Root>
						<Card.Content class="flex items-center justify-between p-3">
							<button class="flex items-center gap-3" onclick={() => goto(`/user/${req.username}`)}>
								<Avatar.Root class="h-8 w-8">
									<Avatar.Image src={getPublicUrl(req.image)} alt={req.name} />
									<Avatar.Fallback class="text-xs">{req.name.charAt(0)}</Avatar.Fallback>
								</Avatar.Root>
								<div class="text-left">
									<p class="text-sm font-medium hover:underline">{req.name}</p>
									<p class="text-muted-foreground text-xs">
										@{req.username} · {formatDate(req.createdAt)}
									</p>
								</div>
							</button>
							<div class="flex gap-2">
								<Button size="sm" onclick={() => handleRequest(req.id, 'accept')}>Accept</Button>
								<Button variant="outline" size="sm" onclick={() => handleRequest(req.id, 'deny')}
									>Deny</Button
								>
							</div>
						</Card.Content>
					</Card.Root>
				{/each}
			{/if}
		</div>
	{/if}
</div>
