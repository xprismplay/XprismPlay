import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch }) => {
	const [currentRes, historyRes] = await Promise.all([
		fetch('/api/lottery'),
		fetch('/api/lottery/history?limit=10')
	]);

	const current = currentRes.ok ? await currentRes.json() : null;
	const history = historyRes.ok ? await historyRes.json() : { draws: [] };

	return { current, history: history.draws };
};