<script lang="ts">
	import { goto } from '$app/navigation';
	import { _ } from 'svelte-i18n';
	import * as Avatar from '$lib/components/ui/avatar';
	import { Badge } from '$lib/components/ui/badge';
	import { getPublicUrl } from '$lib/utils';

	let { data } = $props();

	function timeAgo(iso: string): string {
		const diff = Date.now() - new Date(iso).getTime();
		const m = Math.floor(diff / 60_000);
		if (m < 1) return $_('feed.just_now');
		if (m < 60) return `${m}m`;
		const h = Math.floor(m / 60);
		if (h < 24) return `${h}h`;
		return `${Math.floor(h / 24)}d`;
	}
</script>

<div class="container mx-auto max-w-2xl p-4 md:p-8">
	<div class="mb-6">
		<h1 class="text-2xl font-bold">{$_('messages.title')}</h1>
		<p class="text-muted-foreground text-sm">{$_('messages.description')}</p>
	</div>

	{#if data.conversations.length === 0}
		<div class="py-16 text-center text-muted-foreground">
			{$_('messages.no_conversations')}
		</div>
	{:else}
		<div class="space-y-2">
			{#each data.conversations as conv (conv.partner.id)}
				<button
					onclick={() => goto(`/messages/${conv.partner.id}`)}
					class="hover:bg-muted/50 flex w-full items-center gap-3 rounded-lg border p-4 text-left transition-colors"
				>
					<Avatar.Root class="size-12 shrink-0">
						<Avatar.Image src={getPublicUrl(conv.partner.image)} alt={conv.partner.name ?? ''} />
						<Avatar.Fallback>?</Avatar.Fallback>
					</Avatar.Root>
					<div class="min-w-0 flex-1">
						<div class="flex items-baseline justify-between gap-2">
							<span
								class="truncate font-medium"
								style={conv.partner.nameColor ? `color: ${conv.partner.nameColor}` : ''}
							>
								{conv.partner.name}
							</span>
							<span class="shrink-0 text-xs text-muted-foreground">
								{timeAgo(conv.lastMessage.createdAt)}
							</span>
						</div>
						<div class="flex items-center justify-between gap-2">
							<p
								class="truncate text-sm {conv.unreadCount > 0 && !conv.lastMessage.isMine
									? 'text-foreground font-medium'
									: 'text-muted-foreground'}"
							>
								{#if conv.lastMessage.isMine}
									<span class="text-muted-foreground">{$_('messages.you')}: </span>
								{/if}
								{conv.lastMessage.content}
							</p>
							{#if conv.unreadCount > 0}
								<Badge class="bg-primary text-primary-foreground shrink-0 text-xs">
									{conv.unreadCount > 99 ? '99+' : conv.unreadCount}
								</Badge>
							{/if}
						</div>
					</div>
				</button>
			{/each}
		</div>
	{/if}
</div>