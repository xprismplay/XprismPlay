import { error } from '@sveltejs/kit';

export async function load({ params, fetch }) {
	const groupId = parseInt(params.groupId);
	if (isNaN(groupId)) throw error(400, 'Invalid group ID');

	const r = await fetch(`/api/groups/${groupId}`);
	if (!r.ok) {
		if (r.status === 404) throw error(404, 'Group not found');
		if (r.status === 403) throw error(403, 'This group is private');
		throw error(500, 'Failed to load group');
	}

	const group = await r.json();
	return { group };
}
