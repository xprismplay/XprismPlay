<script lang="ts">
	import { onMount } from 'svelte';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { Shield01Icon } from '@hugeicons/core-free-icons';

	onMount(() => {
		// Wait a tiny bit for Svelte to finish rendering the DOM sizes
		setTimeout(() => {
			try {
				// Only target AdSense slots that haven't been filled by Google yet
				// This safely replaces the old push tags from your snippet
				const uninitializedAds = document.querySelectorAll('.adsbygoogle:not([data-adsbygoogle-status])');
				uninitializedAds.forEach(() => {
					// @ts-ignore
					(window.adsbygoogle = window.adsbygoogle || []).push({});
				});
			} catch (e) {
				console.error('AdSense error:', e);
			}
		}, 150);
	});
</script>

<svelte:head>
	<title>Support Us - XprismPlay</title>
	<meta name="robots" content="noindex, nofollow" />
	<script
		async
		src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8656856296349420"
		crossorigin="anonymous"
	></script>
</svelte:head>

<div class="container mx-auto space-y-8 p-6">
	<div class="flex flex-col items-center justify-center text-center gap-4 py-8">
		<div class="bg-primary/10 rounded-full p-4">
			<HugeiconsIcon icon={Shield01Icon} class="text-primary h-8 w-8" />
		</div>
		<h1 class="text-4xl font-bold tracking-tight">
			All the Ads (Support Us!)
		</h1>
		<p class="text-muted-foreground max-w-2xl text-lg">
			Thank you for wanting to support us! We've contained all our ads exclusively to this page so the rest of your experience stays completely ad-free.
		</p>
	</div>

	<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
		
		<div class="bg-card border rounded-xl p-4 min-h-[300px] flex items-center justify-center overflow-hidden">
			<ins class="adsbygoogle"
				style="display:block; min-width: 250px; width:100%; min-height: 250px;"
				data-ad-client="ca-pub-8656856296349420"
				data-ad-slot="5137134038"
				data-ad-format="auto"
				data-full-width-responsive="true"></ins>
		</div>

		<div class="bg-card border rounded-xl p-4 min-h-[300px] flex items-center justify-center overflow-hidden">
			<ins class="adsbygoogle"
				style="display:block; min-width: 250px; width:100%; min-height: 250px;"
				data-ad-client="ca-pub-8656856296349420"
				data-ad-slot="5137134038"
				data-ad-format="auto"
				data-full-width-responsive="true"></ins>
		</div>

		<div class="bg-card border rounded-xl p-4 min-h-[300px] flex items-center justify-center overflow-hidden">
			<ins class="adsbygoogle"
				style="display:block; min-width: 250px; width:100%; min-height: 250px;"
				data-ad-client="ca-pub-8656856296349420"
				data-ad-slot="5137134038"
				data-ad-format="auto"
				data-full-width-responsive="true"></ins>
		</div>

	</div>
</div>