-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Cohort" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "joinCode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'TRIAL',
    "trialEndsAt" DATETIME NOT NULL,
    "activatedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Cohort" ("activatedAt", "createdAt", "id", "joinCode", "name", "status", "trialEndsAt") SELECT "activatedAt", "createdAt", "id", "joinCode", "name", "status", "trialEndsAt" FROM "Cohort";
DROP TABLE "Cohort";
ALTER TABLE "new_Cohort" RENAME TO "Cohort";
CREATE UNIQUE INDEX "Cohort_joinCode_key" ON "Cohort"("joinCode");
CREATE TABLE "new_CohortMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "cohortId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bestStreak" INTEGER NOT NULL DEFAULT 0,
    "bestRank" INTEGER,
    CONSTRAINT "CohortMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CohortMember_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_CohortMember" ("cohortId", "id", "joinedAt", "role", "userId") SELECT "cohortId", "id", "joinedAt", "role", "userId" FROM "CohortMember";
DROP TABLE "CohortMember";
ALTER TABLE "new_CohortMember" RENAME TO "CohortMember";
CREATE UNIQUE INDEX "CohortMember_userId_cohortId_key" ON "CohortMember"("userId", "cohortId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
