<script lang="ts">
	import { onMount, onDestroy, tick } from 'svelte';
	import { PUBLIC_WS_URL } from '$env/static/public';
	import { _ } from 'svelte-i18n';
	import { toast } from 'svelte-sonner';
	import * as Avatar from '$lib/components/ui/avatar';
	import { Button } from '$lib/components/ui/button';
	import { getPublicUrl } from '$lib/utils';
	import { goto } from '$app/navigation';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { ArrowLeft01Icon } from '@hugeicons/core-free-icons';

	let { data } = $props();

	type Message = {
		id: number;
		senderId: number;
		receiverId: number;
		content: string;
		isRead: boolean;
		createdAt: string;
		isMine: boolean;
	};

	let messages = $state<Message[]>(data.messages ?? []);
	let content = $state('');
	let sending = $state(false);
	let partnerTyping = $state(false);
	let isTyping = $state(false);
	let messagesEl = $state<HTMLElement | null>(null);

	const seenIds = new Set<number>((data.messages ?? []).map((m: Message) => m.id));

	let ws: WebSocket | null = null;
	let typingTimeout: ReturnType<typeof setTimeout> | null = null;
	let partnerTypingTimeout: ReturnType<typeof setTimeout> | null = null;

	const MAX_LENGTH = 1000;
	const TYPING_SEND_TIMEOUT_MS = 2500;
	const PARTNER_TYPING_CLEAR_MS = 4000;

	async function scrollToBottom() {
		await tick();
		if (messagesEl) messagesEl.scrollTop = messagesEl.scrollHeight;
	}

	function connect() {
		if (!PUBLIC_WS_URL) return;
		ws = new WebSocket(PUBLIC_WS_URL);

		ws.onopen = () => {
			ws!.send(
				JSON.stringify({
					type: 'set_user',
					userId: String(data.currentUser.id),
					username: data.currentUser.username,
					name: data.currentUser.name
				})
			);
		};

		ws.onmessage = (evt: MessageEvent) => {
			try {
				const msg = JSON.parse(evt.data as string) as {
					type: string;
					senderId?: string;
					message?: Message & { sender?: unknown };
				};

				if (msg.type === 'dm_new_message' && msg.message) {
					const m = msg.message;
					const isThisConversation =
						(m.senderId === data.partner.id && m.receiverId === data.currentUser.id) ||
						(m.senderId === data.currentUser.id && m.receiverId === data.partner.id);

					if (isThisConversation && !seenIds.has(m.id)) {
						seenIds.add(m.id);
						messages = [...messages, { ...m, isMine: m.senderId === data.currentUser.id }];
						scrollToBottom();
						if (m.senderId === data.partner.id) markAsRead();
					}
				} else if (
					msg.type === 'dm_typing' &&
					String(msg.senderId) === String(data.partner.id)
				) {
					partnerTyping = true;
					if (partnerTypingTimeout) clearTimeout(partnerTypingTimeout);
					partnerTypingTimeout = setTimeout(
						() => (partnerTyping = false),
						PARTNER_TYPING_CLEAR_MS
					);
					scrollToBottom();
				} else if (
					msg.type === 'dm_stop_typing' &&
					String(msg.senderId) === String(data.partner.id)
				) {
					partnerTyping = false;
					if (partnerTypingTimeout) clearTimeout(partnerTypingTimeout);
				}
			} catch {}
		};

		ws.onclose = () => setTimeout(connect, 5000);
		ws.onerror = () => ws?.close();
	}

	function sendTypingEvent() {
		if (!isTyping) {
			isTyping = true;
			ws?.send(JSON.stringify({ type: 'dm_typing', targetUserId: String(data.partner.id) }));
		}
		if (typingTimeout) clearTimeout(typingTimeout);
		typingTimeout = setTimeout(() => {
			isTyping = false;
			ws?.send(JSON.stringify({ type: 'dm_stop_typing', targetUserId: String(data.partner.id) }));
		}, TYPING_SEND_TIMEOUT_MS);
	}

	function sendStopTypingEvent() {
		if (isTyping) {
			isTyping = false;
			ws?.send(JSON.stringify({ type: 'dm_stop_typing', targetUserId: String(data.partner.id) }));
		}
		if (typingTimeout) clearTimeout(typingTimeout);
	}

	async function send() {
		const text = content.trim();
		if (!text || sending || text.length > MAX_LENGTH) return;

		sending = true;
		sendStopTypingEvent();

		try {
			const res = await fetch(`/api/messages/${data.partner.id}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ content: text })
			});

			const body = await res.json();

			if (!res.ok) {
				toast.error(body.message ?? $_('messages.error_sending'));
				return;
			}

			content = '';
			if (!seenIds.has(body.message.id)) {
				seenIds.add(body.message.id);
				messages = [...messages, { ...body.message, isMine: true }];
			}
			scrollToBottom();
		} catch {
			toast.error($_('messages.error_sending'));
		} finally {
			sending = false;
		}
	}

	async function markAsRead() {
		await fetch(`/api/messages/${data.partner.id}`, { method: 'PATCH' }).catch(() => {});
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			send();
		}
	}

	onMount(() => {
		connect();
		markAsRead();
		scrollToBottom();
	});

	onDestroy(() => {
		sendStopTypingEvent();
		ws?.close();
		if (partnerTypingTimeout) clearTimeout(partnerTypingTimeout);
	});
</script>

<div class="container mx-auto max-w-2xl">
	<div class="flex items-center gap-3 border-b px-4 py-3">
		<Button variant="ghost" size="icon" onclick={() => goto('/messages')}>
			<HugeiconsIcon icon={ArrowLeft01Icon} class="size-5" />
		</Button>
		<button onclick={() => goto(`/user/${data.partner.id}`)} class="flex items-center gap-3">
			<Avatar.Root class="size-9">
				<Avatar.Image src={getPublicUrl(data.partner.image)} alt={data.partner.name ?? ''} />
				<Avatar.Fallback>?</Avatar.Fallback>
			</Avatar.Root>
			<div class="text-left">
				<p
					class="font-medium"
					style={data.partner.nameColor ? `color: ${data.partner.nameColor}` : ''}
				>
					{data.partner.name}
				</p>
				<p class="text-muted-foreground text-xs">@{data.partner.username}</p>
			</div>
		</button>
	</div>

	<div bind:this={messagesEl} class="h-[65vh] overflow-y-auto space-y-3 p-4">
		{#if messages.length === 0 && !partnerTyping}
			<div class="py-16 text-center text-sm text-muted-foreground">
				{$_('messages.no_messages_yet', { values: { name: data.partner.name } })}
			</div>
		{/if}

		{#each messages as msg (msg.id)}
			<div class="flex {msg.isMine ? 'justify-end' : 'justify-start'}">
				<div
					class="max-w-[75%] rounded-2xl px-4 py-2 text-sm {msg.isMine
						? 'bg-primary text-primary-foreground rounded-br-sm'
						: 'bg-muted rounded-bl-sm'}"
				>
					<p class="break-words whitespace-pre-wrap">{msg.content}</p>
					<p class="mt-1 text-[10px] opacity-60 {msg.isMine ? 'text-right' : ''}">
						{new Date(msg.createdAt).toLocaleTimeString([], {
							hour: '2-digit',
							minute: '2-digit'
						})}
					</p>
				</div>
			</div>
		{/each}

		{#if partnerTyping}
			<div class="flex justify-start">
				<div
					class="bg-muted text-muted-foreground rounded-2xl rounded-bl-sm px-4 py-2 text-sm italic"
				>
					{$_('messages.is_typing', { values: { name: data.partner.name } })}
				</div>
			</div>
		{/if}
	</div>

	<div class="border-t p-4">
		<div class="flex items-end gap-2">
			<textarea
				bind:value={content}
				onkeydown={handleKeydown}
				oninput={sendTypingEvent}
				placeholder={$_('messages.type_message')}
				maxlength={MAX_LENGTH}
				rows={1}
				class="flex-1 resize-none rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
				style="min-height: 40px; max-height: 120px;"
			></textarea>
			<Button
				onclick={send}
				disabled={!content.trim() || sending || content.length > MAX_LENGTH}
				class="shrink-0"
			>
				{sending ? $_('messages.sending') : $_('messages.send')}
			</Button>
		</div>
		{#if content.length > MAX_LENGTH * 0.9}
			<p class="mt-1 text-right text-xs text-muted-foreground">
				{content.length}/{MAX_LENGTH}
			</p>
		{/if}
	</div>
</div>