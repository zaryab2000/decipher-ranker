import { describe, it, expect } from "vitest";
import { scoreToGrade } from "@/lib/analytics/grade";

describe("scoreToGrade", () => {
  it("maps each boundary to the correct grade", () => {
    const boundaries: [number, string][] = [
      [100, "A+"],
      [90, "A+"],
      [89, "A"],
      [80, "A"],
      [79, "B+"],
      [70, "B+"],
      [69, "B"],
      [60, "B"],
      [59, "C+"],
      [50, "C+"],
      [49, "C"],
      [40, "C"],
      [39, "D"],
      [30, "D"],
      [29, "F"],
      [0, "F"],
    ];

    for (const [score, expected] of boundaries) {
      expect(scoreToGrade(score), `score ${score}`).toBe(expected);
    }
  });

  it("grades a raw 0..1 score as F — callers must convert to display scale first", () => {
    // Guards the mistake §4.6 warns about: passing merchants.rankerScore
    // straight through returns "F" for the entire catalog.
    expect(scoreToGrade(0.64)).toBe("F");
    expect(scoreToGrade(64)).toBe("B");
  });
});
