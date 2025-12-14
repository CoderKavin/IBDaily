/**
 * Reminder window logic for email notifications
 * All times in IST (Asia/Kolkata)
 */

const INDIA_TZ = "Asia/Kolkata";
const DEADLINE_HOUR = 21; // 9:00 PM IST

export type ReminderType = "REMIND" | "LAST_CALL";

export interface ReminderWindow {
  type: ReminderType;
  isInWindow: boolean;
  minutesUntilDeadline: number;
}

export interface UserReminderCheck {
  userId: string;
  email: string;
  userName: string | null;
  cohortId: string;
  cohortName: string;
  reminderType: ReminderType;
  minutesUntilDeadline: number;
}

/**
 * Get today's 9 PM IST deadline as a Date
 */
export function getTodayDeadline(now: Date = new Date()): Date {
  // Get today's date in IST
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: INDIA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const todayIST = formatter.format(now);

  // Create deadline: today at 21:00 IST (+05:30)
  const deadlineISO = `${todayIST}T${DEADLINE_HOUR}:00:00+05:30`;
  return new Date(deadlineISO);
}

/**
 * Get current hour in IST (0-23)
 */
export function getCurrentHourIST(now: Date = new Date()): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: INDIA_TZ,
    hour: "numeric",
    hour12: false,
  });
  return parseInt(formatter.format(now), 10);
}

/**
 * Check if current time is within quiet hours
 */
export function isInQuietHours(
  quietStart: number | null,
  quietEnd: number | null,
  now: Date = new Date()
): boolean {
  if (quietStart === null || quietEnd === null) {
    return false;
  }

  const currentHour = getCurrentHourIST(now);

  // Handle overnight quiet hours (e.g., 22:00 - 07:00)
  if (quietStart > quietEnd) {
    return currentHour >= quietStart || currentHour < quietEnd;
  }

  // Normal quiet hours (e.g., 14:00 - 16:00)
  return currentHour >= quietStart && currentHour < quietEnd;
}

/**
 * Get minutes until deadline
 * Returns negative if past deadline
 */
export function getMinutesUntilDeadline(now: Date = new Date()): number {
  const deadline = getTodayDeadline(now);
  const diffMs = deadline.getTime() - now.getTime();
  return Math.floor(diffMs / (1000 * 60));
}

/**
 * Check which reminder window we're in (if any)
 */
export function checkReminderWindow(params: {
  remindTimeMinutes: number; // e.g., 90 (1.5 hours before deadline)
  lastCallMinutes: number; // e.g., 15 (15 min before deadline)
  now?: Date;
}): ReminderWindow | null {
  const now = params.now || new Date();
  const minutesLeft = getMinutesUntilDeadline(now);

  // Past deadline
  if (minutesLeft <= 0) {
    return null;
  }

  // Window tolerance: ±5 minutes
  const TOLERANCE = 5;

  // Check last call window (higher priority)
  if (
    minutesLeft <= params.lastCallMinutes + TOLERANCE &&
    minutesLeft >= params.lastCallMinutes - TOLERANCE
  ) {
    return {
      type: "LAST_CALL",
      isInWindow: true,
      minutesUntilDeadline: minutesLeft,
    };
  }

  // Check remind window
  if (
    minutesLeft <= params.remindTimeMinutes + TOLERANCE &&
    minutesLeft >= params.remindTimeMinutes - TOLERANCE
  ) {
    return {
      type: "REMIND",
      isInWindow: true,
      minutesUntilDeadline: minutesLeft,
    };
  }

  return null;
}

/**
 * Determine if we should send a reminder to a user
 * Returns the reminder type to send, or null if no reminder needed
 */
export function shouldSendReminder(params: {
  hasSubmittedToday: boolean;
  prefsEnabled: boolean;
  remindTimeMinutes: number;
  lastCallMinutes: number;
  quietHoursStart: number | null;
  quietHoursEnd: number | null;
  alreadySentRemind: boolean;
  alreadySentLastCall: boolean;
  now?: Date;
}): ReminderType | null {
  const now = params.now || new Date();

  // Already submitted - no reminder needed
  if (params.hasSubmittedToday) {
    return null;
  }

  // Notifications disabled
  if (!params.prefsEnabled) {
    return null;
  }

  // In quiet hours
  if (isInQuietHours(params.quietHoursStart, params.quietHoursEnd, now)) {
    return null;
  }

  const window = checkReminderWindow({
    remindTimeMinutes: params.remindTimeMinutes,
    lastCallMinutes: params.lastCallMinutes,
    now,
  });

  if (!window) {
    return null;
  }

  // Check if already sent this type today
  if (window.type === "REMIND" && params.alreadySentRemind) {
    return null;
  }

  if (window.type === "LAST_CALL" && params.alreadySentLastCall) {
    return null;
  }

  return window.type;
}

/**
 * Get today's date key in IST (YYYY-MM-DD)
 */
export function getTodayDateKeyIST(now: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: INDIA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(now);
}
