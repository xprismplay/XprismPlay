import type { lotteryDraw } from "$lib/server/db/schema";

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
		value: 'Value',
		live: '● LIVE'
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
		groups: 'Groups',
		lottery: 'Lottery',
		live_trades: 'Live Trades',
		settings: 'Settings',
		admin: {
			main: 'Admin',
			promo: 'Promo Codes'
		}
	},
	main: {
		title: 'Welcome to XprismPlay!',
		description: "Here's the market overview for today.",
		market_overview: 'Market Overview'
	},
	lottery: {
  title: 'Lottery',
  description: 'Daily draw — 90% to the winner, 10% to the bank. Win chance grows with the pool (50% at $1M).',
  seo_description: 'Play the daily lottery in Rugplay. Win up to 90% of the prize pool. $500 per ticket.',
  loading: 'Loading lottery...',
  active_title: 'Active lottery',
  active_subtitle: 'Current draw. See below for how the scaling and ticket validity work.',
  current_draw: 'CURRENT DRAW',
  prize_pool: 'Prize pool',
  winner_share: 'Winner (90%)',
  bank_share: 'Bank (10%)',
  draw_at: 'Draw at',
  how_it_works: 'How it works',
  how_chance_title: 'Win chance scales with the prize pool',
  how_chance_body: 'At $0 the chance of picking a winner is 0.1%. It grows linearly to 50% when the pool reaches $1M. At the current pool of {{pool}}, today\'s draw chance is {{chance}}%. If no winner is picked, the pool rolls over to the next day.',
  how_tickets_title: 'Tickets are valid for one draw only',
  how_tickets_body: 'Each ticket enters you into that day\'s draw only. If no winner is picked, the prize pool rolls over — but your tickets do not. You must purchase new tickets for the next draw.',
  breakdown_title: 'Prize pool breakdown',
  breakdown_tickets: 'Ticket revenue',
  breakdown_bank: 'Bank contribution (20% of profit)',
  breakdown_donations: 'Donations',
  breakdown_rollover: 'Rollover from previous',
  odds_title: 'Tickets & odds',
  odds_tickets_sold: 'Tickets sold',
  odds_draw_chance: 'Chance a winner is drawn',
  odds_per_ticket: 'Your chance per ticket',
  odds_your_tickets: 'Your tickets (this draw)',
  odds_combined: 'Your combined chance to win',
  purchase_title: 'Purchase tickets',
  purchase_subtitle: '{{price}} per ticket. Tickets are valid for this draw only — if the pool rolls over, buy again for the next draw.',
  number_of_tickets: 'Number of tickets',
  each: 'each',
  total: 'Total',
  purchase_button: 'Purchase tickets',
  purchasing: 'Purchasing...',
  sign_in_to_purchase: 'Sign in to purchase lottery tickets.',
  history_title: 'Past lotteries',
  history_subtitle: 'Completed draws and rollovers. Winners are announced in the news feed.',
  history_date: 'Date',
  history_pool: 'Prize pool',
  history_tickets: 'Tickets sold',
  history_status: 'Status',
  history_winner: 'Winner',
  history_prize: 'Prize',
  no_history: 'No completed draws yet.',
  status_won: 'Won',
  status_rollover: 'Rollover',
  invalid_quantity: 'Please enter a valid quantity between 1 and 100.',
  purchase_failed: 'Failed to purchase tickets.',
  purchased: 'Successfully purchased {{n}} ticket(s)!'
},
	groups: {
		title: 'Groups',
		description: 'Join communities and manage a shared treasury',
		create: {
			button: 'Create Group',
			title: 'Create a Group',
			description: 'Costs ${{cost}} to create a group. You can create up to {{max}} groups.',
			name_label: 'Name',
			name_placeholder: 'My Awesome Group',
			name_hint: 'Letters, numbers, spaces, dashes, underscores',
			desc_label: 'Description',
			desc_placeholder: 'What is this group about?',
			public_label: 'Public Group',
			public_hint: 'Anyone can join without approval',
			submit: 'Create (${{cost}})',
			creating: 'Creating...',
			success: 'Group created!',
			errors: {
				name_required: 'Name required',
				failed: 'Failed to create group'
			}
		},
		my_groups: 'My Groups',
		browse: 'Browse Groups',
		no_groups: 'No groups found',
		members_count: '{{count}} members',
		treasury: 'Treasury: {{value}}',
		search_placeholder: 'Search groups...',
		visibility: {
			public: 'Public',
			private: 'Private'
		},
		roles: {
			owner: 'owner',
			admin: 'admin',
			member: 'member'
		},
		detail: {
			back: 'Back to Groups',
			tabs: {
				wall: 'Wall',
				members: 'Members',
				treasury: 'Treasury',
				requests: 'Requests'
			},
			join: 'Join',
			request_join: 'Request to Join',
			leave: 'Leave',
			settings: 'Settings',
			delete: 'Delete',
			joined: 'Joined group!',
			request_sent: 'Join request sent!',
			left: 'Left group',
			settings_saved: 'Settings saved',
			deleted: 'Group deleted',
			settings_dialog: {
				title: 'Group Settings',
				desc_label: 'Description',
				public_label: 'Public Group',
				public_hint: 'Anyone can join without approval',
				save: 'Save',
				saving: 'Saving...'
			},
			delete_dialog: {
				title: 'Delete Group',
				description: 'This is permanent. Treasury funds will be refunded to you.',
				confirm: 'Delete',
				deleting: 'Deleting...'
			},
			wall: {
				placeholder: 'Post something on the wall...',
				post: 'Post',
				posting: 'Posting...',
				empty: 'No posts yet',
				deleted: 'Post deleted'
			},
			members: {
				promote: 'Promote',
				demote: 'Demote',
				kick: 'Kick',
				kick_success: 'Member kicked',
				role_updated: 'Role updated'
			},
			treasury: {
				title: 'Treasury',
				balance: 'Balance',
				deposit: 'Deposit',
				withdraw: 'Withdraw',
				processing: 'Processing...',
				deposited: 'Deposited {{value}}',
				withdrew: 'Withdrew {{value}}',
				amount_placeholder: 'Amount',
				note_placeholder: 'Note (optional)',
				no_transactions: 'No transactions yet',
				recent: 'Recent Transactions'
			},
			requests: {
				empty: 'No pending join requests',
				accept: 'Accept',
				deny: 'Deny',
				accepted: 'Request accepted',
				denied: 'Request denied'
			}
		}
	},
	coin: {
		'24hchange': '24h change',
		marketcap: 'Market Cap',
		volume24h: 'Volume (24h)',
		createdBy: 'Created by',
		delisted: 'Delisted',
		priceChart: [
			'Price Chart ({{time}})',
			'1 minute',
			'5 minutes',
			'15 minutes',
			'1 hour',
			'4 hours',
			'1 day',
			'No trading data available yet'
		],
		trade: {
			title: 'Trade {{symbol}}',
			youOwn: 'You own: {{shares}} {{symbol}}',
			lock: ['🔒 Creator-only period: {{time}} remaining', '🔒 Trading unlocks in: {{time}}'],
			buy: {
				title: 'Buy {{symbol}}',
				current: 'Current price: ${{price}} per {{symbol}}',
				amountSpend: ['Amount to spend ($)', 'Balance: {{balance}}'],
				buy: 'Buy {{symbol}}'
			},
			sell: {
				title: 'Sell {{symbol}}'
			},
			burn: {
				title: 'Burn {{symbol}} Tokens'
			}
		},
		pool: {
			title: 'Pool Composition',
			baseCurrency: 'Base Currency:',
			burnedCoins: 'Burned Coins:',
			stats: {
				liquity: 'Total Liquity:',
				currentPrice: 'Current Price:'
			}
		},
		topHolders: {
			title: 'Top Holders'
		}
	},
	sign_in: {
		message: ['You need to', 'sign in', 'to play.'],
		sign_in: 'Sign In',
		form: {
			title: 'Sign in to XprismPlay',
			description:
				"Choose a service to sign in with. Your account will be created automatically if you don't have one.",
			services: {
				google: 'Continue with Google'
			},
			terms: ['By continuing, you agree to our', 'Terms of Service', 'and', 'Privacy Policy']
		},
		portfolio: ['You need to be logged in to view your portfolio', 'Sign In'],
		trade: 'Sign in to start trading'
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
