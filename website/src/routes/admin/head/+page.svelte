<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import {
		Shield01Icon,
		UserCheck01Icon,
		Cancel01Icon,
		Coins01Icon
	} from '@hugeicons/core-free-icons';
	import { toast } from 'svelte-sonner';

	// Toggle Admin State
	let usernameToAction = $state('');
	let actionLoading = $state(false);

	// Balance State
	let balanceUsername = $state('');
	let balanceAmount = $state('');
	let balanceLoading = $state(false);

	// Prestige State
	let prestigeUsername = $state('');
	let prestigeLevel = $state('');
	let prestigeLoading = $state(false);

	// Delist State
	let delistCoinSymbol = $state('');
	let delistLoading = $state(false);

	// Remove Portfolio State
	let removePortfolioUsername = $state('');
	let removePortfolioSymbol = $state('');
	let removePortfolioLoading = $state(false);

	async function toggleAdmin(makeAdmin: boolean) {
		if (!usernameToAction.trim()) return;

		actionLoading = true;
		try {
			const response = await fetch('/api/admin/head/toggle-admin', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ username: usernameToAction.trim(), makeAdmin })
			});

			if (response.ok) {
				const data = await response.json();
				toast.success(data.message);
				usernameToAction = '';
			} else {
				const error = await response.json();
				toast.error(error.message || 'Failed to update user');
			}
		} catch (e) {
			toast.error('Failed to communicate with the server');
		} finally {
			actionLoading = false;
		}
	}

	async function updateBalance(action: 'set' | 'add' | 'subtract') {
		const amountNum = Number(balanceAmount);
		if (!balanceUsername.trim() || isNaN(amountNum)) {
			toast.error('Please provide a valid username and amount.');
			return;
		}

		balanceLoading = true;
		try {
			const response = await fetch('/api/admin/head/balance', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					username: balanceUsername.trim(),
					amount: amountNum,
					action
				})
			});

			if (response.ok) {
				const data = await response.json();
				toast.success(data.message);
				balanceUsername = '';
				balanceAmount = '';
			} else {
				const error = await response.json();
				toast.error(error.message || 'Failed to update balance');
			}
		} catch (e) {
			toast.error('Failed to communicate with the server');
		} finally {
			balanceLoading = false;
		}
	}

	async function updatePrestige() {
		const levelNum = parseInt(prestigeLevel);
		if (!prestigeUsername.trim() || isNaN(levelNum) || levelNum < 0) {
			toast.error('Please provide a valid username and a prestige level (0 or higher).');
			return;
		}

		prestigeLoading = true;
		try {
			const response = await fetch('/api/admin/head/prestige', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					username: prestigeUsername.trim(),
					level: levelNum
				})
			});

			if (response.ok) {
				const data = await response.json();
				toast.success(data.message);
				prestigeUsername = '';
				prestigeLevel = '';
			} else {
				const error = await response.json();
				toast.error(error.message || 'Failed to update prestige');
			}
		} catch (e) {
			toast.error('Failed to communicate with the server');
		} finally {
			prestigeLoading = false;
		}
	}

	async function delistCoin() {
		if (!delistCoinSymbol.trim()) return;

		delistLoading = true;
		try {
			const response = await fetch('/api/admin/head/delist', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					coinSymbol: delistCoinSymbol.trim()
				})
			});

			if (response.ok) {
				const data = await response.json();
				toast.success(data.message);
				delistCoinSymbol = '';
			} else {
				const error = await response.json();
				toast.error(error.message || 'Failed to delist coin');
			}
		} catch (e) {
			toast.error('Failed to communicate with the server');
		} finally {
			delistLoading = false;
		}
	}

	async function removePortfolio() {
		if (!removePortfolioUsername.trim() || !removePortfolioSymbol.trim()) return;

		removePortfolioLoading = true;
		try {
			const response = await fetch('/api/admin/head/remove-portfolio', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					username: removePortfolioUsername.trim(),
					coinSymbol: removePortfolioSymbol.trim()
				})
			});

			if (response.ok) {
				const data = await response.json();
				toast.success(data.message);
				removePortfolioUsername = '';
				removePortfolioSymbol = '';
			} else {
				const error = await response.json();
				toast.error(error.message || 'Failed to remove portfolio');
			}
		} catch (e) {
			toast.error('Failed to communicate with the server');
		} finally {
			removePortfolioLoading = false;
		}
	}
</script>

<div class="container mx-auto max-w-4xl space-y-6 py-6">
	<Card.Root>
		<Card.Header>
			<Card.Title class="flex items-center gap-2">
				<HugeiconsIcon icon={Shield01Icon} class="h-5 w-5 text-orange-500" />
				Head Admin Panel
			</Card.Title>
			<Card.Description>Manage administrator privileges for standard users.</Card.Description>
		</Card.Header>
		<Card.Content>
			<div class="max-w-md space-y-4">
				<div>
					<label for="username" class="mb-2 block text-sm font-medium">Target Username</label>
					<Input
						id="username"
						bind:value={usernameToAction}
						placeholder="Enter username (without @)"
					/>
				</div>
				<div class="flex gap-4 pt-2">
					<Button
						onclick={() => toggleAdmin(true)}
						disabled={!usernameToAction.trim() || actionLoading}
						class="flex-1 bg-orange-500 text-white hover:bg-orange-600"
					>
						<HugeiconsIcon icon={UserCheck01Icon} class="mr-2 h-4 w-4" />
						Make Admin
					</Button>
					<Button
						variant="destructive"
						onclick={() => toggleAdmin(false)}
						disabled={!usernameToAction.trim() || actionLoading}
						class="flex-1"
					>
						<HugeiconsIcon icon={Cancel01Icon} class="mr-2 h-4 w-4" />
						Revoke Admin
					</Button>
				</div>
			</div>
		</Card.Content>
	</Card.Root>

	<Card.Root>
		<Card.Header>
			<Card.Title class="flex items-center gap-2">
				<HugeiconsIcon icon={Coins01Icon} class="h-5 w-5 text-green-500" />
				Balance Management
			</Card.Title>
			<Card.Description
				>Set, add, or subtract from a user's base currency balance (negatives allowed).</Card.Description
			>
		</Card.Header>
		<Card.Content>
			<div class="max-w-md space-y-4">
				<div>
					<label for="bal-username" class="mb-2 block text-sm font-medium">Target Username</label>
					<Input
						id="bal-username"
						bind:value={balanceUsername}
						placeholder="Enter username (without @)"
					/>
				</div>
				<div>
					<label for="amount" class="mb-2 block text-sm font-medium">Amount</label>
					<Input
						id="amount"
						type="number"
						bind:value={balanceAmount}
						placeholder="0.00"
						step="0.01"
					/>
				</div>
				<div class="flex gap-2 pt-2">
					<Button
						onclick={() => updateBalance('set')}
						disabled={!balanceUsername.trim() || !balanceAmount || balanceLoading}
						class="flex-1 bg-blue-500 text-white hover:bg-blue-600"
					>
						Set Exact
					</Button>
					<Button
						onclick={() => updateBalance('add')}
						disabled={!balanceUsername.trim() || !balanceAmount || balanceLoading}
						class="flex-1 bg-green-500 text-white hover:bg-green-600"
					>
						+ Add
					</Button>
					<Button
						variant="destructive"
						onclick={() => updateBalance('subtract')}
						disabled={!balanceUsername.trim() || !balanceAmount || balanceLoading}
						class="flex-1"
					>
						- Subtract
					</Button>
				</div>
			</div>
		</Card.Content>
	</Card.Root>

	<Card.Root>
		<Card.Header>
			<Card.Title class="flex items-center gap-2">
				<HugeiconsIcon icon={UserCheck01Icon} class="h-5 w-5 text-yellow-500" />
				Prestige Management
			</Card.Title>
			<Card.Description>Set a user's prestige level.</Card.Description>
		</Card.Header>
		<Card.Content>
			<div class="max-w-md space-y-4">
				<div>
					<label for="prestige-username" class="mb-2 block text-sm font-medium"
						>Target Username</label
					>
					<Input
						id="prestige-username"
						bind:value={prestigeUsername}
						placeholder="Enter username (without @)"
					/>
				</div>
				<div>
					<label for="prestige" class="mb-2 block text-sm font-medium">Prestige Level</label>
					<Input
						id="prestige"
						type="number"
						min="0"
						step="1"
						bind:value={prestigeLevel}
						placeholder="0"
					/>
				</div>
				<div class="pt-2">
					<Button
						onclick={updatePrestige}
						disabled={!prestigeUsername.trim() || !prestigeLevel || prestigeLoading}
						class="w-full bg-yellow-500 text-white hover:bg-yellow-600"
					>
						Update Prestige
					</Button>
				</div>
			</div>
		</Card.Content>
	</Card.Root>

	<Card.Root>
		<Card.Header>
			<Card.Title class="flex items-center gap-2">
				<HugeiconsIcon icon={Cancel01Icon} class="h-5 w-5 text-red-500" />
				Delist Coin
			</Card.Title>
			<Card.Description>Delist a coin.</Card.Description>
		</Card.Header>
		<Card.Content>
			<div class="max-w-md space-y-4">
				<div>
					<label for="delist-symbol" class="mb-2 block text-sm font-medium">Coin Symbol</label>
					<Input
						id="delist-symbol"
						bind:value={delistCoinSymbol}
						placeholder="Enter coin symbol (e.g., BTC)"
					/>
				</div>
				<div class="pt-2">
					<Button
						variant="destructive"
						onclick={delistCoin}
						disabled={!delistCoinSymbol.trim() || delistLoading}
						class="w-full"
					>
						Delist
					</Button>
				</div>
			</div>
		</Card.Content>
	</Card.Root>

	<Card.Root>
		<Card.Header>
			<Card.Title class="flex items-center gap-2">
				<HugeiconsIcon icon={Cancel01Icon} class="h-5 w-5 text-red-500" />
				Remove Portfolio
			</Card.Title>
			<Card.Description
				>Remove a user's portfolio, remove coin hodlings, without giving them the money</Card.Description
			>
		</Card.Header>
		<Card.Content>
			<div class="max-w-md space-y-4">
				<div>
					<label for="rp-username" class="mb-2 block text-sm font-medium">Target Username</label>
					<Input
						id="rp-username"
						bind:value={removePortfolioUsername}
						placeholder="Enter username (without @)"
					/>
				</div>
				<div>
					<label for="rp-symbol" class="mb-2 block text-sm font-medium">Coin Symbol</label>
					<Input
						id="rp-symbol"
						bind:value={removePortfolioSymbol}
						placeholder="Enter coin symbol (e.g., BTC)"
					/>
				</div>
				<div class="pt-2">
					<Button
						variant="destructive"
						onclick={removePortfolio}
						disabled={!removePortfolioUsername.trim() ||
							!removePortfolioSymbol.trim() ||
							removePortfolioLoading}
						class="w-full"
					>
						Remove Portfolio
					</Button>
				</div>
			</div>
		</Card.Content>
	</Card.Root>
</div>
