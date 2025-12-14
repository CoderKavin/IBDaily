-- Add onboarding step and rank preference to User
ALTER TABLE "User" ADD COLUMN "onboardingStep" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "showExactRank" BOOLEAN NOT NULL DEFAULT true;

-- Add quality fields to Submission
ALTER TABLE "Submission" ADD COLUMN "qualityStatus" TEXT NOT NULL DEFAULT 'GOOD';
ALTER TABLE "Submission" ADD COLUMN "qualityReasons" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "Submission" ADD COLUMN "feedbackHidden" BOOLEAN NOT NULL DEFAULT false;

-- Create NotificationPrefs table
CREATE TABLE "NotificationPrefs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "remindTimeMinutesBeforeCutoff" INTEGER NOT NULL DEFAULT 90,
    "lastCallMinutesBeforeCutoff" INTEGER NOT NULL DEFAULT 15,
    "quietHoursStart" INTEGER,
    "quietHoursEnd" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "NotificationPrefs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "NotificationPrefs_userId_key" ON "NotificationPrefs"("userId");

-- Create ReminderLog table
CREATE TABLE "ReminderLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "cohortId" TEXT NOT NULL,
    "dateKey" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "sentAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReminderLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ReminderLog_userId_cohortId_dateKey_type_key" ON "ReminderLog"("userId", "cohortId", "dateKey", "type");
CREATE INDEX "ReminderLog_dateKey_type_idx" ON "ReminderLog"("dateKey", "type");

-- Create AIFeedbackReport table
CREATE TABLE "AIFeedbackReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AIFeedbackReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AIFeedbackReport_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "AIFeedbackReport_submissionId_idx" ON "AIFeedbackReport"("submissionId");
CREATE INDEX "Submission_qualityStatus_idx" ON "Submission"("qualityStatus");
