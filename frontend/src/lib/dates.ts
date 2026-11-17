import { addDays, differenceInCalendarDays, format } from "date-fns";

// Dates from the server are plain "2026-11-16" strings, and times are
// "2026-11-16T11:20:00" with no time zone. `new Date("2026-11-16")` would read
// the date as midnight UTC, which is the day before in the Americas, so every
// date and time string is parsed here, as local time, and nowhere else.

export type DateInput = string | Date;

export function parseDate(value: DateInput): Date {
  if (value instanceof Date) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }
  const [y, m, d] = value.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function parseDateTime(value: DateInput): Date {
  if (value instanceof Date) return new Date(value.getTime());
  const [datePart, timePart = "00:00:00"] = value.split(/[T ]/);
  const [y, m, d] = datePart.split("-").map(Number);
  const [hh = 0, mm = 0, ss = 0] = timePart.split(":").map((p) => Math.floor(Number(p)));
  return new Date(y, m - 1, d, hh, mm, ss);
}

/** Today in the browser, at midnight local time. */
export function today(): Date {
  return parseDate(new Date());
}

/** "2026-11-16", for the server and for date inputs. */
export function toISODate(value: Date): string {
  return format(value, "yyyy-MM-dd");
}

/** "2026-11-16T14:05:00", local time with no time zone. */
export function toISODateTime(value: Date): string {
  return format(value, "yyyy-MM-dd'T'HH:mm:ss");
}

/** "2026-11-16T14:05", for datetime-local inputs. */
export function toDateTimeInput(value: Date): string {
  return format(value, "yyyy-MM-dd'T'HH:mm");
}

export function isoDaysFromToday(days: number): string {
  return toISODate(addDays(today(), days));
}

/** "Nov 16, 2026" */
export function formatDate(value: DateInput): string {
  return format(parseDate(value), "MMM d, yyyy");
}

/** "Monday, Nov 16, 2026" */
export function formatLongDate(value: DateInput): string {
  return format(parseDate(value), "EEEE, MMM d, yyyy");
}

/** "11:20 AM" */
export function formatTime(value: DateInput): string {
  return format(parseDateTime(value), "h:mm a");
}

/** "Today, 11:20 AM", "Yesterday, 4:40 PM" or "Nov 12, 3:05 PM" */
export function formatWhen(value: DateInput, now: Date = new Date()): string {
  const when = parseDateTime(value);
  const days = differenceInCalendarDays(parseDate(now), parseDate(when));
  const time = format(when, "h:mm a");
  if (days === 0) return `Today, ${time}`;
  if (days === 1) return `Yesterday, ${time}`;
  if (when.getFullYear() === now.getFullYear()) return `${format(when, "MMM d")}, ${time}`;
  return `${format(when, "MMM d, yyyy")}, ${time}`;
}

/** Whole days from `from` to `to`, by calendar date. */
export function daysBetween(from: DateInput, to: DateInput): number {
  return differenceInCalendarDays(parseDate(to), parseDate(from));
}
