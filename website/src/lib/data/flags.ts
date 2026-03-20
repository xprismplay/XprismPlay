export const UserFlags = {
	IS_ADMIN: 1n << 0n,
	IS_HEAD_ADMIN: 1n << 1n,
	FOUNDER_BADGE: 1n << 2n,
	NO_ARCADE: 1n << 3n,
	NO_TRADING: 1n << 4n,
	NO_TRANSFER: 1n << 5n,
	NO_HOPIUM: 1n << 6n,
	NO_GROUP_TRANSFER: 1n << 7n,
	NO_PROMOCODES: 1n << 8n
} as const;
export function hasFlag(
	_flags: bigint | number | string | undefined,
	...flag_l: (keyof typeof UserFlags)[]
) {
	const flags = BigInt(_flags ?? 0);
	if (flags === 0n) return false;
	for (const flag of flag_l) if ((flags & UserFlags[flag]) !== 0n) return true;
	return false;
}
