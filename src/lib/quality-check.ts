/**
 * Submission quality check and low-effort detection
 */

export type QualityStatus = "GOOD" | "LOW_EFFORT";

export interface QualityCheckResult {
  status: QualityStatus;
  reasons: string[];
  validationErrors: string[];
}

// Filler phrases that indicate low effort
const FILLER_PHRASES = [
  "idk",
  "i don't know",
  "i dont know",
  "same as yesterday",
  "nothing",
  "nothing new",
  "n/a",
  "na",
  "none",
  "no idea",
  "whatever",
  "stuff",
  "things",
  "blah",
  "asdf",
  "test",
  "testing",
  "xxx",
  "abc",
  "123",
];

/**
 * Tokenize text for similarity comparison
 * Simple word-based tokenization, lowercase, remove punctuation
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2); // Ignore very short words
}

/**
 * Calculate Jaccard similarity between two token sets
 * Returns 0-1 where 1 is identical
 */
function jaccardSimilarity(tokens1: string[], tokens2: string[]): number {
  if (tokens1.length === 0 && tokens2.length === 0) return 1;
  if (tokens1.length === 0 || tokens2.length === 0) return 0;

  const set1 = new Set(tokens1);
  const set2 = new Set(tokens2);

  const intersection = new Set([...set1].filter((t) => set2.has(t)));
  const union = new Set([...set1, ...set2]);

  return intersection.size / union.size;
}

/**
 * Check if a bullet contains filler phrases
 */
function containsFillerPhrase(bullet: string): boolean {
  const lower = bullet.toLowerCase().trim();

  // Check exact match for short bullets
  if (FILLER_PHRASES.includes(lower)) {
    return true;
  }

  // Check if bullet is mostly a filler phrase
  for (const filler of FILLER_PHRASES) {
    if (lower === filler || lower.startsWith(filler + " ") || lower.endsWith(" " + filler)) {
      return true;
    }
  }

  return false;
}

/**
 * Validate submission bullets
 * Returns validation errors (blocking) - empty array means valid
 */
export function validateBullets(bullets: string[]): string[] {
  const errors: string[] = [];

  // Count non-empty bullets
  const nonEmptyBullets = bullets.filter((b) => b.trim().length > 0);

  if (nonEmptyBullets.length < 2) {
    errors.push("At least 2 bullets must be non-empty");
    return errors;
  }

  // Check length of non-empty bullets
  for (let i = 0; i < bullets.length; i++) {
    const bullet = bullets[i].trim();
    if (bullet.length > 0) {
      if (bullet.length < 20) {
        errors.push(`Bullet ${i + 1} must be at least 20 characters (currently ${bullet.length})`);
      }
      if (bullet.length > 140) {
        errors.push(`Bullet ${i + 1} must be at most 140 characters (currently ${bullet.length})`);
      }
    }
  }

  return errors;
}

/**
 * Check for low-effort submission (soft check, does not block)
 * Compares against yesterday's submission if provided
 */
export function checkLowEffort(
  bullets: string[],
  yesterdayBullets?: string[]
): { isLowEffort: boolean; reasons: string[] } {
  const reasons: string[] = [];

  // Check for filler phrases
  for (let i = 0; i < bullets.length; i++) {
    const bullet = bullets[i].trim();
    if (bullet.length > 0 && containsFillerPhrase(bullet)) {
      reasons.push(`Bullet ${i + 1} contains filler phrase`);
    }
  }

  // Check similarity to yesterday's submission
  if (yesterdayBullets && yesterdayBullets.length > 0) {
    const todayTokens = tokenize(bullets.join(" "));
    const yesterdayTokens = tokenize(yesterdayBullets.join(" "));

    const similarity = jaccardSimilarity(todayTokens, yesterdayTokens);

    // Threshold: 70% similarity is too similar
    if (similarity >= 0.7) {
      reasons.push(`Very similar to yesterday's submission (${Math.round(similarity * 100)}% overlap)`);
    }
  }

  // Check for repeated bullets within same submission
  const uniqueBullets = new Set(bullets.map((b) => b.toLowerCase().trim()).filter((b) => b.length > 0));
  const nonEmptyCount = bullets.filter((b) => b.trim().length > 0).length;
  if (uniqueBullets.size < nonEmptyCount) {
    reasons.push("Contains duplicate bullets");
  }

  return {
    isLowEffort: reasons.length > 0,
    reasons,
  };
}

/**
 * Full quality check for a submission
 */
export function checkSubmissionQuality(
  bullets: string[],
  yesterdayBullets?: string[]
): QualityCheckResult {
  const validationErrors = validateBullets(bullets);

  // If validation fails, return early
  if (validationErrors.length > 0) {
    return {
      status: "LOW_EFFORT",
      reasons: [],
      validationErrors,
    };
  }

  const { isLowEffort, reasons } = checkLowEffort(bullets, yesterdayBullets);

  return {
    status: isLowEffort ? "LOW_EFFORT" : "GOOD",
    reasons,
    validationErrors: [],
  };
}

/**
 * Get similarity score between two submissions (for testing)
 */
export function getSimilarityScore(bullets1: string[], bullets2: string[]): number {
  const tokens1 = tokenize(bullets1.join(" "));
  const tokens2 = tokenize(bullets2.join(" "));
  return jaccardSimilarity(tokens1, tokens2);
}
