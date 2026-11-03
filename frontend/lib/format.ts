// Formatting and date helpers. All dates are shown in the browser's local time.

const LOCALE = "en-GB"; // 24 h clock, day-month order

const pad = (n: number) => String(n).padStart(2, "0");

/** 9000 -> "2 h 30 min", 2700 -> "45 min" */
export function formatDuration(seconds: number): string {
  const totalMin = Math.round(seconds / 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${pad(m)} min`;
}

/** 3723 -> "1:02:03" (for the running timer) */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 3600)}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

const hoursFmt = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 1 });

/** 9000 -> "2.5" */
export function formatHours(seconds: number): string {
  return hoursFmt.format(seconds / 3600);
}

const timeFmt = new Intl.DateTimeFormat(LOCALE, { hour: "2-digit", minute: "2-digit" });
export const formatTime = (iso: string) => timeFmt.format(new Date(iso));

const dayFmt = new Intl.DateTimeFormat(LOCALE, { weekday: "short", day: "numeric", month: "short" });
/** "2026-11-03" -> "Tue 3 Nov" */
export const formatDay = (dayKey: string) => dayFmt.format(fromDayKey(dayKey));

const longDayFmt = new Intl.DateTimeFormat(LOCALE, { weekday: "long", day: "numeric", month: "long" });
export const formatLongDay = (date: Date) => longDayFmt.format(date);

const monthFmt = new Intl.DateTimeFormat(LOCALE, { month: "long", year: "numeric" });
/** "2026-11" -> "November 2026" */
export const formatMonth = (monthKey: string) => monthFmt.format(fromMonthKey(monthKey));

const monthNameFmt = new Intl.DateTimeFormat(LOCALE, { month: "long" });
/** "2026-11" -> "November" */
export const formatMonthName = (monthKey: string) => monthNameFmt.format(fromMonthKey(monthKey));

const shortMonthFmt = new Intl.DateTimeFormat(LOCALE, { month: "short" });
export const formatShortMonth = (monthKey: string) => shortMonthFmt.format(fromMonthKey(monthKey));

/** Local date -> "YYYY-MM-DD" */
export const toDayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const fromDayKey = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
};

/** Local date -> "YYYY-MM" */
export const toMonthKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
export const fromMonthKey = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1);
};
export const addMonths = (key: string, n: number) => {
  const d = fromMonthKey(key);
  return toMonthKey(new Date(d.getFullYear(), d.getMonth() + n, 1));
};

/** Local date -> "HH:mm" */
export const toTimeValue = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** ISO -> value for <input type="datetime-local"> ("YYYY-MM-DDTHH:mm", local time) */
export const toDateTimeValue = (iso: string) => {
  const d = new Date(iso);
  return `${toDayKey(d)}T${toTimeValue(d)}`;
};

/** <input type="datetime-local"> value (local) -> ISO string (UTC) */
export const fromDateTimeValue = (value: string) => new Date(value).toISOString();
