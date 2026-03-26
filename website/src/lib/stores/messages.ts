import { writable } from 'svelte/store';

export const DM_UNREAD_COUNT = writable<number>(0);

export async function fetchDMUnreadCount(): Promise<void> {
	try {
		const res = await fetch('/api/messages/unread');
		if (res.ok) {
			const data = await res.json();
			DM_UNREAD_COUNT.set(Number(data.count));
		}
	} catch {}
}