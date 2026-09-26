import { describe, it, expect } from "vitest";
import { findNewlyMarkedCells, hasNewReachLine } from "@/lib/board-diff";
import type { CellPosition } from "@/lib/bingo-judge";
import type { BoardMarked } from "@/lib/bingo-board";

const BOARD_SIZE = 5;

function markedWith(cells: CellPosition[]): BoardMarked {
  const marked: BoardMarked = Array.from({ length: BOARD_SIZE }, () =>
    Array(BOARD_SIZE).fill(false)
  );
  for (const { col, row } of cells) {
    marked[col][row] = true;
  }
  return marked;
}

// row行目のうち、skipCol列だけを除いた4マス（＝その行がリーチ）
function rowExcept(row: number, skipCol: number): CellPosition[] {
  return Array.from({ length: BOARD_SIZE }, (_, col) => ({ col, row })).filter(
    ({ col }) => col !== skipCol
  );
}

describe("findNewlyMarkedCells", () => {
  it("変化がなければ空配列を返す", () => {
    const prev = markedWith([{ col: 2, row: 2 }]);
    const next = markedWith([{ col: 2, row: 2 }]);
    expect(findNewlyMarkedCells(prev, next)).toEqual([]);
  });

  it("前回false→今回trueのマスだけを返す", () => {
    const prev = markedWith([{ col: 2, row: 2 }]);
    const next = markedWith([
      { col: 2, row: 2 },
      { col: 0, row: 3 },
    ]);
    expect(findNewlyMarkedCells(prev, next)).toEqual(["0-3"]);
  });

  it("同時に複数マスが当たった場合はすべて返す", () => {
    const prev = markedWith([]);
    const next = markedWith([
      { col: 1, row: 0 },
      { col: 4, row: 4 },
    ]);
    expect(findNewlyMarkedCells(prev, next)).toEqual(["1-0", "4-4"]);
  });
});

describe("hasNewReachLine", () => {
  it("初回表示（prevがnull）でリーチLINEがあればtrue", () => {
    expect(hasNewReachLine(null, markedWith(rowExcept(0, 4)))).toBe(true);
  });

  it("初回表示（prevがnull）でリーチLINEがなければfalse", () => {
    expect(hasNewReachLine(null, markedWith([{ col: 2, row: 2 }]))).toBe(false);
  });

  it("同じリーチLINEが残っているだけならfalse", () => {
    const prev = markedWith(rowExcept(0, 4));
    const next = markedWith([...rowExcept(0, 4), { col: 2, row: 3 }]);
    expect(hasNewReachLine(prev, next)).toBe(false);
  });

  it("既存のリーチに加えて新しいリーチLINEができたらtrue", () => {
    const prev = markedWith(rowExcept(0, 4));
    const next = markedWith([...rowExcept(0, 4), ...rowExcept(3, 1)]);
    expect(hasNewReachLine(prev, next)).toBe(true);
  });

  it("ビンゴ成立（reachLinesが空になる）ならfalse", () => {
    const prev = markedWith(rowExcept(0, 4));
    const next = markedWith([...rowExcept(0, 4), { col: 4, row: 0 }]);
    expect(hasNewReachLine(prev, next)).toBe(false);
  });
});
