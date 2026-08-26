import { describe, it, expect } from "vitest";
import { generateBoardNumbers, createInitialMarked } from "@/lib/bingo-board";

const COLUMN_RANGES: [number, number][] = [
  [1, 15],
  [16, 30],
  [31, 45],
  [46, 60],
  [61, 75],
];
const CENTER_COL = 2;
const CENTER_ROW = 2;

describe("generateBoardNumbers", () => {
  it("各列が対応する範囲の番号のみを含む", () => {
    const numbers = generateBoardNumbers();
    numbers.forEach((column, colIndex) => {
      const [min, max] = COLUMN_RANGES[colIndex];
      column.forEach((value) => {
        if (value === null) return;
        expect(value).toBeGreaterThanOrEqual(min);
        expect(value).toBeLessThanOrEqual(max);
      });
    });
  });

  it("各列内で番号が重複しない", () => {
    const numbers = generateBoardNumbers();
    numbers.forEach((column) => {
      const values = column.filter((v): v is number => v !== null);
      expect(new Set(values).size).toBe(values.length);
    });
  });

  it("中央(N列3行目)はFREE(null)", () => {
    const numbers = generateBoardNumbers();
    expect(numbers[CENTER_COL][CENTER_ROW]).toBeNull();
  });

  it("中央以外のマスは全て番号が入っている", () => {
    const numbers = generateBoardNumbers();
    numbers.forEach((column, colIndex) => {
      column.forEach((value, rowIndex) => {
        if (colIndex === CENTER_COL && rowIndex === CENTER_ROW) return;
        expect(value).not.toBeNull();
      });
    });
  });
});

describe("createInitialMarked", () => {
  it("中央のみtrue、他はすべてfalse", () => {
    const marked = createInitialMarked();
    marked.forEach((column, colIndex) => {
      column.forEach((value, rowIndex) => {
        const expected = colIndex === CENTER_COL && rowIndex === CENTER_ROW;
        expect(value).toBe(expected);
      });
    });
  });
});
