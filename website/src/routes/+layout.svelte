<script lang="ts">
	import '../app.css';

	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import { Toaster } from '$lib/components/ui/sonner';

	import AppSidebar from '$lib/components/self/AppSidebar.svelte';

	import { USER_DATA } from '$lib/stores/user-data';
	import { onMount, untrack } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import { ModeWatcher } from 'mode-watcher';
	import { page } from '$app/state';
	import { websocketController } from '$lib/stores/websocket';
	import { dev } from '$app/environment';
	import { RenderScan } from 'svelte-render-scan';
	import { _ } from 'svelte-i18n';

	let { data, children } = $props<{
		data: { userSession?: any };
		children: any;
	}>();

	untrack(() => USER_DATA.set(data?.userSession ?? null));
	$effect(() => {
		USER_DATA.set(data?.userSession ?? null);
	});

	onMount(() => {
		websocketController.connect();

		console.log(
			`%c                                       .--                    
                                      .=--:                   
                                   :=*#*:                     
                               .=******+#*.                   
                            .+*****+*#*+**#*                  
                          :**++**####*###*++#-                
                        =***+*####******###*+#*               
                      =***++#####***+++***%#*+*%:             
                    =*++*###+=++++====****##%#**#=            
                 .+**+=*##=*###+####*#+++*###%#**#=           
               :#*=**####=*#+-*##=-*##+**#####%##*%=          
     .      :+**++*###***++=*#++=*###**######%%%####:.--:     
    .---=******+*###****=***=-**+##*#+*###%%%***##%%#=--:     
     :-:  =#++**##***+++=******#*=##**#%%%##*#%*:             
           .**++*##***++**+**#*####+*%%#**#%+.                
             +***+##*=**=++******##%%*####:                   
              -#+++###***+*######%####%+                      
               .#*++*##**#####%%#**##=                        
                 *#*+*######%%#*###=                          
                  +#**#%%%%##**##-                            
                   =#***#*###%+.                              
                    -%#####*:                                 
                    .=%#*:                                    
                 .=--=.                                       
                   ::`,
			'color: #4962ee; font-family: monospace; font-size: 12px; font-weight: bold; text-shadow: 2px 2px rgba(0,0,0,0.2);'
		);
		console.log(
			'%c Welcome to XprismPlay! DO NOT FUCKING PASTE ANYTHING IN THE CONSOLE UNLESS YOU KNOW WHAT YOU ARE DOING.',
			'color: #4962ee; font-family: monospace; font-size: 12px; font-weight: bold; text-shadow: 2px 2px rgba(0,0,0,0.2);'
		);
		console.log(
			'%c A product by Outpoot.com',
			'color: #4962ee; font-family: monospace; font-size: 12px; font-weight: bold; text-shadow: 2px 2px rgba(0,0,0,0.2);'
		);

		const url = new URL(window.location.href);
		if (url.searchParams.has('signIn')) {
			url.searchParams.delete('signIn');
			window.history.replaceState({}, '', url);
			invalidateAll();
		}

		return () => {
			websocketController.disconnect();
		};
	});

	function getPageTitle(routeId: string | null): string {
		if (!routeId) return 'Rugplay';

		const titleMap: Record<string, string> = {
			'/': $_('page_names.home'),
			'/market': $_('page_names.market'),
			'/portfolio': $_('page_names.portfolio'),
			'/leaderboard': $_('page_names.leaderboard'),
			'/coin/create': $_('page_names.create_coin'),
			'/settings': $_('page_names.settings'),
			'/admin': $_('page_names.admin.main'),
			'/admin/promo': $_('page_names.admin.promo'),
			'/transactions': $_('page_names.transactions'),
			'/hopium': $_('page_names.hopium'),
			'/arcade': $_('page_names.arcade'),
			'/live': $_('page_names.live_trades'),
			'/treemap': $_('page_names.treemap'),
			'/about': $_('page_names.about'),
			'/legal/privacy': 'Privacy Policy',
			'/legal/terms': 'Terms of Service',
			'/shop': $_('page_names.shop'),
			'/lottery': $_('page_names.lottery')
		};

		// Handle dynamic routes
		if (routeId.startsWith('/coin/[coinSymbol]')) {
			return 'Coin Details';
		}
		if (routeId.startsWith('/user/[username]')) {
			return 'User Profile';
		}
		if (routeId.startsWith('/hopium/[id]')) {
			return 'Prediction Question';
		}

		return titleMap[routeId] || 'Rugplay';
	}
</script>

<!-- <RenderScan /> -->
<ModeWatcher />
<Toaster richColors={true} />

<Sidebar.Provider>
	<AppSidebar />

	<Sidebar.Inset class="sidebar-container">
		<header
			class="flex h-12 shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12"
		>
			<div class="flex w-full items-center gap-4 px-4 lg:px-6">
				<Sidebar.Trigger class="-ml-1" />

				<h1 class="mr-6 text-base font-medium">
					{getPageTitle(page.route.id)}
				</h1>
			</div>
		</header>

		<div class="main-content-area">
			<div class="@container/main flex flex-col gap-2">
				<div class="flex flex-col gap-4 md:gap-6">
					<div class="px-4 md:py-4 lg:px-6">
						{@render children()}
					</div>
				</div>
			</div>
		</div>
	</Sidebar.Inset>
</Sidebar.Provider>
