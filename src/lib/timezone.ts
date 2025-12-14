/**
 * Timezone utilities for India Standard Time (IST)
 * All deadline logic uses Asia/Kolkata timezone
 */

const INDIA_TZ = "Asia/Kolkata";
const DEADLINE_HOUR = 21; // 9:00 PM IST

/**
 * Get current date/time in India timezone
 */
export function getIndiaNow(): Date {
  return new Date();
}

/**
 * Format a date as YYYY-MM-DD in India timezone
 */
export function getIndiaDateKey(date: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: INDIA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(date);
}

/**
 * Get the day of week (0=Sunday, 1=Monday, ..., 6=Saturday) in IST
 */
export function getIndiaDayOfWeek(date: Date = new Date()): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: INDIA_TZ,
    weekday: "short",
  });
  const dayName = formatter.format(date);
  const days: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return days[dayName] ?? 0;
}

/**
 * Get the Monday of the week for a given date (in IST)
 * Returns YYYY-MM-DD format
 */
export function getWeekStartDateKey(date: Date = new Date()): string {
  const dateKey = getIndiaDateKey(date);
  const dayOfWeek = getIndiaDayOfWeek(date);

  // Calculate days since Monday (Monday = 1, so we subtract (dayOfWeek - 1) for Mon-Sat, or 6 for Sunday)
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

  // Create a date object and subtract days
  const [year, month, day] = dateKey.split("-").map(Number);
  const mondayDate = new Date(year, month - 1, day - daysFromMonday);

  return getIndiaDateKey(mondayDate);
}

/**
 * Get the deadline (9 PM IST) for a given dateKey
 * Returns a Date object representing 21:00:00 IST on that day
 */
export function getIndiaCutoff(dateKey: string): Date {
  // Parse the dateKey (YYYY-MM-DD)
  const [year, month, day] = dateKey.split("-").map(Number);

  // Create a date string in ISO format with IST offset (+05:30)
  // 21:00 IST = 15:30 UTC
  const isoString = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T21:00:00+05:30`;
  return new Date(isoString);
}

/**
 * Check if a submission is on time
 * On time means createdAt <= 21:00 IST on the dateKey day
 */
export function computeOnTime(createdAt: Date, dateKey: string): boolean {
  const cutoff = getIndiaCutoff(dateKey);
  return createdAt <= cutoff;
}

/**
 * Get the time remaining until today's 9 PM IST deadline
 * Returns milliseconds remaining, or 0 if past deadline
 */
export function getTimeUntilDeadline(): number {
  const now = new Date();
  const todayKey = getIndiaDateKey(now);
  const cutoff = getIndiaCutoff(todayKey);
  const remaining = cutoff.getTime() - now.getTime();
  return Math.max(0, remaining);
}

/**
 * Format milliseconds as HH:MM:SS
 */
export function formatTimeRemaining(ms: number): string {
  if (ms <= 0) return "00:00:00";

  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/**
 * Get an array of dateKeys for the last N days (including today)
 */
export function getLastNDays(n: number, fromDate: Date = new Date()): string[] {
  const days: string[] = [];
  const date = new Date(fromDate);

  for (let i = 0; i < n; i++) {
    days.unshift(getIndiaDateKey(date));
    date.setDate(date.getDate() - 1);
  }

  return days;
}

/**
 * Check if deadline has passed for today
 */
export function isDeadlinePassed(): boolean {
  return getTimeUntilDeadline() === 0;
}

/**
 * Check if two dates are in the same week (IST, Monday-based)
 */
export function isSameWeek(date1: Date, date2: Date): boolean {
  return getWeekStartDateKey(date1) === getWeekStartDateKey(date2);
}

/**
 * Get end of week (Sunday 23:59:59 IST) for a given date
 */
export function getWeekEndDateKey(date: Date = new Date()): string {
  const mondayKey = getWeekStartDateKey(date);
  const [year, month, day] = mondayKey.split("-").map(Number);
  const sundayDate = new Date(year, month - 1, day + 6);
  return getIndiaDateKey(sundayDate);
}
