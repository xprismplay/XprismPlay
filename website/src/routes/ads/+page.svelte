<script lang="ts">
	import { onMount } from 'svelte';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { HatIcon } from '@hugeicons/core-free-icons';

	// This triggers Google AdSense to fill all the <ins> tags on the page
	onMount(() => {
		try {
			const ads = document.querySelectorAll('.adsbygoogle');
			ads.forEach(() => {
				// @ts-ignore - adsbygoogle is injected by the external script
				(window.adsbygoogle = window.adsbygoogle || []).push({});
			});
		} catch (e) {
			console.error('AdSense error:', e);
		}
	});
</script>


<svelte:head>
	<title>Support Xprism - XprismPlay</title>
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
			<HugeiconsIcon icon={HatIcon} class="text-primary h-8 w-8" />
		</div>
		<h1 class="text-4xl font-bold tracking-tight">
			Support XprismPlay
		</h1>
		<p class="text-muted-foreground max-w-2xl text-lg">
			Thank you for wanting to support Xprism! By visiting this page and viewing the ads below, you help keep Xprism servers running. Xprism've contained all Xprism ads exclusively to this page so the rest of your experience stays completely ad-free!
		</p>
	</div>

	<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
		<div class="bg-card border rounded-xl p-4 min-h-[300px] flex items-center justify-center overflow-hidden">
			<ins class="adsbygoogle"
                style="display:block"
                data-ad-client="ca-pub-8656856296349420"
                data-ad-slot="8306019595"
                data-ad-format="auto"
                data-full-width-responsive="true"></ins>
		</div>

		<div class="bg-card border rounded-xl p-4 min-h-[300px] flex items-center justify-center overflow-hidden">
			<ins class="adsbygoogle"
				style="display:block; width:100%; height:100%;"
				data-ad-client="ca-pub-8656856296349420"
				data-ad-slot="5137134038"
				data-ad-format="auto"
				data-full-width-responsive="true"></ins>
		</div>

		<div class="bg-card border rounded-xl p-4 min-h-[300px] flex items-center justify-center overflow-hidden">
			<ins class="adsbygoogle"
				style="display:block; width:100%; height:100%;"
				data-ad-client="ca-pub-8656856296349420"
				data-ad-slot="5137134038"
				data-ad-format="auto"
				data-full-width-responsive="true"></ins>
		</div>
	</div>

	<div class="bg-card border rounded-xl p-4 mt-8 min-h-[250px] flex items-center justify-center overflow-hidden">
		<ins class="adsbygoogle"
			style="display:block; width:100%; height:100%;"
			data-ad-client="ca-pub-8656856296349420"
			data-ad-slot="5137134038"
			data-ad-format="auto"
			data-full-width-responsive="true"></ins>
	</div>
    <script>
        (adsbygoogle = window.adsbygoogle || []).push({});
    </script>
</div>