const BOARD_SIZE = 5;
const CENTER_COL = 2;
const CENTER_ROW = 2;

// 列ごとの番号範囲（B:1-15 / I:16-30 / N:31-45 / G:46-60 / O:61-75）
const COLUMN_RANGES: [number, number][] = [
  [1, 15],
  [16, 30],
  [31, 45],
  [46, 60],
  [61, 75],
];

export type BoardNumbers = (number | null)[][];
export type BoardMarked = boolean[][];

function shuffledRange(min: number, max: number): number[] {
  const pool = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool;
}

// numbers[列インデックス][行インデックス]。中央(N列3行目)はFREEでnull。
export function generateBoardNumbers(): BoardNumbers {
  return COLUMN_RANGES.map(([min, max], colIndex) => {
    if (colIndex === CENTER_COL) {
      const picked: (number | null)[] = shuffledRange(min, max).slice(
        0,
        BOARD_SIZE - 1
      );
      picked.splice(CENTER_ROW, 0, null);
      return picked;
    }
    return shuffledRange(min, max).slice(0, BOARD_SIZE);
  });
}

// numbersと同じ形状。FREEマス(中央)のみ初期値true。
export function createInitialMarked(): BoardMarked {
  return Array.from({ length: BOARD_SIZE }, (_, colIndex) =>
    Array.from(
      { length: BOARD_SIZE },
      (_, rowIndex) => colIndex === CENTER_COL && rowIndex === CENTER_ROW
    )
  );
}
