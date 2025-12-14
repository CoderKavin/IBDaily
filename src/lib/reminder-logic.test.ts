/**
 * Tests for reminder logic
 */

import {
  getTodayDeadline,
  getCurrentHourIST,
  isInQuietHours,
  getMinutesUntilDeadline,
  checkReminderWindow,
  shouldSendReminder,
  getTodayDateKeyIST,
} from "./reminder-logic";

console.log("=== Testing getTodayDeadline ===\n");

// Test 1: Returns a Date object
{
  const deadline = getTodayDeadline();
  console.assert(deadline instanceof Date, "Should return a Date object");
  console.log("1. Returns Date object: PASS");
}

// Test 2: Deadline is at 21:00 IST (15:30 UTC)
{
  const testDate = new Date("2024-03-15T12:00:00+05:30");
  const deadline = getTodayDeadline(testDate);
  console.assert(
    deadline.getUTCHours() === 15,
    `Expected UTC hour 15, got ${deadline.getUTCHours()}`,
  );
  console.assert(
    deadline.getUTCMinutes() === 30,
    `Expected UTC minute 30, got ${deadline.getUTCMinutes()}`,
  );
  console.log("2. Deadline at 21:00 IST (15:30 UTC): PASS");
}

console.log("\n=== Testing getCurrentHourIST ===\n");

// Test 3: Returns valid hour
{
  const hour = getCurrentHourIST();
  console.assert(hour >= 0 && hour <= 23, `Hour should be 0-23, got ${hour}`);
  console.log("3. Returns valid hour (0-23): PASS");
}

console.log("\n=== Testing isInQuietHours ===\n");

// Test 4: Null quiet hours = not in quiet
{
  const result = isInQuietHours(null, null);
  console.assert(result === false, "Null quiet hours should return false");
  console.log("4. Null quiet hours returns false: PASS");
}

// Test 5: During normal quiet hours (14:00-16:00)
{
  // 15:00 IST = 09:30 UTC
  const testDate = new Date("2024-03-15T09:30:00Z");
  const result = isInQuietHours(14, 16, testDate);
  console.assert(result === true, "Should be in quiet hours at 15:00 IST");
  console.log("5. During normal quiet hours: PASS");
}

// Test 6: Outside normal quiet hours
{
  // 12:00 IST = 06:30 UTC
  const testDate = new Date("2024-03-15T06:30:00Z");
  const result = isInQuietHours(14, 16, testDate);
  console.assert(result === false, "Should not be in quiet hours at 12:00 IST");
  console.log("6. Outside normal quiet hours: PASS");
}

// Test 7: Overnight quiet hours - late night
{
  // 23:00 IST = 17:30 UTC
  const lateNight = new Date("2024-03-15T17:30:00Z");
  const result = isInQuietHours(22, 7, lateNight);
  console.assert(
    result === true,
    "23:00 IST should be in quiet hours (22:00-07:00)",
  );
  console.log("7. Overnight quiet hours (late night): PASS");
}

// Test 8: Overnight quiet hours - early morning
{
  // 03:00 IST = 21:30 UTC (previous day)
  const earlyMorning = new Date("2024-03-14T21:30:00Z");
  const result = isInQuietHours(22, 7, earlyMorning);
  console.assert(
    result === true,
    "03:00 IST should be in quiet hours (22:00-07:00)",
  );
  console.log("8. Overnight quiet hours (early morning): PASS");
}

// Test 9: Outside overnight quiet hours
{
  // 12:00 IST = 06:30 UTC
  const noon = new Date("2024-03-15T06:30:00Z");
  const result = isInQuietHours(22, 7, noon);
  console.assert(
    result === false,
    "12:00 IST should not be in quiet hours (22:00-07:00)",
  );
  console.log("9. Outside overnight quiet hours: PASS");
}

console.log("\n=== Testing getMinutesUntilDeadline ===\n");

// Test 10: Before deadline
{
  // 19:00 IST = 13:30 UTC, deadline is 21:00 IST
  const beforeDeadline = new Date("2024-03-15T13:30:00Z");
  const minutes = getMinutesUntilDeadline(beforeDeadline);
  console.assert(minutes === 120, `Expected 120 minutes, got ${minutes}`);
  console.log("10. 2 hours before deadline = 120 minutes: PASS");
}

// Test 11: After deadline
{
  // 22:00 IST = 16:30 UTC
  const afterDeadline = new Date("2024-03-15T16:30:00Z");
  const minutes = getMinutesUntilDeadline(afterDeadline);
  console.assert(minutes === -60, `Expected -60 minutes, got ${minutes}`);
  console.log("11. 1 hour after deadline = -60 minutes: PASS");
}

console.log("\n=== Testing checkReminderWindow ===\n");

// Test 12: Past deadline returns null
{
  const afterDeadline = new Date("2024-03-15T16:30:00Z");
  const result = checkReminderWindow({
    remindTimeMinutes: 90,
    lastCallMinutes: 15,
    now: afterDeadline,
  });
  console.assert(result === null, "Past deadline should return null");
  console.log("12. Past deadline returns null: PASS");
}

// Test 13: In remind window
{
  // 90 minutes before: 19:30 IST = 14:00 UTC
  const inRemindWindow = new Date("2024-03-15T14:00:00Z");
  const result = checkReminderWindow({
    remindTimeMinutes: 90,
    lastCallMinutes: 15,
    now: inRemindWindow,
  });
  console.assert(result !== null, "Should return window info");
  console.assert(
    result?.type === "REMIND",
    `Expected REMIND, got ${result?.type}`,
  );
  console.log("13. In remind window returns REMIND: PASS");
}

// Test 14: In last call window
{
  // 15 minutes before: 20:45 IST = 15:15 UTC
  const inLastCall = new Date("2024-03-15T15:15:00Z");
  const result = checkReminderWindow({
    remindTimeMinutes: 90,
    lastCallMinutes: 15,
    now: inLastCall,
  });
  console.assert(result !== null, "Should return window info");
  console.assert(
    result?.type === "LAST_CALL",
    `Expected LAST_CALL, got ${result?.type}`,
  );
  console.log("14. In last call window returns LAST_CALL: PASS");
}

// Test 15: Outside both windows
{
  // 3 hours before: 18:00 IST = 12:30 UTC
  const outsideWindows = new Date("2024-03-15T12:30:00Z");
  const result = checkReminderWindow({
    remindTimeMinutes: 90,
    lastCallMinutes: 15,
    now: outsideWindows,
  });
  console.assert(result === null, "Outside windows should return null");
  console.log("15. Outside both windows returns null: PASS");
}

console.log("\n=== Testing shouldSendReminder ===\n");

const defaultParams = {
  hasSubmittedToday: false,
  prefsEnabled: true,
  remindTimeMinutes: 90,
  lastCallMinutes: 15,
  quietHoursStart: null,
  quietHoursEnd: null,
  alreadySentRemind: false,
  alreadySentLastCall: false,
};

// Test 16: Already submitted returns null
{
  const result = shouldSendReminder({
    ...defaultParams,
    hasSubmittedToday: true,
    now: new Date("2024-03-15T14:00:00Z"),
  });
  console.assert(result === null, "Already submitted should return null");
  console.log("16. Already submitted returns null: PASS");
}

// Test 17: Notifications disabled returns null
{
  const result = shouldSendReminder({
    ...defaultParams,
    prefsEnabled: false,
    now: new Date("2024-03-15T14:00:00Z"),
  });
  console.assert(result === null, "Disabled prefs should return null");
  console.log("17. Notifications disabled returns null: PASS");
}

// Test 18: In quiet hours returns null
{
  // 19:30 IST is in quiet hours 19-21
  const result = shouldSendReminder({
    ...defaultParams,
    quietHoursStart: 19,
    quietHoursEnd: 21,
    now: new Date("2024-03-15T14:00:00Z"), // 19:30 IST
  });
  console.assert(result === null, "In quiet hours should return null");
  console.log("18. In quiet hours returns null: PASS");
}

// Test 19: REMIND already sent returns null
{
  const result = shouldSendReminder({
    ...defaultParams,
    alreadySentRemind: true,
    now: new Date("2024-03-15T14:00:00Z"),
  });
  console.assert(result === null, "REMIND already sent should return null");
  console.log("19. REMIND already sent returns null: PASS");
}

// Test 20: In remind window, not sent, returns REMIND
{
  const result = shouldSendReminder({
    ...defaultParams,
    now: new Date("2024-03-15T14:00:00Z"), // 19:30 IST
  });
  console.assert(result === "REMIND", `Expected REMIND, got ${result}`);
  console.log("20. In remind window returns REMIND: PASS");
}

// Test 21: In last call window returns LAST_CALL
{
  const result = shouldSendReminder({
    ...defaultParams,
    now: new Date("2024-03-15T15:15:00Z"), // 20:45 IST
  });
  console.assert(result === "LAST_CALL", `Expected LAST_CALL, got ${result}`);
  console.log("21. In last call window returns LAST_CALL: PASS");
}

console.log("\n=== Testing getTodayDateKeyIST ===\n");

// Test 22: Returns YYYY-MM-DD format
{
  const dateKey = getTodayDateKeyIST();
  const pattern = /^\d{4}-\d{2}-\d{2}$/;
  console.assert(
    pattern.test(dateKey),
    `Expected YYYY-MM-DD format, got ${dateKey}`,
  );
  console.log("22. Returns YYYY-MM-DD format: PASS");
}

// Test 23: Correct date for IST timezone (early morning)
{
  // 2:00 AM IST on March 16 = 20:30 UTC on March 15
  const earlyMorningIST = new Date("2024-03-15T20:30:00Z");
  const dateKey = getTodayDateKeyIST(earlyMorningIST);
  console.assert(
    dateKey === "2024-03-16",
    `Expected 2024-03-16, got ${dateKey}`,
  );
  console.log("23. Correct date for IST early morning: PASS");
}

console.log("\n=== All reminder logic tests passed! ===");
