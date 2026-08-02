/**
 * Maps a Decipher score to a letter grade.
 *
 * The input is on the DISPLAY scale (0..100), not the stored 0..1 scale.
 * `merchants.rankerScore` holds e.g. 0.6412 — passing that raw returns "F" for
 * every merchant in the catalog. Convert first (the dashboard uses
 * `toDisplayScore`; the preview route rounds inline).
 *
 * Shared by the public preview endpoint and the dashboard so the two surfaces
 * can never disagree about a merchant's grade.
 */
export function scoreToGrade(score: number): string {
  if (score >= 90) return "A+";
  if (score >= 80) return "A";
  if (score >= 70) return "B+";
  if (score >= 60) return "B";
  if (score >= 50) return "C+";
  if (score >= 40) return "C";
  if (score >= 30) return "D";
  return "F";
}
