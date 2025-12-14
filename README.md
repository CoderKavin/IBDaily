# IBDaily

A minimal web app to enforce daily IB concept summaries with streak tracking, class leaderboards, and AI-generated practice questions.

## Features

- Login/signup with email and password
- **Subject onboarding**: Select your IB subjects with SL/HL levels
- Create or join class cohorts with join codes
- Daily submission: select subject + 3 bullet points (max 140 chars each)
- Deadline: 9:00 PM IST daily
- Personal streak counter (consecutive on-time days)
- 30-day calendar grid showing On-time / Late / Missed
- Class leaderboard ranked by streak
- **Weekly unit selection** for Math AA, Physics, ESS
- **AI-generated practice questions** aligned to your weekly unit focus

## Tech Stack

- Next.js 16 (App Router) + TypeScript
- Tailwind CSS
- SQLite + Prisma ORM
- NextAuth (credentials provider)
- Timezone: Asia/Kolkata (IST)

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Set up the database
npx prisma migrate dev

# 3. Seed subjects, units, and demo data
npm run db:seed

# 4. Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## AI Features (Optional)

To enable AI-generated practice questions, add one of these to your `.env`:

```
OPENAI_API_KEY=your-openai-api-key
# or
ANTHROPIC_API_KEY=your-anthropic-api-key
```

The app works fully without AI - question generation is optional.

## Demo Accounts

After running `npm run db:seed`:

| Email | Password | Notes |
|-------|----------|-------|
| alice@demo.com | demo123 | Has Math AA HL, Physics HL, ESS SL |
| bob@demo.com | demo123 | Has Math AA SL, Physics SL |

**Demo cohort join code:** `DEMO01`

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run db:migrate` | Run Prisma migrations |
| `npm run db:seed` | Seed subjects, units, and demo data |
| `npm run db:reset` | Reset database |
| `npm run test:tz` | Run timezone utility tests |

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── auth/[...nextauth]/  # NextAuth handlers
│   │   ├── cohort/              # Create/join cohorts
│   │   ├── daily-question/      # AI question generation
│   │   ├── leaderboard/         # Class rankings
│   │   ├── me/                  # Personal progress
│   │   ├── signup/              # User registration
│   │   ├── subjects/            # IB subject catalog
│   │   ├── submission/          # Daily submissions
│   │   ├── units/               # Subject units
│   │   ├── user-subjects/       # User's subject selections
│   │   └── weekly-unit/         # Weekly unit selection
│   ├── auth/                    # Login/signup page
│   ├── cohort/                  # Cohort selection page
│   ├── leaderboard/             # Class leaderboard page
│   ├── me/                      # Personal progress page
│   ├── onboarding/              # Subject selection page
│   ├── submit/                  # Daily submission + questions
│   └── units/                   # Weekly unit selection page
├── components/
│   └── Nav.tsx                  # Navigation bar
├── lib/
│   ├── ai-client.ts             # AI provider interface
│   ├── auth.ts                  # NextAuth configuration
│   ├── prisma.ts                # Prisma client
│   ├── streak.ts                # Streak/calendar/leaderboard logic
│   ├── timezone.ts              # IST timezone utilities
│   └── timezone.test.ts         # Timezone unit tests
└── types/
    └── next-auth.d.ts           # NextAuth type extensions

prisma/
├── schema.prisma                # Database schema
├── seed.ts                      # Demo data seeder
├── data/
│   ├── subjects.json            # Official IB subjects
│   └── units.json               # Predefined units
└── migrations/                  # Database migrations
```

## Data Model

```
User
├── id, email, password, name, onboardingCompleted, createdAt
├── cohortMembers[], submissions[], userSubjects[]
├── weeklyUnitSelections[], dailyQuestions[]

Subject (IB subject catalog)
├── id, subjectCode, transcriptName, fullName
├── groupName, groupNumber, slAvailable, hlAvailable, hasUnits
├── units[], userSubjects[], weeklyUnitSelections[], dailyQuestions[]

Unit (predefined units for select subjects)
├── id, subjectId, name, orderIndex, levelScope (BOTH/SL_ONLY/HL_ONLY)

UserSubject (user's selected subjects)
├── id, userId, subjectId, level (SL/HL)

WeeklyUnitSelection
├── id, userId, subjectId, unitId, weekStartDateKey (Monday in IST)

DailyQuestion (AI-generated)
├── id, userId, cohortId, dateKey, subjectId, level, unitId
├── difficultyRung (1=Recall, 2=Application, 3=Exam-style)
├── questionText, markingGuideText, commonMistakesText

Cohort, CohortMember, Submission (unchanged from v1)
```

## Seeded Subjects with Units

| Subject | Units |
|---------|-------|
| Mathematics: Analysis and Approaches | Number & Algebra, Functions, Geometry & Trigonometry, Statistics & Probability, Calculus |
| Physics | Mechanics, Thermal Physics, Waves & Optics, Electricity & Magnetism, Modern Physics |
| Environmental Systems and Societies | Foundations, Ecology, Biodiversity & Conservation, Water, Land, Atmosphere & Climate Change, Natural Resources, Human Populations & Urban Systems |

## Timezone Logic

All calculations use Asia/Kolkata (IST):

- **Deadline**: 21:00 IST daily
- **Week start**: Monday in IST
- **On-time**: submission.createdAt <= 21:00 IST on dateKey
- **Weekly unit change**: allowed once per week (Monday-Sunday)

## AI Safety

The AI acts as a **coach, not an examiner**:
- Avoids claiming certainty
- Frames guidance as suggestions ("consider whether...", "you might check if...")
- Provides marking guide and common mistakes as questions to ask yourself
- Acknowledges multiple valid approaches

## Leaderboard Ranking

1. Current streak (descending)
2. On-time submissions in last 30 days (descending)
3. Earliest latest submission time (ascending)

**Important**: Streak and rank depend ONLY on on-time submission, not subject/unit/question performance.

## Environment Variables

```
DATABASE_URL="file:./dev.db"
NEXTAUTH_SECRET="your-secret-here"
NEXTAUTH_URL="http://localhost:3000"

# Optional - for AI question generation
OPENAI_API_KEY=your-openai-api-key
# or
ANTHROPIC_API_KEY=your-anthropic-api-key
```

## Pages

| Route | Description |
|-------|-------------|
| `/auth` | Login/signup |
| `/onboarding` | Select IB subjects (first-time setup) |
| `/cohort` | Create/join/select cohort |
| `/submit` | Daily submission + AI questions |
| `/units` | Weekly unit selection |
| `/me` | Streak + 30-day calendar |
| `/leaderboard` | Class rankings |

## License

MIT
