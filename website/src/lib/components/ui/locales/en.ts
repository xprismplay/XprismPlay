export default {
	lang: {
		code: 'en',
		name: 'English',
		flagCode: 'us'
	},
	global: {
		price: 'Price',
		name: 'Name',
		reset: 'Reset',
		apply: 'Apply',
		coin: 'Coin',
		max: 'Max',
		cancel: 'Cancel',
		try_again: 'Try Again',
		type: 'Type',
		sender: 'Sender',
		receiver: 'Receiver',
		unknown: 'Unknown',
		quantity: 'Quantity',
		amount: 'Amount',
		date: 'Date',
		note: 'Note',
		value: 'Value'
	},
	greetings: {
		good_morning: 'Good Morning, {{name}}!',
		good_afternoon: 'Good afternoon, {{name}}!',
		good_evening: 'Good evening, {{name}}!',
		good_night: 'Good night, {{name}}!'
	},
	page_names: {
		home: 'Home',
		market: 'Market',
		hopium: 'Hopium',
		arcade: 'Arcade',
		leaderboard: 'Leaderboard',
		shop: 'Shop',
		achievements: 'Achievements',
		portfolio: 'Portfolio',
		treemap: 'Treemap',
		create_coin: 'Create Coin',
		notifications: 'Notifications',
		about: 'About',
		live_trades: 'Live Trades'
	},
	main: {
		title: 'Welcome to XprismPlay!',
		description: "Here's the market overview for today.",
		market_overview: 'Market Overview'
	},
	coin: {
		'24hchange': '24h change',
		marketcap: 'Market Cap',
		volume24h: 'Volume (24h)'
	},
	sign_in: {
		message: ['You need to', 'sign in', 'to play.'],
		form: {
			title: 'Sign in to XprismPlay',
			description:
				"Choose a service to sign in with. Your account will be created automatically if you don't have one.",
			services: {
				google: 'Continue with Google'
			},
			terms: ['By continuing, you agree to our', 'Terms of Service', 'and', 'Privacy Policy']
		},
		portfolio: ['You need to be logged in to view your portfolio', 'Sign In']
	},
	leaderboard: {
		title: 'Leaderboard',
		description: 'Top performers and market activity',
		no_data: 'No data',
		failed: {
			title: 'Failed to load leaderboard',
			// TODO: Removing this line soon
			try_again: 'Try Again'
		},
		rugpullers: {
			title: 'Top Rugpullers (24h)',
			description: 'Users who made the most profit from selling coins today',
			no_data: 'No major profits recorded today'
		},
		losers: {
			title: 'Biggest Losses (24h)',
			description: 'Users who experienced the largest losses today',
			no_data: 'No major losses recorded today'
		},
		top_cash: {
			title: 'Top Cash Holders',
			description: 'Users with the highest liquid cash balances',
			no_data: "Everyone's invested! 💸"
		},
		portfolio: {
			title: 'Highest Portfolio Values',
			description: 'Users with the largest total portfolio valuations (including illiquid)',
			no_data: 'No large portfolios yet! 📉'
		}
	},
	market: {
		title: 'Market',
		description: 'Discover coins, track performance, and find your next investment',
		showing: 'Showing {{startIndex}}-{{endIndex}} of {{totalCount}} coins',
		search: {
			placeholder: 'Search coins by name or symbol...',
			filters: {
				title: 'Filters',
				sort_by: 'Sort By',
				marketcap: 'Market Cap',
				change24h: 'Change (24h)',
				price: 'Price',
				volume24h: 'Volume (24h)',
				clear: 'Clear all filters',
				sort_order: {
					title: 'Sort Order',
					high_low: 'High to Low',
					low_high: 'Low to High'
				},
				price_range: {
					title: 'Price Range',
					all_prices: 'All Prices',
					under1: 'Under $1',
					'1-10': '$1 - $10',
					'10-100': '$10 - $100',
					over100: 'Over $100'
				},
				'24h_change': {
					title: '24h Change',
					all: 'All Changes',
					gainers: 'Gainers only',
					losers: 'LOsers only',
					hot: 'Hot (10%)',
					wild: 'Wild (50%)'
				}
			}
		}
	},
	portfolio: {
		title: 'Portfolio',
		description: 'Manage your investments and transactions',
		cash_balance: ['Cash Balance', '{{percent}}% of portfolio'],
		coin_holdings: ['Coin Holdings', '{{quantity}} positions'],
		your_holdings: ['Your Holdings', 'Current positions in your portfolio'],
		recent_transactions: ['Recent Transactions', 'Your latest trading activity', 'View All'],
		total: 'Total',
		no_coins: [
			'No coin holdings',
			"You haven't invested in any coins yet. Start by buying existing coins.",
			'Browse Coins'
		],
		send_money: {
			title: 'Send Money',
			send: ['Send', 'Sending...'],
			description: 'Send cash or coins to another user',
			recipient: ['Recipient', 'Enter username (without @)'],
			type: ['Type', 'Cash ($)', 'Coins', 'Select transfer type'],
			cash: [
				'Amount ($)',
				'Available: ${{balance}}',
				'Minimum: $10.00 per transfer',
				'Cash transfers require a minimum of $10.00',
				'Insuficient Funds',
				'Money sent successfully!',
				'Sent ${{amount}} to @{{recipent}}'
			],
			coins: [
				'Select Coin',
				'Amount {{coinSymbol}}',
				'Available: {{shares}}',
				'Minimum estimated value: $10.00 per transfer',
				'Coin transfers require a minimum estimated value of $10.00',
				'Insufficient coins',
				'Coins sent successfully!',
				'Sent {{amount}} {{symbol}} (≈${{estimated}}) to @${{recipent}}',
				'*{{symbol}} ({{quantity}}'
			],
			note: ['Note', '(optional)', 'Add a reference note to this transfer...'],
			youre_sending: ["You're sending:", '{{amount}} USD', 'To:']
		},
		no_transactions: [
			'No transactions yet',
			"You haven't made any trades yet. Start by buying or selling coins."
		]
	}
};
