import { writable } from 'svelte/store';

export type User = {
	id: string;
	name: string;
	username: string;
	email: string;
	flags: bigint;
	image: string;
	isBanned: boolean;
	banReason: string | null;
	avatarUrl: string | null;
	timezone: number;

	baseCurrencyBalance: number;
	bio: string;

	volumeMaster: number;
	volumeMuted: boolean;

	nameColor: string | null;
	prestigeLevel: number;
	hideAds: boolean;
} | null;

export const USER_DATA = writable<User>(null);
