<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import * as Avatar from '$lib/components/ui/avatar';
	import { toast } from 'svelte-sonner';
	import { USER_DATA } from '$lib/stores/user-data';
	import { CHAT_MESSAGES, setChatMessages } from '$lib/stores/chat';
	import { getPublicUrl, formatDate } from '$lib/utils';
	import SEO from '$lib/components/self/SEO.svelte';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { Message01Icon, ArrowLeft01Icon } from '@hugeicons/core-free-icons';

	let channels = $state<any[]>([]);
	let friends = $state<any[]>([]);
	let loadingChannels = $state(true);
	let loadingFriends = $state(true);
	let activeChannelId = $state<number | null>(null);
	let messageInput = $state('');
	let sending = $state(false);

	let currentTab = $state<'chats' | 'friends'>('chats');

	let activeChannel = $derived(channels.find(c => c.id === activeChannelId));
	let messages = $derived($CHAT_MESSAGES[activeChannelId as number] || []);

	let scrollViewport: HTMLElement;

	onMount(async () => {
		if (!$USER_DATA) {
			goto('/');
			return;
		}

		await Promise.all([fetchChannels(), fetchFriends()]);

		const channelQuery = $page.url.searchParams.get('channel');
		if (channelQuery) {
			const id = parseInt(channelQuery);
			if (channels.some(c => c.id === id)) {
				selectChannel(id);
			}
		} else if (channels.length > 0) {
			selectChannel(channels[0].id);
		}
	});

	$effect(() => {
		if (messages.length > 0 && scrollViewport) {
			setTimeout(() => {
				scrollViewport.scrollTo({ top: scrollViewport.scrollHeight, behavior: 'smooth' });
			}, 100);
		}
	});

	async function fetchChannels() {
		try {
			const res = await fetch('/api/chat/channels');
			if (res.ok) {
				const d = await res.json();
				channels = d.channels || [];
			}
		} catch (e) {
			toast.error('Failed to load channels');
		} finally {
			loadingChannels = false;
		}
	}

	async function fetchFriends() {
		try {
			const res = await fetch('/api/friends');
			if (res.ok) {
				const d = await res.json();
				friends = d.friends || [];
			}
		} catch (e) {
			toast.error('Failed to load friends');
		} finally {
			loadingFriends = false;
		}
	}

	async function selectChannel(id: number) {
		currentTab = 'chats';
		activeChannelId = id;
		const url = new URL(window.location.href);
		url.searchParams.set('channel', id.toString());
		window.history.replaceState({}, '', url);

		try {
			const res = await fetch(`/api/chat/${id}/messages`);
			if (res.ok) {
				const d = await res.json();
				setChatMessages(id, d.messages || []);
			}
		} catch (e) {
			toast.error('Failed to load messages');
		}
	}

	async function startChatWithFriend(friendId: number) {
		try {
			const res = await fetch('/api/chat/channels', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ targetUserId: friendId })
			});
			if (res.ok) {
				const d = await res.json();
				if (!channels.find(c => c.id === d.channel.id)) {
					await fetchChannels();
				}
				selectChannel(d.channel.id);
			} else {
				const d = await res.json();
				toast.error(d.message || 'Failed to start chat');
			}
		} catch {
			toast.error('Network error');
		}
	}

	async function sendMessage() {
		if (!activeChannelId || !messageInput.trim() || sending) return;

		const content = messageInput.trim();
		messageInput = '';
		sending = true;

		try {
			const res = await fetch(`/api/chat/${activeChannelId}/messages`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ content })
			});
			if (!res.ok) {
				const d = await res.json();
				toast.error(d.message || 'Failed to send message');
				messageInput = content;
			}
		} catch {
			toast.error('Network error');
			messageInput = content;
		} finally {
			sending = false;
		}
	}

	function goBackToList() {
		activeChannelId = null;
	}
</script>

<SEO title="Chat - XprismPlay" description="Chat with your friends and fellow traders on XprismPlay." />

<div class="container mx-auto max-w-6xl p-6 h-[calc(100vh-80px)] flex flex-col">
	<div class="mb-4">
		<h1 class="text-3xl font-bold">Messages</h1>
	</div>

	<div class="flex flex-1 gap-4 min-h-0">
		<!-- Sidebar -->
		<Card.Root class="flex flex-col overflow-hidden {activeChannelId ? 'hidden md:flex md:w-1/3' : 'w-full md:w-1/3'} py-0">
			<div class="flex gap-4 border-b px-4 pt-4">
				<button
					class="pb-3 text-sm font-medium border-b-2 transition-colors {currentTab === 'chats' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}"
					onclick={() => currentTab = 'chats'}
				>
					Chats
				</button>
				<button
					class="pb-3 text-sm font-medium border-b-2 transition-colors {currentTab === 'friends' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}"
					onclick={() => currentTab = 'friends'}
				>
					Friends
				</button>
			</div>
			<div class="flex-1 overflow-y-auto">
				{#if currentTab === 'chats'}
					{#if loadingChannels}
						<div class="p-4 space-y-3">
							{#each Array(5) as _}
								<div class="flex items-center gap-3">
									<div class="w-10 h-10 rounded-full bg-muted animate-pulse"></div>
									<div class="flex-1 space-y-1">
										<div class="h-4 bg-muted animate-pulse rounded w-2/3"></div>
										<div class="h-3 bg-muted animate-pulse rounded w-1/3"></div>
									</div>
								</div>
							{/each}
						</div>
					{:else if channels.length === 0}
						<div class="p-6 text-center text-muted-foreground text-sm">
							No conversations yet. Add some friends to start chatting!
						</div>
					{:else}
						<div class="flex flex-col p-2 gap-0.5">
							{#each channels as channel}
								<button
									class="flex items-center gap-3 p-3 rounded-lg transition-colors hover:bg-muted text-left {activeChannelId === channel.id ? 'bg-muted' : ''}"
									onclick={() => selectChannel(channel.id)}
								>
									<Avatar.Root class="w-10 h-10 border shrink-0">
										{#if channel.image}
											<Avatar.Image src={getPublicUrl(channel.image)} />
										{/if}
										<Avatar.Fallback class="text-sm">{channel.name?.charAt(channel.name?.startsWith('@') ? 1 : 0)?.toUpperCase() || '?'}</Avatar.Fallback>
									</Avatar.Root>
									<div class="flex-1 min-w-0">
										<div class="font-medium text-sm truncate">{channel.name}</div>
										<div class="text-xs text-muted-foreground truncate">
											{channel.user1Id === null && channel.user2Id === null ? 'Group Chat' : channel.type === 'DIRECT' ? 'Direct Message' : channel.type?.replace('_', ' ')}
										</div>
									</div>
								</button>
							{/each}
						</div>
					{/if}
				{:else if currentTab === 'friends'}
					{#if loadingFriends}
						<div class="p-4 space-y-3">
							{#each Array(5) as _}
								<div class="flex items-center gap-3">
									<div class="w-10 h-10 rounded-full bg-muted animate-pulse"></div>
									<div class="flex-1 space-y-1">
										<div class="h-4 bg-muted animate-pulse rounded w-2/3"></div>
										<div class="h-3 bg-muted animate-pulse rounded w-1/3"></div>
									</div>
								</div>
							{/each}
						</div>
					{:else if friends.length === 0}
						<div class="p-6 text-center text-muted-foreground text-sm">
							You don't have any friends yet. Add some from their profile!
						</div>
					{:else}
						<div class="flex flex-col p-2 gap-0.5">
							{#each friends as friend}
								<button
									class="flex items-center gap-3 p-3 rounded-lg transition-colors hover:bg-muted text-left"
									onclick={() => startChatWithFriend(friend.id)}
								>
									<Avatar.Root class="w-10 h-10 border shrink-0">
										{#if friend.image}
											<Avatar.Image src={getPublicUrl(friend.image)} />
										{/if}
										<Avatar.Fallback class="text-sm">{friend.username?.charAt(0)?.toUpperCase() || '?'}</Avatar.Fallback>
									</Avatar.Root>
									<div class="flex-1 min-w-0">
										<div class="font-medium text-sm truncate">@{friend.username}</div>
										<div class="text-xs text-muted-foreground truncate">Click to chat</div>
									</div>
								</button>
							{/each}
						</div>
					{/if}
				{/if}
			</div>
		</Card.Root>

		<!-- Main Chat Area -->
		<Card.Root class="flex-1 flex flex-col overflow-hidden py-0 {activeChannelId ? 'flex' : 'hidden md:flex'}">
			{#if activeChannel}
				<div class="flex items-center gap-3 p-4 border-b shrink-0">
					<button
						class="md:hidden p-1 -ml-1 rounded-full hover:bg-muted"
						onclick={goBackToList}
					>
						<HugeiconsIcon icon={ArrowLeft01Icon} class="w-5 h-5" />
					</button>
					<Avatar.Root class="w-10 h-10 border shrink-0">
						{#if activeChannel.image}
							<Avatar.Image src={getPublicUrl(activeChannel.image)} />
						{/if}
						<Avatar.Fallback class="text-sm">{activeChannel.name?.charAt(activeChannel.name?.startsWith('@') ? 1 : 0)?.toUpperCase() || '?'}</Avatar.Fallback>
					</Avatar.Root>
					<div class="min-w-0">
						<div class="font-semibold text-base truncate">{activeChannel.name}</div>
						<div class="text-xs text-muted-foreground">
							{activeChannel.user1Id === null && activeChannel.user2Id === null ? 'Group Chat' : activeChannel.type === 'DIRECT' ? 'Direct Message' : activeChannel.type?.replace('_', ' ')}
						</div>
					</div>
				</div>

				<div class="flex-1 overflow-y-auto p-4 flex flex-col gap-3" bind:this={scrollViewport}>
					{#if messages.length === 0}
						<div class="m-auto text-muted-foreground text-sm flex flex-col items-center gap-2">
							<span class="text-4xl">👋</span>
							<p>No messages yet. Say hi!</p>
						</div>
					{:else}
						{#each messages as msg (msg.id)}
							{@const isMe = msg.senderId === Number($USER_DATA?.id)}
							<div class="flex gap-2.5 max-w-[80%] {isMe ? 'self-end flex-row-reverse' : 'self-start'}">
								<Avatar.Root class="w-7 h-7 shrink-0 mt-1">
									{#if msg.senderImage}
										<Avatar.Image src={getPublicUrl(msg.senderImage)} />
									{/if}
									<Avatar.Fallback class="text-xs">{msg.senderUsername?.charAt(0)?.toUpperCase() || '?'}</Avatar.Fallback>
								</Avatar.Root>
								<div class="flex flex-col gap-0.5 {isMe ? 'items-end' : 'items-start'}">
									<div class="text-[11px] text-muted-foreground px-1">
										{msg.senderUsername} · {formatDate(msg.createdAt)}
									</div>
									<div class="rounded-2xl px-3.5 py-2 text-sm leading-relaxed {isMe ? 'bg-primary text-primary-foreground rounded-tr-sm' : 'bg-muted rounded-tl-sm'}">
										{msg.content}
									</div>
								</div>
							</div>
						{/each}
					{/if}
				</div>

				<div class="p-3 border-t shrink-0">
					<form class="flex gap-2" onsubmit={(e) => { e.preventDefault(); sendMessage(); }}>
						<Input
							placeholder="Type a message..."
							bind:value={messageInput}
							disabled={sending}
							autocomplete="off"
							class="flex-1 rounded-full"
						/>
						<Button type="submit" disabled={!messageInput.trim() || sending} class="rounded-full px-6">
							Send
						</Button>
					</form>
				</div>
			{:else}
				<div class="m-auto flex flex-col items-center text-muted-foreground gap-3">
					<HugeiconsIcon icon={Message01Icon} class="w-12 h-12 opacity-20" />
					<p class="text-sm">Select a conversation to start chatting</p>
				</div>
			{/if}
		</Card.Root>
	</div>
</div>
