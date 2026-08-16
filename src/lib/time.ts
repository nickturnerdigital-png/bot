/** Parse "HH:MM" (24h) into minutes since midnight. */
export function parseTimeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** Format minutes since midnight as "h:mm AM/PM". */
export function formatMinutes(totalMinutes: number): string {
  const m = ((Math.round(totalMinutes) % 1440) + 1440) % 1440;
  const hours24 = Math.floor(m / 60);
  const minutes = m % 60;
  const period = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12}:${String(minutes).padStart(2, "0")} ${period}`;
}

/** Minutes since midnight for the current local time. */
export function nowMinutes(): number {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

export function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}
