const hourMs = 3600 * 1000;
// https://en.wikipedia.org/wiki/List_of_tz_database_time_zones
export const timezoneList = [
	-12, -11, -10, -9, -8, -7, -6, -5, -4, -3.5, -3, -2, -1, 0, 1, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5,
	5.75, 6, 6.5, 7, 8, 8.75, 9, 9.5, 10, 10.5, 11, 12, 12.75
];
export function getTimezoneDate(offset: number) {
	const now = new Date();
	const utc = now.getTime() + now.getTimezoneOffset() * 60000;
	return new Date(utc + hourMs * offset);
}

export function formatTimezone(t: number) {
	const hours = Math.floor(Math.abs(t));
	const minutes = Math.round((Math.abs(t) % 1) * 60);
	const sign = t < 0 ? '-' : '+';
	return `${sign}${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}
