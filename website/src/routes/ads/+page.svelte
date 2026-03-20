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
	import { hasFlag } from '$lib/data/flags';

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
		},
		{
			title: 'Admin Logs',
			description: 'Live feed of all moderator and admin actions.',
			icon: Shield01Icon,
			url: '/admin/logs',
			color: 'text-orange-500'
		},
		{
			title: 'Transactions Logs',
			description: 'Complete record of trading activity and transactions of the entire platform.',
			icon: Analytics01Icon,
			url: '/admin/transactions',
			color: 'text-red-500'
		}
	];
</script>

<svelte:head>
	<title>All the Ads of XprismPlay</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

	<div class="container mx-auto space-y-6 p-6">
		<div class="flex items-center gap-3">
			<div class="bg-primary/10 rounded-lg p-2">
				<HugeiconsIcon icon={Shield01Icon} class="text-primary h-6 w-6" />
			</div>
			<div>
				<h1 class="text-3xl font-bold tracking-tight">All the Ads (stored here so not put around site instead)</h1>
				<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8656856296349420"
     crossorigin="anonymous"></script>
			</div>
		</div>
    </div>