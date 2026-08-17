import type { BoardMarked } from "@/lib/bingo-board";

const BOARD_SIZE = 5;

// marked[列インデックス][行インデックス]。12ライン = 横5(行固定) + 縦5(列固定) + 斜め2。
function getLines(marked: BoardMarked): boolean[][] {
  const rows = Array.from({ length: BOARD_SIZE }, (_, row) =>
    Array.from({ length: BOARD_SIZE }, (_, col) => marked[col][row])
  );
  const cols = marked;
  const diagonalDown = Array.from(
    { length: BOARD_SIZE },
    (_, i) => marked[i][i]
  );
  const diagonalUp = Array.from(
    { length: BOARD_SIZE },
    (_, i) => marked[i][BOARD_SIZE - 1 - i]
  );
  return [...rows, ...cols, diagonalDown, diagonalUp];
}

export type BingoJudgeResult = {
  isBingo: boolean;
  isReach: boolean;
};

export function judgeBingo(marked: BoardMarked): BingoJudgeResult {
  const lines = getLines(marked);
  const isBingo = lines.some((line) => line.every(Boolean));
  const isReach =
    !isBingo &&
    lines.some((line) => line.filter(Boolean).length === BOARD_SIZE - 1);
  return { isBingo, isReach };
}
