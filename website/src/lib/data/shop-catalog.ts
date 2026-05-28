export type Rarity = 'uncommon' | 'rare' | 'epic' | 'legendary' | 'light' | 'dark';

export interface NameColorItem {
	key: string;
	label: string;
	rarity: Rarity;
	price: number; // gems
	classes: string;
	style?: string;
}

export const RARITY_LABEL: Record<Rarity, string> = {
	uncommon: 'Uncommon',
	rare: 'Rare',
	epic: 'Epic',
	legendary: 'Legendary',
	light: 'Light',
	dark: 'Dark'
};

export const RARITY_CLASS: Record<Rarity, string> = {
	uncommon: 'text-emerald-500',
	rare: 'text-blue-500',
	epic: 'text-purple-500',
	legendary: 'text-yellow-400',
	light: 'text-red-500',
	dark: 'text-red-900'
};

export const NAME_COLOR_CATALOG: NameColorItem[] = [
	// Uncommon
	{
		key: 'green',
		label: 'Green Candle',
		rarity: 'uncommon',
		price: 300,
		classes: 'text-green-500'
	},
	{
		key: 'uncommon_white',
		label: 'Uncommon Default Color',
		rarity: 'uncommon',
		price: 300,
		style: 'color: var(--foreground)',
		classes: ''
	},
	{ key: 'blue', label: 'Blue Chip', rarity: 'uncommon', price: 300, classes: 'text-blue-500' },
	{
		key: 'orange',
		label: 'Orange Peel',
		rarity: 'uncommon',
		price: 400,
		classes: 'text-orange-400'
	},
	// Rare
	{ key: 'purple', label: 'Purple Haze', rarity: 'rare', price: 700, classes: 'text-purple-500' },
	{ key: 'red', label: 'Red Alert', rarity: 'rare', price: 700, classes: 'text-red-500' },
	{
		key: 'white',
		label: 'Rare Default Color',
		rarity: 'rare',
		price: 700,
		style: 'color: var(--foreground)',
		classes: ''
	},
	// Epic
	{ key: 'gold', label: 'Gold Rush', rarity: 'epic', price: 1400, classes: 'text-yellow-400' },
	{
		key: 'fire',
		label: 'Degen Fire',
		rarity: 'epic',
		price: 1800,
		classes: 'bg-clip-text text-transparent',
		style: 'background-image: linear-gradient(90deg, #f97316, #ef4444, #f59e0b)'
	},
	{
		key: 'epic_white',
		label: 'Epic Default Color',
		rarity: 'epic',
		price: 1800,
		style: 'color: var(--foreground)',
		classes: ''
	},
	{
		key: 'ocean',
		label: 'Ocean Wave',
		rarity: 'epic',
		price: 1600,
		classes: 'bg-clip-text text-transparent',
		style: 'background-image: linear-gradient(90deg, #06b6d4, #3b82f6, #8b5cf6)'
	},
	// Legendary
	{
		key: 'rainbow',
		label: 'Rainbow Baby',
		rarity: 'legendary',
		price: 4500,
		classes: 'bg-clip-text text-transparent animate-rainbow-text',
		style:
			'background-image: linear-gradient(90deg, #ef4444, #f97316, #eab308, #22c55e, #3b82f6, #8b5cf6, #ec4899)'
	},
	{
		key: 'diamond',
		label: 'Diamond Hands',
		rarity: 'legendary',
		price: 5000,
		classes: 'bg-clip-text text-transparent animate-diamond-shimmer',
		style: 'background-image: linear-gradient(135deg, #e2e8f0, #67e8f9, #c084fc, #e2e8f0)'
	},
	{
		key: 'legendary_white',
		label: 'Legendary Default Color',
		rarity: 'legendary',
		price: 5000,
		style: 'color: var(--foreground)',
		classes: ''
	},
	{
		key: 'coffee',
		label: 'Coffee Grind',
		rarity: 'legendary',
		price: 5500,
		classes: 'bg-clip-text text-transparent animate-diamond-shimmer',
		style: 'background-image: linear-gradient(135deg, #5B3A29, #3E2723, #A0785A)'
	},
	{
		key: 'sigma',
		label: 'Purple Sigma',
		rarity: 'legendary',
		price: 6000,
		classes: 'bg-clip-text text-transparent animate-diamond-shimmer',
		style: 'background-image: linear-gradient(135deg, #4B0082, #9966CC, #B026FF)'
	},
	{
		key: 'face',
		label: 'Face Dev',
		rarity: 'legendary',
		price: 6500,
		classes: 'bg-clip-text text-transparent animate-diamond-shimmer',
		style: 'background-image: linear-gradient(135deg, #000000, #ffffff)'
	},
	{
		key: 'pink',
		label: 'Pink Candle', // if you found this comment, please add a better name :D
		rarity: 'legendary',
		price: 7000,
		classes: 'bg-clip-text text-transparent animate-diamond-shimmer',
		style: 'background-image: linear-gradient(135deg, #ff6999, #ffabab, #ff6999)'
	},

	// Light

	{
		key: 'green_glow',
		label: 'Green Light',
		rarity: 'light',
		price: 8000,
		classes: 'text-green-500',
		style: 'text-shadow: 0px 0px 10px var(--color-green-600);'
	},
	{
		key: 'red_glow',
		label: 'Red Light',
		rarity: 'light',
		price: 8000,
		classes: 'text-red-500',
		style: 'text-shadow: 0px 0px 10px var(--color-red-600);'
	},
	{
		key: 'blue_glow',
		label: 'Blue Light',
		rarity: 'light',
		price: 8000,
		classes: 'text-blue-500',
		style: 'text-shadow: 0px 0px 10px var(--color-blue-600);'
	},
	{
		key: 'yellow_glow',
		label: 'Yellow Light',
		rarity: 'light',
		price: 8000,
		classes: 'text-yellow-500',
		style: 'text-shadow: 0px 0px 10px var(--color-yellow-600);'
	},
	{
		key: 'purple_glow',
		label: 'Purple Light',
		rarity: 'light',
		price: 8000,
		classes: 'text-purple-500',
		style: 'text-shadow: 0px 0px 10px var(--color-purple-600);'
	},
	{
		key: 'pink_glow',
		label: 'Pink Light',
		rarity: 'light',
		price: 8000,
		classes: 'text-[#ffabab]',
		style: 'text-shadow: 0px 0px 10px var(--color-pink-600);'
	},
	{
		key: 'orange_glow',
		label: 'Orange Light',
		rarity: 'light',
		price: 8000,
		classes: 'text-orange-400',
		style: 'text-shadow: 0px 0px 10px var(--color-orange-500);'
	},
	{
		key: 'mint_glow',
		label: 'Mint Light',
		rarity: 'light',
		price: 8000,
		classes: 'text-emerald-500',
		style: 'text-shadow: 0px 0px 10px var(--color-emerald-600);'
	},
	{
		key: 'cyan_glow',
		label: 'Cyan Light',
		rarity: 'light',
		price: 8000,
		classes: 'text-cyan-400',
		style: 'text-shadow: 0px 0px 10px var(--color-cyan-500);'
	},
	{
		key: 'silver_glow',
		label: 'Silver Light',
		rarity: 'light',
		price: 8000,
		classes: 'text-slate-500',
		style: 'text-shadow: 0px 0px 10px var(--color-slate-700);'
	},
	{
		key: 'coffee_glow',
		label: 'Coffee Light',
		rarity: 'light',
		price: 8000,
		classes: 'bg-clip-text text-transparent animate-diamond-shimmer',
		style:
			'background-image: linear-gradient(135deg, #5B3A29, #3E2723, #A0785A); text-shadow: 0px 0px 10px #3E2723;'
	},
	{
		key: 'default_glow',
		label: 'Default Light',
		rarity: 'light',
		price: 8000,
		classes: '',
		style: 'text-shadow: 0px 0px 10px var(--foreground);'
	},
	{
		key: 'violet_light',
		label: 'Violet Light',
		rarity: 'light',
		price: 9000,
		classes: 'text-violet-800',
		style:
			'text-shadow: 0px 0px 10px var(--foreground); text-shadow: 0px 0px 7px var(--color-purple-950), 0px 0px 10px var(--color-purple-900), 0px 0px 14px var(--color-purple-800);'
	},

	// Dark

	{
		key: 'green_dark',
		label: 'Green Dark',
		rarity: 'dark',
		price: 8000,
		classes: 'text-green-700',
		style: 'text-shadow: 0px 0px 10px var(--color-green-700);'
	},
	{
		key: 'red_dark',
		label: 'Red Dark',
		rarity: 'dark',
		price: 8000,
		classes: 'text-red-700',
		style: 'text-shadow: 0px 0px 10px var(--color-red-700);'
	},
	{
		key: 'blue_dark',
		label: 'Blue Dark',
		rarity: 'dark',
		price: 8000,
		classes: 'text-blue-700',
		style: 'text-shadow: 0px 0px 10px var(--color-blue-700);'
	},
	{
		key: 'yellow_dark',
		label: 'Yellow Dark',
		rarity: 'dark',
		price: 8000,
		classes: 'text-yellow-700',
		style: 'text-shadow: 0px 0px 10px var(--color-yellow-700);'
	},
	{
		key: 'purple_dark',
		label: 'Purple Dark',
		rarity: 'dark',
		price: 8000,
		classes: 'text-purple-700',
		style: 'text-shadow: 0px 0px 10px var(--color-purple-600);'
	},
	{
		key: 'pink_dark',
		label: 'Pink Dark',
		rarity: 'dark',
		price: 8000,
		classes: 'text-[#ad6c6c]',
		style: 'text-shadow: 0px 0px 10px var(--color-pink-800);'
	},
	{
		key: 'orange_dark',
		label: 'Orange Dark',
		rarity: 'dark',
		price: 8000,
		classes: 'text-orange-700',
		style: 'text-shadow: 0px 0px 10px var(--color-orange-800);'
	},
	{
		key: 'mint_dark',
		label: 'Mint Dark',
		rarity: 'dark',
		price: 8000,
		classes: 'text-emerald-700',
		style: 'text-shadow: 0px 0px 10px var(--color-emerald-800);'
	},
	{
		key: 'cyan_dark',
		label: 'Cyan Dark',
		rarity: 'dark',
		price: 8000,
		classes: 'text-cyan-700',
		style: 'text-shadow: 0px 0px 10px var(--color-cyan-800);'
	},
	{
		key: 'silver_dark',
		label: 'Silver Dark',
		rarity: 'dark',
		price: 8000,
		classes: 'text-slate-700',
		style: 'text-shadow: 0px 0px 10px var(--color-slate-700);'
	},
	{
		key: 'coffee_dark',
		label: 'Coffee Dark',
		rarity: 'dark',
		price: 8000,
		classes: 'bg-clip-text text-transparent animate-diamond-shimmer',
		style:
			'background-image: linear-gradient(135deg, #5B3A29, #3E2723, #A0785A); text-shadow: 0px 0px 10px #3E2723;'
	},
	{
		key: 'face_glow',
		label: 'Face Dark',
		rarity: 'dark',
		price: 8000,
		classes: 'bg-clip-text text-transparent animate-diamond-shimmer',
		style: 'background-image: linear-gradient(135deg, #000, #fff); text-shadow: 0px 0px 6px #000;'
	}
];

export type CrateTierId = 'standard' | 'premium' | 'legendary' | 'mythic';

export interface CrateTier {
	id: CrateTierId;
	label: string;
	description: string;
	cost: number;
	accent: string;
	sprite: { idle: string; open: string };
	rewards: CrateRewardTier[];
}

export interface CrateRewardTier {
	weight: number;
	type: 'buss' | 'color';
	min: number;
	max: number;
	rarity: Rarity | null;
	label: string;
}

export const CRATE_TIERS: Record<CrateTierId, CrateTier> = {
	standard: {
		id: 'standard',
		label: 'Small Crate',
		description: 'Common rewards with a chance at uncommon colors.',
		cost: 150,
		accent: '#a0724a',
		sprite: { idle: '/chests/chest1_idle.png', open: '/chests/chest1_open.png' },
		rewards: [
			{ weight: 40, type: 'buss', min: 250, max: 2000, rarity: null, label: '$250–2,000' },
			{ weight: 25, type: 'buss', min: 2000, max: 5000, rarity: null, label: '$2,000–5,000' },
			{
				weight: 25,
				type: 'color',
				min: 100,
				max: 100,
				rarity: 'uncommon',
				label: 'Uncommon color + $100'
			},
			{ weight: 10, type: 'color', min: 250, max: 250, rarity: 'rare', label: 'Rare color + $250' }
		]
	},
	premium: {
		id: 'premium',
		label: 'Fatass Crate',
		description: 'Better odds for rare and epic colors.',
		cost: 400,
		accent: '#5b8dd9',
		sprite: { idle: '/chests/chest2_idle.png', open: '/chests/chest2_open.png' },
		rewards: [
			{ weight: 25, type: 'buss', min: 1000, max: 5000, rarity: null, label: '$1,000–5,000' },
			{ weight: 15, type: 'buss', min: 5000, max: 15000, rarity: null, label: '$5,000–15,000' },
			{ weight: 30, type: 'color', min: 500, max: 500, rarity: 'rare', label: 'Rare color + $500' },
			{
				weight: 22,
				type: 'color',
				min: 1500,
				max: 1500,
				rarity: 'epic',
				label: 'Epic color + $1,500'
			},
			{
				weight: 8,
				type: 'color',
				min: 5000,
				max: 5000,
				rarity: 'legendary',
				label: 'Legendary color + $5,000'
			}
		]
	},
	legendary: {
		id: 'legendary',
		label: 'Motion Crate',
		description: 'High chance of rare+ colors. Best legendary odds.',
		cost: 1000,
		accent: '#e5a63b',
		sprite: { idle: '/chests/chest3_idle.png', open: '/chests/chest3_open.png' },
		rewards: [
			{ weight: 15, type: 'buss', min: 5000, max: 25000, rarity: null, label: '$5,000–25,000' },
			{
				weight: 30,
				type: 'color',
				min: 1000,
				max: 1000,
				rarity: 'rare',
				label: 'Rare color + $1,000'
			},
			{
				weight: 30,
				type: 'color',
				min: 2500,
				max: 2500,
				rarity: 'epic',
				label: 'Epic color + $2,500'
			},
			{
				weight: 23,
				type: 'color',
				min: 10000,
				max: 10000,
				rarity: 'legendary',
				label: 'Legendary color + $10,000'
			},
			{
				weight: 1,
				type: 'color',
				min: 10000,
				max: 10000,
				rarity: 'light',
				label: 'Light color + $10,000'
			},
			{
				weight: 1,
				type: 'color',
				min: 10000,
				max: 10000,
				rarity: 'dark',
				label: 'Dark color + $10,000'
			}
		]
	},
	mythic: {
		id: 'mythic',
		label: 'Auraful Crate',
		description: 'The ultimate crate. Very high chance of epic+ colors.',
		cost: 2500,
		accent: '#c24adb',
		sprite: { idle: '/chests/chest4_idle.png', open: '/chests/chest4_open.png' },
		rewards: [
			{ weight: 10, type: 'buss', min: 15000, max: 75000, rarity: null, label: '$15,000–75,000' },
			{
				weight: 35,
				type: 'color',
				min: 5000,
				max: 5000,
				rarity: 'epic',
				label: 'Epic color + $5,000'
			},
			{
				weight: 45,
				type: 'color',
				min: 20000,
				max: 20000,
				rarity: 'legendary',
				label: 'Legendary color + $20,000'
			},
			{
				weight: 5,
				type: 'color',
				min: 20000,
				max: 20000,
				rarity: 'light',
				label: 'Light color + $20,000'
			},
			{
				weight: 5,
				type: 'color',
				min: 20000,
				max: 20000,
				rarity: 'dark',
				label: 'Dark color + $20,000'
			}
		]
	}
};

export const CRATE_COST = CRATE_TIERS.standard.cost;

export function getColorByKey(key: string): NameColorItem | undefined {
	return NAME_COLOR_CATALOG.find((c) => c.key === key);
}
