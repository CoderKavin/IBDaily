import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();

async function seedSubjects() {
  console.log("Seeding subjects...");

  const subjectsPath = path.join(__dirname, "data", "subjects.json");
  const subjectsData = JSON.parse(fs.readFileSync(subjectsPath, "utf-8"));

  for (const subject of subjectsData) {
    await prisma.subject.upsert({
      where: { subjectCode: subject.subjectCode },
      update: subject,
      create: subject,
    });
  }

  console.log(`Seeded ${subjectsData.length} subjects`);
}

async function seedUnits() {
  console.log("Seeding units...");

  const unitsPath = path.join(__dirname, "data", "units.json");
  const unitsData = JSON.parse(fs.readFileSync(unitsPath, "utf-8"));

  let totalUnits = 0;

  for (const [subjectCode, units] of Object.entries(unitsData)) {
    const subject = await prisma.subject.findUnique({
      where: { subjectCode },
    });

    if (!subject) {
      console.warn(`Subject ${subjectCode} not found, skipping units`);
      continue;
    }

    for (const unit of units as Array<{
      name: string;
      orderIndex: number;
      levelScope: string;
    }>) {
      await prisma.unit.upsert({
        where: {
          subjectId_orderIndex: {
            subjectId: subject.id,
            orderIndex: unit.orderIndex,
          },
        },
        update: {
          name: unit.name,
          levelScope: unit.levelScope,
        },
        create: {
          subjectId: subject.id,
          name: unit.name,
          orderIndex: unit.orderIndex,
          levelScope: unit.levelScope,
        },
      });
      totalUnits++;
    }
  }

  console.log(`Seeded ${totalUnits} units`);
}

async function seedDemoData() {
  console.log("Seeding demo data...");

  // Create demo users
  const password1 = await bcrypt.hash("demo123", 10);
  const password2 = await bcrypt.hash("demo123", 10);

  const user1 = await prisma.user.upsert({
    where: { email: "alice@demo.com" },
    update: {},
    create: {
      email: "alice@demo.com",
      password: password1,
      name: "Alice Chen",
      onboardingCompleted: true,
    },
  });

  const user2 = await prisma.user.upsert({
    where: { email: "bob@demo.com" },
    update: {},
    create: {
      email: "bob@demo.com",
      password: password2,
      name: "Bob Smith",
      onboardingCompleted: true,
    },
  });

  console.log("Created users:", user1.email, user2.email);

  // Get some subjects for demo users
  const mathAA = await prisma.subject.findUnique({
    where: { subjectCode: "MATH_AA" },
  });
  const physics = await prisma.subject.findUnique({
    where: { subjectCode: "PHYSICS" },
  });
  const ess = await prisma.subject.findUnique({
    where: { subjectCode: "ESS" },
  });

  if (mathAA && physics) {
    // Alice takes Math AA HL and Physics HL
    await prisma.userSubject.upsert({
      where: { userId_subjectId: { userId: user1.id, subjectId: mathAA.id } },
      update: {},
      create: { userId: user1.id, subjectId: mathAA.id, level: "HL" },
    });
    await prisma.userSubject.upsert({
      where: { userId_subjectId: { userId: user1.id, subjectId: physics.id } },
      update: {},
      create: { userId: user1.id, subjectId: physics.id, level: "HL" },
    });

    // Bob takes Math AA SL and Physics SL
    await prisma.userSubject.upsert({
      where: { userId_subjectId: { userId: user2.id, subjectId: mathAA.id } },
      update: {},
      create: { userId: user2.id, subjectId: mathAA.id, level: "SL" },
    });
    await prisma.userSubject.upsert({
      where: { userId_subjectId: { userId: user2.id, subjectId: physics.id } },
      update: {},
      create: { userId: user2.id, subjectId: physics.id, level: "SL" },
    });
  }

  if (ess) {
    // Alice also takes ESS
    await prisma.userSubject.upsert({
      where: { userId_subjectId: { userId: user1.id, subjectId: ess.id } },
      update: {},
      create: { userId: user1.id, subjectId: ess.id, level: "SL" },
    });
  }

  // Create a demo cohort
  const cohort = await prisma.cohort.upsert({
    where: { joinCode: "DEMO01" },
    update: {},
    create: {
      name: "IB Class 2025",
      joinCode: "DEMO01",
    },
  });

  console.log("Created cohort:", cohort.name, "with code:", cohort.joinCode);

  // Add users to cohort
  await prisma.cohortMember.upsert({
    where: {
      userId_cohortId: { userId: user1.id, cohortId: cohort.id },
    },
    update: {},
    create: {
      userId: user1.id,
      cohortId: cohort.id,
    },
  });

  await prisma.cohortMember.upsert({
    where: {
      userId_cohortId: { userId: user2.id, cohortId: cohort.id },
    },
    update: {},
    create: {
      userId: user2.id,
      cohortId: cohort.id,
    },
  });

  console.log("Added users to cohort");

  // Create sample submissions for the past week
  const today = new Date();
  const submissions = [];

  for (let i = 1; i <= 7; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);

    // Format as YYYY-MM-DD in IST
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const dateKey = formatter.format(date);

    // Alice submits on-time every day (before 9 PM IST)
    const aliceSubmitTime = new Date(`${dateKey}T12:00:00+05:30`);

    submissions.push({
      userId: user1.id,
      cohortId: cohort.id,
      dateKey,
      subject: "Physics HL",
      subjectId: physics?.id || null,
      bullet1: `Day ${i}: Newton's laws describe motion and force relationships`,
      bullet2: `Day ${i}: F=ma is the fundamental equation of classical mechanics`,
      bullet3: `Day ${i}: Conservation of momentum applies to isolated systems`,
      createdAt: aliceSubmitTime,
    });

    // Bob submits on-time for some days, late for others, misses some
    if (i <= 5) {
      let bobSubmitTime: Date;
      if (i <= 3) {
        bobSubmitTime = new Date(`${dateKey}T18:00:00+05:30`);
      } else {
        bobSubmitTime = new Date(`${dateKey}T22:00:00+05:30`);
      }

      submissions.push({
        userId: user2.id,
        cohortId: cohort.id,
        dateKey,
        subject: "Mathematics AA SL",
        subjectId: mathAA?.id || null,
        bullet1: `Day ${i}: Derivatives measure instantaneous rate of change`,
        bullet2: `Day ${i}: Integration is the reverse process of differentiation`,
        bullet3: `Day ${i}: The fundamental theorem connects derivatives and integrals`,
        createdAt: bobSubmitTime,
      });
    }
  }

  // Upsert submissions
  for (const sub of submissions) {
    await prisma.submission.upsert({
      where: {
        userId_cohortId_dateKey: {
          userId: sub.userId,
          cohortId: sub.cohortId,
          dateKey: sub.dateKey,
        },
      },
      update: sub,
      create: sub,
    });
  }

  console.log(`Created ${submissions.length} sample submissions`);
}

async function main() {
  console.log("=== Starting Seed ===\n");

  await seedSubjects();
  await seedUnits();
  await seedDemoData();

  console.log("\n=== Seed Complete ===");
  console.log("\nDemo accounts:");
  console.log("  Email: alice@demo.com  Password: demo123");
  console.log("  Email: bob@demo.com    Password: demo123");
  console.log("\nDemo cohort join code: DEMO01");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
