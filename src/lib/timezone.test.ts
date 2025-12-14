/**
 * Unit tests for timezone utilities
 * Run with: npx tsx src/lib/timezone.test.ts
 */

import {
  getIndiaDateKey,
  getIndiaCutoff,
  computeOnTime,
  getLastNDays,
  formatTimeRemaining,
  getWeekStartDateKey,
  getIndiaDayOfWeek,
  isSameWeek,
  getWeekEndDateKey,
} from "./timezone";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`FAILED: ${message}`);
  }
  console.log(`✓ ${message}`);
}

function runTests() {
  console.log("\n=== Timezone Utility Tests ===\n");

  // Test 1: getIndiaDateKey formats correctly
  {
    // Create a known UTC time: 2024-01-15 18:30:00 UTC = 2024-01-16 00:00:00 IST
    const date = new Date("2024-01-15T18:30:00Z");
    const dateKey = getIndiaDateKey(date);
    assert(
      dateKey === "2024-01-16",
      `getIndiaDateKey for UTC 18:30 should be next day in IST, got ${dateKey}`,
    );
  }

  // Test 2: getIndiaDateKey for early UTC time
  {
    // 2024-01-15 10:00:00 UTC = 2024-01-15 15:30:00 IST
    const date = new Date("2024-01-15T10:00:00Z");
    const dateKey = getIndiaDateKey(date);
    assert(
      dateKey === "2024-01-15",
      `getIndiaDateKey for UTC 10:00 should be same day in IST, got ${dateKey}`,
    );
  }

  // Test 3: getIndiaCutoff returns correct time
  {
    const cutoff = getIndiaCutoff("2024-01-15");
    // 21:00 IST = 15:30 UTC
    const expectedUTC = new Date("2024-01-15T15:30:00Z");
    assert(
      cutoff.getTime() === expectedUTC.getTime(),
      `getIndiaCutoff should return 21:00 IST (15:30 UTC), got ${cutoff.toISOString()}`,
    );
  }

  // Test 4: computeOnTime - submission before deadline
  {
    const createdAt = new Date("2024-01-15T14:00:00Z"); // 19:30 IST
    const dateKey = "2024-01-15";
    assert(
      computeOnTime(createdAt, dateKey) === true,
      "Submission at 19:30 IST should be on time for 21:00 deadline",
    );
  }

  // Test 5: computeOnTime - submission exactly at deadline
  {
    const createdAt = new Date("2024-01-15T15:30:00Z"); // 21:00 IST exactly
    const dateKey = "2024-01-15";
    assert(
      computeOnTime(createdAt, dateKey) === true,
      "Submission exactly at 21:00 IST should be on time",
    );
  }

  // Test 6: computeOnTime - submission after deadline
  {
    const createdAt = new Date("2024-01-15T15:31:00Z"); // 21:01 IST
    const dateKey = "2024-01-15";
    assert(
      computeOnTime(createdAt, dateKey) === false,
      "Submission at 21:01 IST should be late",
    );
  }

  // Test 7: getLastNDays returns correct number of days
  {
    const days = getLastNDays(7, new Date("2024-01-15T12:00:00Z"));
    assert(
      days.length === 7,
      `getLastNDays(7) should return 7 days, got ${days.length}`,
    );
    assert(
      days[6] === "2024-01-15",
      `Last day should be 2024-01-15, got ${days[6]}`,
    );
    assert(
      days[0] === "2024-01-09",
      `First day should be 2024-01-09, got ${days[0]}`,
    );
  }

  // Test 8: formatTimeRemaining
  {
    const formatted = formatTimeRemaining(3661000); // 1 hour, 1 minute, 1 second
    assert(
      formatted === "01:01:01",
      `formatTimeRemaining should format correctly, got ${formatted}`,
    );
  }

  // Test 9: formatTimeRemaining for zero
  {
    const formatted = formatTimeRemaining(0);
    assert(
      formatted === "00:00:00",
      `formatTimeRemaining(0) should be 00:00:00, got ${formatted}`,
    );
  }

  // Test 10: formatTimeRemaining for negative
  {
    const formatted = formatTimeRemaining(-1000);
    assert(
      formatted === "00:00:00",
      `formatTimeRemaining(-1000) should be 00:00:00, got ${formatted}`,
    );
  }

  console.log("\n=== Week Calculation Tests ===\n");

  // Test 11: getIndiaDayOfWeek - Monday
  {
    // 2024-01-15 is a Monday
    const date = new Date("2024-01-15T10:00:00+05:30");
    const dayOfWeek = getIndiaDayOfWeek(date);
    assert(
      dayOfWeek === 1,
      `2024-01-15 should be Monday (1), got ${dayOfWeek}`,
    );
  }

  // Test 12: getIndiaDayOfWeek - Sunday
  {
    // 2024-01-14 is a Sunday
    const date = new Date("2024-01-14T10:00:00+05:30");
    const dayOfWeek = getIndiaDayOfWeek(date);
    assert(
      dayOfWeek === 0,
      `2024-01-14 should be Sunday (0), got ${dayOfWeek}`,
    );
  }

  // Test 13: getWeekStartDateKey - Monday stays Monday
  {
    // 2024-01-15 is a Monday
    const date = new Date("2024-01-15T10:00:00+05:30");
    const weekStart = getWeekStartDateKey(date);
    assert(
      weekStart === "2024-01-15",
      `Monday 2024-01-15 week start should be 2024-01-15, got ${weekStart}`,
    );
  }

  // Test 14: getWeekStartDateKey - Wednesday goes back to Monday
  {
    // 2024-01-17 is a Wednesday
    const date = new Date("2024-01-17T10:00:00+05:30");
    const weekStart = getWeekStartDateKey(date);
    assert(
      weekStart === "2024-01-15",
      `Wednesday 2024-01-17 week start should be 2024-01-15, got ${weekStart}`,
    );
  }

  // Test 15: getWeekStartDateKey - Sunday goes back to previous Monday
  {
    // 2024-01-14 is a Sunday, previous Monday is 2024-01-08
    const date = new Date("2024-01-14T10:00:00+05:30");
    const weekStart = getWeekStartDateKey(date);
    assert(
      weekStart === "2024-01-08",
      `Sunday 2024-01-14 week start should be 2024-01-08, got ${weekStart}`,
    );
  }

  // Test 16: getWeekStartDateKey - Saturday goes back to Monday
  {
    // 2024-01-20 is a Saturday, week starts 2024-01-15
    const date = new Date("2024-01-20T10:00:00+05:30");
    const weekStart = getWeekStartDateKey(date);
    assert(
      weekStart === "2024-01-15",
      `Saturday 2024-01-20 week start should be 2024-01-15, got ${weekStart}`,
    );
  }

  // Test 17: isSameWeek - same week
  {
    const date1 = new Date("2024-01-15T10:00:00+05:30"); // Monday
    const date2 = new Date("2024-01-19T10:00:00+05:30"); // Friday
    assert(
      isSameWeek(date1, date2) === true,
      "Monday and Friday of same week should be same week",
    );
  }

  // Test 18: isSameWeek - different weeks
  {
    const date1 = new Date("2024-01-15T10:00:00+05:30"); // Monday
    const date2 = new Date("2024-01-22T10:00:00+05:30"); // Next Monday
    assert(
      isSameWeek(date1, date2) === false,
      "Two consecutive Mondays should be different weeks",
    );
  }

  // Test 19: isSameWeek - Sunday and Monday are different weeks
  {
    const date1 = new Date("2024-01-14T10:00:00+05:30"); // Sunday
    const date2 = new Date("2024-01-15T10:00:00+05:30"); // Monday
    assert(
      isSameWeek(date1, date2) === false,
      "Sunday and next Monday should be different weeks",
    );
  }

  // Test 20: getWeekEndDateKey
  {
    const date = new Date("2024-01-15T10:00:00+05:30"); // Monday
    const weekEnd = getWeekEndDateKey(date);
    assert(
      weekEnd === "2024-01-21",
      `Week ending for Monday 2024-01-15 should be Sunday 2024-01-21, got ${weekEnd}`,
    );
  }

  // Test 21: Week boundary at IST midnight
  {
    // 2024-01-14 23:59 IST (Sunday) = 2024-01-14 18:29 UTC
    const sundayLateIST = new Date("2024-01-14T18:29:00Z");
    const sundayWeekStart = getWeekStartDateKey(sundayLateIST);
    assert(
      sundayWeekStart === "2024-01-08",
      `Late Sunday IST should still be in previous week, got ${sundayWeekStart}`,
    );

    // 2024-01-15 00:01 IST (Monday) = 2024-01-14 18:31 UTC
    const mondayEarlyIST = new Date("2024-01-14T18:31:00Z");
    const mondayWeekStart = getWeekStartDateKey(mondayEarlyIST);
    assert(
      mondayWeekStart === "2024-01-15",
      `Early Monday IST should be in new week, got ${mondayWeekStart}`,
    );
  }

  console.log("\n=== All tests passed! ===\n");
}

runTests();
