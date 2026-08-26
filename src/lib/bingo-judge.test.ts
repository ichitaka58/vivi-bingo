import { describe, it, expect } from "vitest";
import { judgeBingo, type CellPosition } from "@/lib/bingo-judge";
import type { BoardMarked } from "@/lib/bingo-board";

const BOARD_SIZE = 5;

function emptyMarked(): BoardMarked {
  return Array.from({ length: BOARD_SIZE }, () =>
    Array(BOARD_SIZE).fill(false)
  );
}

function markCells(marked: BoardMarked, cells: CellPosition[]): void {
  for (const { col, row } of cells) {
    marked[col][row] = true;
  }
}

function rowLine(row: number): CellPosition[] {
  return Array.from({ length: BOARD_SIZE }, (_, col) => ({ col, row }));
}

function colLine(col: number): CellPosition[] {
  return Array.from({ length: BOARD_SIZE }, (_, row) => ({ col, row }));
}

const diagonalDown: CellPosition[] = Array.from(
  { length: BOARD_SIZE },
  (_, i) => ({ col: i, row: i })
);
const diagonalUp: CellPosition[] = Array.from(
  { length: BOARD_SIZE },
  (_, i) => ({ col: i, row: BOARD_SIZE - 1 - i })
);

const allLines: { name: string; cells: CellPosition[] }[] = [
  ...Array.from({ length: BOARD_SIZE }, (_, row) => ({
    name: `row${row}`,
    cells: rowLine(row),
  })),
  ...Array.from({ length: BOARD_SIZE }, (_, col) => ({
    name: `col${col}`,
    cells: colLine(col),
  })),
  { name: "diagonalDown", cells: diagonalDown },
  { name: "diagonalUp", cells: diagonalUp },
];

function sortCells(cells: CellPosition[]): CellPosition[] {
  return [...cells].sort((a, b) => a.col - b.col || a.row - b.row);
}

function expectSameLine(actual: CellPosition[], expected: CellPosition[]) {
  expect(sortCells(actual)).toEqual(sortCells(expected));
}

describe("judgeBingo", () => {
  it("何もマークされていない場合は未成立", () => {
    const result = judgeBingo(emptyMarked());
    expect(result.isBingo).toBe(false);
    expect(result.isReach).toBe(false);
    expect(result.bingoLines).toHaveLength(0);
    expect(result.reachLines).toHaveLength(0);
  });

  describe.each(allLines)("$name", ({ cells }) => {
    it("4/5マークでリーチになる", () => {
      const marked = emptyMarked();
      markCells(marked, cells.slice(0, BOARD_SIZE - 1));
      const result = judgeBingo(marked);
      expect(result.isReach).toBe(true);
      expect(result.isBingo).toBe(false);
      expect(result.reachLines).toHaveLength(1);
      expectSameLine(result.reachLines[0], cells);
    });

    it("5/5マークでビンゴになる", () => {
      const marked = emptyMarked();
      markCells(marked, cells);
      const result = judgeBingo(marked);
      expect(result.isBingo).toBe(true);
      expect(result.isReach).toBe(false);
      expect(result.bingoLines).toHaveLength(1);
      expectSameLine(result.bingoLines[0], cells);
    });
  });

  it("複数ラインが同時にビンゴ成立する", () => {
    const marked = emptyMarked();
    markCells(marked, rowLine(0));
    markCells(marked, colLine(0));
    const result = judgeBingo(marked);
    expect(result.isBingo).toBe(true);
    expect(result.bingoLines).toHaveLength(2);
  });
});
