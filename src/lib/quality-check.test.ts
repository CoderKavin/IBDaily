/**
 * Tests for quality check logic
 */

import {
  validateBullets,
  checkLowEffort,
  checkSubmissionQuality,
  getSimilarityScore,
} from "./quality-check";

console.log("=== Testing validateBullets ===\n");

// Test 1: Valid submission with 3 bullets
{
  const errors = validateBullets([
    "Newton's first law states that an object at rest stays at rest",
    "The second law defines force as mass times acceleration F=ma",
    "Third law: every action has an equal and opposite reaction",
  ]);
  console.assert(errors.length === 0, "Valid 3 bullets should pass");
  console.log("1. Valid 3 bullets: PASS");
}

// Test 2: Valid submission with 2 non-empty bullets
{
  const errors = validateBullets([
    "Conservation of momentum applies to isolated systems only",
    "Energy can neither be created nor destroyed, only transformed",
    "",
  ]);
  console.assert(errors.length === 0, "2 non-empty bullets should pass");
  console.log("2. Valid 2 non-empty bullets: PASS");
}

// Test 3: Invalid - only 1 non-empty bullet
{
  const errors = validateBullets([
    "This is the only bullet with content here",
    "",
    "",
  ]);
  console.assert(errors.length > 0, "Only 1 bullet should fail");
  console.assert(errors[0].includes("At least 2"), "Should mention 2 bullets required");
  console.log("3. Only 1 non-empty bullet fails: PASS");
}

// Test 4: Invalid - bullet too short
{
  const errors = validateBullets([
    "Too short",
    "This is a valid bullet with enough characters to pass",
    "Another valid bullet with sufficient length for the check",
  ]);
  console.assert(errors.length > 0, "Short bullet should fail");
  console.assert(errors[0].includes("at least 20"), "Should mention 20 char minimum");
  console.log("4. Bullet too short fails: PASS");
}

// Test 5: Invalid - bullet too long
{
  const longBullet = "x".repeat(150);
  const errors = validateBullets([
    longBullet,
    "This is a valid bullet with enough characters",
    "Another valid bullet with sufficient length",
  ]);
  console.assert(errors.length > 0, "Long bullet should fail");
  console.assert(errors[0].includes("at most 140"), "Should mention 140 char maximum");
  console.log("5. Bullet too long fails: PASS");
}

console.log("\n=== Testing checkLowEffort ===\n");

// Test 6: Filler phrase detection
{
  const result = checkLowEffort([
    "idk",
    "This is a valid bullet with real content",
    "Another bullet with actual learning content",
  ]);
  console.assert(result.isLowEffort === true, "Filler phrase should be low effort");
  console.assert(result.reasons.some(r => r.includes("filler")), "Should mention filler");
  console.log("6. Filler phrase detected: PASS");
}

// Test 7: Similar to yesterday detection
{
  const today = [
    "Newton's laws describe motion and forces",
    "F equals ma is the fundamental equation",
    "Momentum is conserved in closed systems",
  ];
  const yesterday = [
    "Newton's laws describe motion and forces",
    "F equals ma is the fundamental equation",
    "Momentum is conserved in closed systems",
  ];
  const result = checkLowEffort(today, yesterday);
  console.assert(result.isLowEffort === true, "Identical to yesterday should be low effort");
  console.assert(result.reasons.some(r => r.includes("similar")), "Should mention similarity");
  console.log("7. Identical to yesterday detected: PASS");
}

// Test 8: Different content is not low effort
{
  const today = [
    "Thermodynamics deals with heat and energy transfer",
    "Entropy always increases in isolated systems",
    "The Carnot cycle represents maximum efficiency",
  ];
  const yesterday = [
    "Newton's laws describe motion and forces",
    "F equals ma is the fundamental equation",
    "Momentum is conserved in closed systems",
  ];
  const result = checkLowEffort(today, yesterday);
  console.assert(result.isLowEffort === false, "Different content should be good");
  console.log("8. Different content is good: PASS");
}

// Test 9: Duplicate bullets within submission
{
  const result = checkLowEffort([
    "This is a concept about physics and motion",
    "This is a concept about physics and motion",
    "Another unique bullet about energy conservation",
  ]);
  console.assert(result.isLowEffort === true, "Duplicate bullets should be low effort");
  console.assert(result.reasons.some(r => r.includes("duplicate")), "Should mention duplicate");
  console.log("9. Duplicate bullets detected: PASS");
}

console.log("\n=== Testing getSimilarityScore ===\n");

// Test 10: Identical content = 1.0
{
  const bullets = ["Newton's first law of motion", "Force equals mass times acceleration"];
  const score = getSimilarityScore(bullets, bullets);
  console.assert(score === 1, `Identical should be 1.0, got ${score}`);
  console.log("10. Identical content score = 1.0: PASS");
}

// Test 11: Completely different content = low score
{
  const bullets1 = ["Photosynthesis converts sunlight to energy", "Plants use chlorophyll"];
  const bullets2 = ["Newton's laws of motion", "Force acceleration relationship"];
  const score = getSimilarityScore(bullets1, bullets2);
  console.assert(score < 0.3, `Different content should be < 0.3, got ${score}`);
  console.log("11. Different content low score: PASS");
}

// Test 12: Partial overlap = medium score
{
  const bullets1 = ["Newton's laws describe motion", "Force equals mass times acceleration"];
  const bullets2 = ["Newton's laws describe force", "Momentum equals mass times velocity"];
  const score = getSimilarityScore(bullets1, bullets2);
  console.assert(score > 0.3 && score < 0.8, `Partial overlap should be 0.3-0.8, got ${score}`);
  console.log("12. Partial overlap medium score: PASS");
}

console.log("\n=== Testing checkSubmissionQuality ===\n");

// Test 13: Full quality check - good submission
{
  const result = checkSubmissionQuality([
    "The derivative represents instantaneous rate of change",
    "Integration is the reverse process of differentiation",
    "The fundamental theorem connects derivatives and integrals",
  ]);
  console.assert(result.status === "GOOD", "Good submission should be GOOD");
  console.assert(result.validationErrors.length === 0, "No validation errors");
  console.assert(result.reasons.length === 0, "No low effort reasons");
  console.log("13. Good submission passes: PASS");
}

// Test 14: Full quality check - validation failure
{
  const result = checkSubmissionQuality(["short", "", ""]);
  console.assert(result.validationErrors.length > 0, "Should have validation errors");
  console.log("14. Validation failure caught: PASS");
}

// Test 15: Full quality check - low effort with filler
{
  const result = checkSubmissionQuality([
    "same as yesterday nothing new to add here",
    "The quadratic formula solves ax squared plus bx plus c",
    "Completing the square is an alternative method",
  ]);
  console.assert(result.status === "LOW_EFFORT", "Filler should be low effort");
  console.assert(result.reasons.length > 0, "Should have low effort reasons");
  console.log("15. Low effort with filler detected: PASS");
}

console.log("\n=== All quality check tests passed! ===");
