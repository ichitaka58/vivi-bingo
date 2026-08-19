import type { BoardMarked } from "@/lib/bingo-board";

const BOARD_SIZE = 5;

export type CellPosition = { col: number; row: number };
export type BingoLine = CellPosition[];

// marked[列インデックス][行インデックス]。12ライン = 横5(行固定) + 縦5(列固定) + 斜め2。
function getLines(): BingoLine[] {
  const rows = Array.from({ length: BOARD_SIZE }, (_, row) =>
    Array.from({ length: BOARD_SIZE }, (_, col) => ({ col, row }))
  );
  const cols = Array.from({ length: BOARD_SIZE }, (_, col) =>
    Array.from({ length: BOARD_SIZE }, (_, row) => ({ col, row }))
  );
  const diagonalDown: BingoLine = Array.from({ length: BOARD_SIZE }, (_, i) => ({
    col: i,
    row: i,
  }));
  const diagonalUp: BingoLine = Array.from({ length: BOARD_SIZE }, (_, i) => ({
    col: i,
    row: BOARD_SIZE - 1 - i,
  }));
  return [...rows, ...cols, diagonalDown, diagonalUp];
}

function isMarked(marked: BoardMarked, line: BingoLine): boolean[] {
  return line.map(({ col, row }) => marked[col][row]);
}

export type BingoJudgeResult = {
  isBingo: boolean;
  isReach: boolean;
  /** ビンゴが成立している全ライン（複数同時成立もあり得る） */
  bingoLines: BingoLine[];
  /** リーチ状態の全ライン（isBingoがtrueの場合は空） */
  reachLines: BingoLine[];
};

export function judgeBingo(marked: BoardMarked): BingoJudgeResult {
  const lines = getLines();
  const bingoLines = lines.filter((line) =>
    isMarked(marked, line).every(Boolean)
  );
  const isBingo = bingoLines.length > 0;
  const reachLines = isBingo
    ? []
    : lines.filter(
        (line) =>
          isMarked(marked, line).filter(Boolean).length === BOARD_SIZE - 1
      );
  const isReach = reachLines.length > 0;
  return { isBingo, isReach, bingoLines, reachLines };
}
