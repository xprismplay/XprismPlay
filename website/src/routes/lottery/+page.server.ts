import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch }) => {
	const [currentRes, historyRes, weeklyRes, weeklyHistoryRes] = await Promise.all([
		fetch('/api/lottery'),
		fetch('/api/lottery/history?limit=10'),
		fetch('/api/lottery/weekly'),
		fetch('/api/lottery/weekly/history?limit=5')
	]);

	const current = currentRes.ok ? await currentRes.json() : null;
	const history = historyRes.ok ? await historyRes.json() : { draws: [] };
	const weekly = weeklyRes.ok ? await weeklyRes.json() : null;
	const weeklyHistory = weeklyHistoryRes.ok ? await weeklyHistoryRes.json() : { draws: [] };

	return {
		current,
		history: history.draws,
		weekly,
		weeklyHistory: weeklyHistory.draws
	};
};