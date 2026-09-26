import { describe, it, expect } from "vitest";
import { createSeededRandom } from "@/lib/seeded-random";

function take(random: () => number, count: number): number[] {
  return Array.from({ length: count }, () => random());
}

describe("createSeededRandom", () => {
  it("同じシードからは同じ数列を生成する", () => {
    expect(take(createSeededRandom(20260922), 50)).toEqual(
      take(createSeededRandom(20260922), 50)
    );
  });

  it("異なるシードからは異なる数列を生成する", () => {
    expect(take(createSeededRandom(1), 10)).not.toEqual(
      take(createSeededRandom(2), 10)
    );
  });

  it("生成される値は常に0以上1未満", () => {
    for (const value of take(createSeededRandom(12345), 1000)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});
