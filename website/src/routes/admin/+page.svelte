<script lang="ts">
	import { USER_DATA } from '$lib/stores/user-data';
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { 
		Shield01Icon, 
		LegalHammerIcon, 
		Ticket01Icon, 
		ArrowRight01Icon,
		UserGroupIcon,
		Analytics01Icon
	} from '@hugeicons/core-free-icons';
	import { goto } from '$app/navigation';

	// Define the admin sections for the dashboard
	const adminSections = [
		{
			title: 'User Management',
			description: 'Manage Users.',
			icon: LegalHammerIcon,
			url: '/admin/users',
			color: 'text-blue-500'
		},
		{
			title: 'Promo Codes',
			description: 'Manage Promo Codes.',
			icon: Ticket01Icon,
			url: '/admin/promo',
			color: 'text-green-500'
		}
	];
</script>

<svelte:head>
	<title>Admin Panel of Rugplay</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

{#if !$USER_DATA || !$USER_DATA.isAdmin}
	<div class="flex h-[80vh] items-center justify-center">
		<div class="text-center">
			<h1 class="text-2xl font-bold">Access Denied</h1>
			<p class="text-muted-foreground">You don't have permission to access this page. If you are set as an admin, I have no idea why you are here.</p>
		</div>
	</div>
{:else}
	<div class="container mx-auto space-y-6 p-6">
		<div class="flex items-center gap-3">
			<div class="bg-primary/10 rounded-lg p-2">
				<HugeiconsIcon icon={Shield01Icon} class="text-primary h-6 w-6" />
			</div>
			<div>
				<h1 class="text-3xl font-bold tracking-tight">Admin Panel</h1>
				<p class="text-muted-foreground text-sm">It has links to the other admin stuff, and not much more!.</p>
			</div>
		</div>

		<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
			{#each adminSections as section}
				<Card.Root class="hover:border-primary/50 transition-colors">
					<Card.Header>
						<div class="flex items-center justify-between">
							<div class={`bg-muted rounded-md p-2 ${section.color}`}>
								<HugeiconsIcon icon={section.icon} class="h-5 w-5" />
							</div>
						</div>
						<Card.Title class="mt-4">{section.title}</Card.Title>
						<Card.Description>{section.description}</Card.Description>
					</Card.Header>
					<Card.Content>
						<Button 
							variant="outline" 
							class="w-full justify-between" 
							onclick={() => goto(section.url)}
						>
							Open {section.title}
							<HugeiconsIcon icon={ArrowRight01Icon} class="h-4 w-4" />
						</Button>
					</Card.Content>
				</Card.Root>
			{/each}

			<Card.Root class="border-dashed opacity-60">
				<Card.Header>
					<div class="bg-muted rounded-md p-2">
						<HugeiconsIcon icon={Analytics01Icon} class="h-5 w-5" />
					</div>
					<Card.Title class="mt-4">System Stats</Card.Title>
					<Card.Description>Platform metrics may be coming soon</Card.Description>
				</Card.Header>
			</Card.Root>
		</div>
	</div>
{/if}