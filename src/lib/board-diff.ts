import type { BoardMarked } from "@/lib/bingo-board";
import { judgeBingo, type BingoLine } from "@/lib/bingo-judge";

// リーチライン（セル座標の列）を比較可能な文字列キーに変換する。
// 「新たなリーチLINEができたか」を前回との差分で判定するために使う。
function reachLineKey(line: BingoLine): string {
  return line.map(({ col, row }) => `${col}-${row}`).join(",");
}

// 前回false→今回trueになったマスを "col-row" 形式のキーで返す。
// 参加者ボードで新規当選マスをフラッシュさせる対象の検出に使う。
export function findNewlyMarkedCells(
  prev: BoardMarked,
  next: BoardMarked
): string[] {
  const keys: string[] = [];
  next.forEach((column, col) => {
    column.forEach((isMarked, row) => {
      if (isMarked && !prev[col][row]) {
        keys.push(`${col}-${row}`);
      }
    });
  });
  return keys;
}

// 前回になかったリーチLINEが今回新たに増えたかを判定する（既存のリーチLINEが
// 残っているだけではfalse）。prevがnull＝初回表示の場合は比較対象がないので、
// リーチLINEが1本でもあればtrueとし、開いた時点で既にリーチでも演出を出す。
export function hasNewReachLine(
  prev: BoardMarked | null,
  next: BoardMarked
): boolean {
  const nextReachLines = judgeBingo(next).reachLines;
  if (!prev) {
    return nextReachLines.length > 0;
  }
  const prevReachKeys = new Set(judgeBingo(prev).reachLines.map(reachLineKey));
  return nextReachLines.some((line) => !prevReachKeys.has(reachLineKey(line)));
}
