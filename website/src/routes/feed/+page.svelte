<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { PUBLIC_WEBSOCKET_URL } from '$env/static/public';
	import { USER_DATA } from '$lib/stores/user-data';
	import { _ } from 'svelte-i18n';
	import { toast } from 'svelte-sonner';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import * as Avatar from '$lib/components/ui/avatar';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { TradeUpIcon, TradeDownIcon, Coins02Icon } from '@hugeicons/core-free-icons';
	import { getPublicUrl, formatValue } from '$lib/utils';
	import { goto } from '$app/navigation';

	let { data } = $props();

	type FeedItem = {
		id: string;
		type: string;
		content: string | null;
		metadata: Record<string, unknown> | null;
		createdAt: string;
		user: {
			id: number | null;
			name: string | null;
			username: string | null;
			image: string | null;
			nameColor: string | null;
			prestigeLevel: number | null;
		} | null;
	};

	let events = $state<FeedItem[]>(data.events ?? []);
	let content = $state('');
	let posting = $state(false);
	let feedIsTyping = $state(false);
	let typingUsersRecord = $state<Record<string, { username: string; name: string }>>({});

	const feedTypingTimeouts = new Map<string, ReturnType<typeof setTimeout>>();
	let feedTypingTimeout: ReturnType<typeof setTimeout> | null = null;

	const typingList = $derived(Object.values(typingUsersRecord));

	let ws: WebSocket | null = null;

	const MAX_LENGTH = 280;

	function addTypingUser(userId: string, username: string, name: string) {
		if ($USER_DATA && userId === String($USER_DATA.id)) return;
		typingUsersRecord = { ...typingUsersRecord, [userId]: { username, name } };
		if (feedTypingTimeouts.has(userId)) clearTimeout(feedTypingTimeouts.get(userId)!);
		feedTypingTimeouts.set(
			userId,
			setTimeout(() => removeTypingUser(userId), 4000)
		);
	}

	function removeTypingUser(userId: string) {
		const { [userId]: _, ...rest } = typingUsersRecord;
		typingUsersRecord = rest;
		feedTypingTimeouts.delete(userId);
	}

	function connect() {
		if (!PUBLIC_WEBSOCKET_URL) return;
		ws = new WebSocket(PUBLIC_WEBSOCKET_URL);

		ws.onopen = () => {
			ws!.send(JSON.stringify({ type: 'subscribe_feed' }));
			if ($USER_DATA) {
				ws!.send(
					JSON.stringify({
						type: 'set_user',
						userId: String($USER_DATA.id),
						username: $USER_DATA.username,
						name: $USER_DATA.name
					})
				);
			}
		};

		ws.onmessage = (evt: MessageEvent) => {
			try {
				const msg = JSON.parse(evt.data as string) as {
					type: string;
					event?: FeedItem;
					userId?: string;
					username?: string;
					name?: string;
				};

				if (msg.type === 'feed_update' && msg.event) {
					events = [msg.event, ...events].slice(0, 200);
				} else if (msg.type === 'feed_typing' && msg.userId) {
					addTypingUser(msg.userId, msg.username ?? '', msg.name ?? '');
				} else if (msg.type === 'feed_stop_typing' && msg.userId) {
					removeTypingUser(msg.userId);
				}
			} catch {}
		};

		ws.onclose = () => setTimeout(connect, 5000);
		ws.onerror = () => ws?.close();
	}

	function handleContentInput() {
		if (!$USER_DATA) return;
		if (!feedIsTyping) {
			feedIsTyping = true;
			ws?.send(JSON.stringify({ type: 'feed_typing' }));
		}
		if (feedTypingTimeout) clearTimeout(feedTypingTimeout);
		feedTypingTimeout = setTimeout(() => {
			feedIsTyping = false;
			ws?.send(JSON.stringify({ type: 'feed_stop_typing' }));
		}, 2000);
	}

	function stopFeedTyping() {
		if (feedIsTyping) {
			feedIsTyping = false;
			ws?.send(JSON.stringify({ type: 'feed_stop_typing' }));
		}
		if (feedTypingTimeout) clearTimeout(feedTypingTimeout);
	}

	async function post() {
		if (!$USER_DATA || !content.trim() || posting) return;

		posting = true;
		stopFeedTyping();

		try {
			const res = await fetch('/api/feed', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ content: content.trim() })
			});

			const body = await res.json();

			if (!res.ok) {
				toast.error(body.message ?? $_('feed.error_posting'));
				return;
			}

			content = '';
			toast.success($_('feed.posted'));
		} catch {
			toast.error($_('feed.error_posting'));
		} finally {
			posting = false;
		}
	}

	function timeAgo(iso: string): string {
		const diff = Date.now() - new Date(iso).getTime();
		const m = Math.floor(diff / 60_000);
		if (m < 1) return $_('feed.just_now');
		if (m < 60) return `${m}m`;
		const h = Math.floor(m / 60);
		if (h < 24) return `${h}h`;
		return `${Math.floor(h / 24)}d`;
	}

	onMount(connect);

	onDestroy(() => {
		stopFeedTyping();
		ws?.close();
		for (const t of feedTypingTimeouts.values()) clearTimeout(t);
	});
</script>

<div class="container mx-auto max-w-2xl space-y-4 p-4 md:p-8">
	<div>
		<h1 class="text-2xl font-bold">{$_('page_names.feed')}</h1>
		<p class="text-muted-foreground text-sm">{$_('feed.description')}</p>
	</div>

	{#if $USER_DATA}
		<div class="rounded-lg border p-4 space-y-3">
			<textarea
				bind:value={content}
				oninput={handleContentInput}
				placeholder={$_('feed.post_placeholder')}
				maxlength={MAX_LENGTH}
				rows={3}
				class="w-full resize-none rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
			></textarea>
			<div class="flex items-center justify-between">
				<div class="text-xs text-muted-foreground min-h-[1rem]">
					{#if typingList.length === 1}
						<span class="italic"
							>{$_('feed.is_typing', { values: { name: typingList[0].name } })}</span
						>
					{:else if typingList.length > 1}
						<span class="italic">{$_('feed.several_typing')}</span>
					{/if}
				</div>
				<div class="flex items-center gap-2">
					<span
						class="text-xs {content.length > MAX_LENGTH
							? 'text-destructive'
							: 'text-muted-foreground'}"
					>
						{content.length}/{MAX_LENGTH}
					</span>
					<Button
						onclick={post}
						disabled={!content.trim() || posting || content.length > MAX_LENGTH}
						size="sm"
					>
						{posting ? $_('feed.posting') : $_('feed.post_button')}
					</Button>
				</div>
			</div>
		</div>
	{:else}
		<div class="rounded-lg border p-4 text-center text-sm text-muted-foreground">
			{$_('feed.sign_in_to_post')}
		</div>
	{/if}

	{#if typingList.length > 0 && !$USER_DATA}
		<p class="text-xs text-muted-foreground italic px-1">
			{#if typingList.length === 1}
				{$_('feed.is_typing', { values: { name: typingList[0].name } })}
			{:else}
				{$_('feed.several_typing')}
			{/if}
		</p>
	{/if}

	<div class="space-y-3">
		{#if events.length === 0}
			<div class="py-12 text-center text-muted-foreground">{$_('feed.empty')}</div>
		{/if}

		{#each events as event (event.id)}
			<div class="rounded-lg border p-4">
				{#if event.type === 'USER_MESSAGE'}
					<div class="flex gap-3">
						<button onclick={() => goto(`/user/${event.user?.username}`)}>
							<Avatar.Root class="size-9 shrink-0">
								<Avatar.Image
									src={getPublicUrl(event.user?.image ?? null)}
									alt={event.user?.name ?? ''}
								/>
								<Avatar.Fallback>?</Avatar.Fallback>
							</Avatar.Root>
						</button>
						<div class="min-w-0 flex-1">
							<div class="flex items-baseline gap-2">
								<button
									onclick={() => goto(`/user/${event.user?.username}`)}
									class="truncate font-medium text-sm hover:underline"
									style={event.user?.nameColor ? `color: ${event.user.nameColor}` : ''}
								>
									{event.user?.name}
								</button>
								<span class="shrink-0 text-xs text-muted-foreground">
									@{event.user?.username}
								</span>
								<span class="ml-auto shrink-0 text-xs text-muted-foreground">
									{timeAgo(event.createdAt)}
								</span>
							</div>
							<p class="mt-1 break-words text-sm">{event.content}</p>
						</div>
					</div>
				{:else if event.type === 'COIN_CREATED'}
					<div class="flex items-center gap-3">
						{#if event.metadata?.coinIcon}
							<img
								src={getPublicUrl(event.metadata.coinIcon as string)}
								alt={event.metadata?.coinName as string}
								class="size-9 shrink-0 rounded-full object-cover"
							/>
						{:else}
							<div
								class="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted"
							>
								<HugeiconsIcon icon={Coins02Icon} class="size-4" />
							</div>
						{/if}
						<div class="min-w-0 flex-1">
							<div class="flex flex-wrap items-center gap-x-2 gap-y-1">
								{#if event.user}
									<button
										onclick={() => goto(`/user/${event.user?.username}`)}
										class="font-medium text-sm hover:underline"
										style={event.user?.nameColor ? `color: ${event.user.nameColor}` : ''}
									>
										{event.user.name}
									</button>
								{/if}
								<span class="text-muted-foreground text-sm">
									{$_('feed.events.created_coin')}
								</span>
								<button
									onclick={() =>
										goto(`/coin/${(event.metadata?.coinSymbol as string)?.toLowerCase()}`)}
									class="font-bold text-sm hover:underline"
								>
									*{event.metadata?.coinSymbol}
								</button>
								<span class="ml-auto shrink-0 text-xs text-muted-foreground">
									{timeAgo(event.createdAt)}
								</span>
							</div>
							<p class="text-xs text-muted-foreground">{event.metadata?.coinName}</p>
						</div>
					</div>
				{:else if event.type === 'LARGE_TRADE'}
					<div class="flex items-center gap-3">
						<div
							class="flex size-9 shrink-0 items-center justify-center rounded-full {event.metadata
								?.tradeType === 'BUY'
								? 'bg-green-500/10'
								: 'bg-red-500/10'}"
						>
							<HugeiconsIcon
								icon={event.metadata?.tradeType === 'BUY' ? TradeUpIcon : TradeDownIcon}
								class="size-5 {event.metadata?.tradeType === 'BUY'
									? 'text-green-500'
									: 'text-red-500'}"
							/>
						</div>
						<div class="min-w-0 flex-1">
							<div class="flex flex-wrap items-center gap-x-2 gap-y-1">
								<button
									onclick={() => goto(`/user/${event.user?.username}`)}
									class="font-medium text-sm hover:underline"
									style={event.user?.nameColor ? `color: ${event.user.nameColor}` : ''}
								>
									{event.user?.name}
								</button>
								<span class="text-muted-foreground text-sm">
									{event.metadata?.tradeType === 'BUY'
										? $_('feed.events.bought')
										: $_('feed.events.sold')}
								</span>
								<button
									onclick={() =>
										goto(`/coin/${(event.metadata?.coinSymbol as string)?.toLowerCase()}`)}
									class="font-bold text-sm hover:underline"
								>
									*{event.metadata?.coinSymbol}
								</button>
								<Badge
									variant="outline"
									class="text-xs {event.metadata?.tradeType === 'BUY'
										? 'border-green-500 text-green-500'
										: 'border-red-500 text-red-500'}"
								>
									{formatValue(event.metadata?.totalValue as number)}
								</Badge>
								<span class="ml-auto shrink-0 text-xs text-muted-foreground">
									{timeAgo(event.createdAt)}
								</span>
							</div>
							<p class="text-xs text-muted-foreground">{event.metadata?.coinName}</p>
						</div>
					</div>
				{/if}
			</div>
		{/each}
	</div>
</div>