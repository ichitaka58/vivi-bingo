"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { judgeBingo } from "@/lib/bingo-judge";
import { fireBingoCelebration } from "@/lib/bingo-confetti";

type GameStatus = "draft" | "open" | "playing" | "finished";
type BoardNumbers = (number | null)[][];
type BoardMarked = boolean[][];

type DrawEntry = {
  number: number;
  drawOrder: number;
};

type Board = {
  boardId: string;
  gameId: string;
  userName: string;
  numbers: BoardNumbers;
  marked: BoardMarked;
  isReach: boolean;
  isBingo: boolean;
};

type GameSummary = {
  title: string;
  status: GameStatus;
  lastDrawNumber: number | null;
  drawHistory: DrawEntry[];
};

const COLUMN_LABELS = ["B", "I", "N", "G", "O"];
const BOARD_SIZE = 5;

async function fetchBoardAndGame(
  boardId: string
): Promise<{ board?: Board; game?: GameSummary; error?: string }> {
  try {
    const boardRes = await fetch(`/api/boards/${boardId}`);
    const boardData = await boardRes.json();
    if (!boardRes.ok) {
      return {
        error: boardData.error?.message ?? "ボード情報の取得に失敗しました。",
      };
    }

    const gameRes = await fetch(`/api/games/${boardData.gameId}`);
    const gameData = await gameRes.json();
    if (!gameRes.ok) {
      return {
        error: gameData.error?.message ?? "ゲーム情報の取得に失敗しました。",
      };
    }

    return { board: boardData as Board, game: gameData as GameSummary };
  } catch {
    return { error: "通信エラーが発生しました。" };
  }
}

export default function BoardPage() {
  const params = useParams<{ boardId: string }>();
  const boardId = params.boardId;

  const [board, setBoard] = useState<Board | null>(null);
  const [game, setGame] = useState<GameSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flashingCells, setFlashingCells] = useState<Set<string>>(new Set());
  const historyScrollRef = useRef<HTMLDivElement | null>(null);
  const previousMarkedRef = useRef<BoardMarked | null>(null);
  const flashTimeoutsRef = useRef<Set<ReturnType<typeof setTimeout>>>(
    new Set()
  );
  const bingoCelebratedRef = useRef(false); // このボードでクラッカー演出を発火済みか（1回だけ発火させるため）
  const confettiCancelRef = useRef<(() => void) | null>(null); // 発火中のクラッカー演出を止める関数

  // ボード/ゲーム情報の取得＋Supabase Realtime購読。
  // 新しく当たったマスを検出してflashingCellsに積み、3秒後に自動で外す（＝当選フラッシュ演出）。
  useEffect(() => {
    let cancelled = false;
    const flashTimeouts = flashTimeoutsRef.current;

    // ボード/ゲーム情報を取得し直し、前回との差分から新しく当たったマスを検出する
    async function refresh(): Promise<string | undefined> {
      const result = await fetchBoardAndGame(boardId);
      if (cancelled) {
        return undefined;
      }
      if (result.error || !result.board || !result.game) {
        setError(result.error ?? "ボードが見つかりません。");
        setLoading(false);
        return undefined;
      }

      // 初回取得時（prevMarked未設定）は比較対象がないのでフラッシュさせない。
      // 2回目以降の取得で「前回false→今回true」になったマスだけを新規当選とみなす。
      const prevMarked = previousMarkedRef.current;
      if (prevMarked) {
        const newlyMarkedKeys: string[] = [];
        for (let col = 0; col < BOARD_SIZE; col++) {
          for (let row = 0; row < BOARD_SIZE; row++) {
            if (result.board.marked[col][row] && !prevMarked[col][row]) {
              newlyMarkedKeys.push(`${col}-${row}`);
            }
          }
        }
        if (newlyMarkedKeys.length > 0) {
          // 新規当選マスをflashingCellsに追加してフラッシュ表示を開始し、
          // 3秒後にそれぞれ個別のタイマーで取り除く（＝フラッシュ終了→通常の当選マス表示へ）
          setFlashingCells((prev) => {
            const next = new Set(prev);
            newlyMarkedKeys.forEach((key) => next.add(key));
            return next;
          });
          newlyMarkedKeys.forEach((key) => {
            const timeoutId = setTimeout(() => {
              flashTimeouts.delete(timeoutId);
              if (cancelled) {
                return;
              }
              setFlashingCells((prev) => {
                const next = new Set(prev);
                next.delete(key);
                return next;
              });
            }, 3000);
            flashTimeouts.add(timeoutId);
          });
        }
      }
      previousMarkedRef.current = result.board.marked;

      setBoard(result.board);
      setGame(result.game);
      setLoading(false);
      return result.board.gameId;
    }

    // boardIdが変わるたびに演出関連の状態をリセットしてから初回取得し、
    // その後はboards/draws/gamesテーブルの変更をRealtimeで購読してrefresh()を呼び直す
    async function run() {
      previousMarkedRef.current = null;
      bingoCelebratedRef.current = false;
      setFlashingCells(new Set());
      const gameId = await refresh();
      if (cancelled || !gameId) {
        return;
      }
      const channel = supabase
        .channel(`board-${boardId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "boards",
            filter: `id=eq.${boardId}`,
          },
          () => {
            refresh();
          }
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "draws",
            filter: `game_id=eq.${gameId}`,
          },
          () => {
            refresh();
          }
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "games",
            filter: `id=eq.${gameId}`,
          },
          () => {
            refresh();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }

    const cleanupPromise = run();
    return () => {
      cancelled = true;
      flashTimeouts.forEach((timeoutId) => clearTimeout(timeoutId));
      flashTimeouts.clear();
      cleanupPromise.then((cleanup) => cleanup?.());
    };
  }, [boardId]);

  // 抽選履歴が増えるたびに横スクロールを右端（最新）まで動かす
  useEffect(() => {
    const el = historyScrollRef.current;
    if (!el) {
      return;
    }
    el.scrollLeft = el.scrollWidth;
  }, [game?.drawHistory.length]);

  // ビンゴ成立時にクラッカー演出を1回だけ発火する。
  // 当選フラッシュが残っている間（flashingCells.size > 0）は演出を待機し、
  // フラッシュが終わってから発火する（celebrationReadyと同じ考え方）
  useEffect(() => {
    if (!board?.isBingo || flashingCells.size > 0 || bingoCelebratedRef.current) {
      return;
    }
    bingoCelebratedRef.current = true;
    confettiCancelRef.current = fireBingoCelebration();
  }, [board?.isBingo, flashingCells.size]);

  // アンマウント時に発火中のクラッカー演出を止める
  useEffect(() => {
    return () => {
      confettiCancelRef.current?.();
    };
  }, []);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-16">
        <p className="text-sm text-zinc-500">読み込み中...</p>
      </div>
    );
  }

  if (!board || !game) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-16">
        <p className="text-sm text-red-600">
          {error ?? "ボードが見つかりません。"}
        </p>
      </div>
    );
  }

  const cells: { col: number; row: number }[] = [];
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      cells.push({ col, row });
    }
  }

  // 抽選直後のマスはまず当選フラッシュを最後まで見せてから、リーチ/ビンゴ演出を出す
  const celebrationReady = flashingCells.size === 0;
  // 現在のmarkedからリーチ/ビンゴになっているライン（セル座標）を算出し、
  // ハイライト対象のマスを「col-row」キーのSetにしておく（cells.map内で参照する）
  const judged = judgeBingo(board.marked);
  const reachCellKeys = new Set(
    judged.reachLines.flatMap((line) =>
      line.map(({ col, row }) => `${col}-${row}`)
    )
  );
  const bingoCellKeys = new Set(
    judged.bingoLines.flatMap((line) =>
      line.map(({ col, row }) => `${col}-${row}`)
    )
  );

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-10">
      <div>
        <h1 className="text-2xl font-semibold">{game.title}</h1>
        <p className="text-sm text-zinc-500">{board.userName} さんのボード</p>
      </div>

      {game.status === "finished" && (
        <p className="rounded border border-black/10 bg-black/5 px-3 py-2 text-sm dark:border-white/15 dark:bg-white/5">
          このゲームは終了しました。
        </p>
      )}

      {board.isReach && celebrationReady && (
        <p className="animate-reach-pop text-center text-2xl font-bold text-[#d97706]">
          リーチ！
        </p>
      )}
      {board.isBingo && celebrationReady && (
        <p className="animate-reach-pop text-center text-3xl font-bold text-[#d97706]">
          ビンゴ！
        </p>
      )}

      <div className="rounded-lg border border-black/10 p-4 text-center dark:border-white/15">
        <p className="text-sm text-zinc-500">直近の抽選番号</p>
        <p className="text-5xl font-bold tabular-nums">
          {game.lastDrawNumber ?? "-"}
        </p>
      </div>

      {game.drawHistory.length > 0 && (
        <div
          ref={historyScrollRef}
          className="flex gap-2 overflow-x-auto rounded-lg border border-black/10 p-3 dark:border-white/15"
        >
          {game.drawHistory.map((draw, index) => {
            const isLatest = index === game.drawHistory.length - 1;
            return (
              <div
                key={draw.number}
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold tabular-nums ${
                  isLatest
                    ? "bg-foreground text-background"
                    : "bg-black/5 dark:bg-white/10"
                }`}
              >
                {draw.number}
              </div>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-5 gap-1">
        {COLUMN_LABELS.map((label) => (
          <div
            key={label}
            className="flex aspect-square items-center justify-center text-4xl font-bold"
          >
            {label}
          </div>
        ))}
        {cells.map(({ col, row }) => {
          const value = board.numbers[col][row];
          const key = `${col}-${row}`;
          const isFlashing = flashingCells.has(key);
          const isMarked = board.marked[col][row];
          const isReachCell = celebrationReady && reachCellKeys.has(key);
          const isBingoCell = celebrationReady && bingoCellKeys.has(key);
          // 見た目の優先順位: フラッシュ中 > ビンゴライン > 通常の当選マス > 未当選マス
          // （リーチ用のring/glowはisReachCellの場合に追加で重ねる）
          return (
            <div
              key={key}
              className={`flex aspect-square items-center justify-center rounded text-lg font-semibold tabular-nums ${
                isFlashing
                  ? "animate-bingo-flash text-black"
                  : isBingoCell
                    ? "bingo-highlight animate-reach-pop"
                    : isMarked
                      ? "bg-foreground text-background"
                      : "border border-black/15 dark:border-white/20"
              } ${isReachCell ? "reach-highlight animate-reach-pop" : ""}`}
            >
              {value === null ? "FREE" : value}
            </div>
          );
        })}
      </div>
    </div>
  );
}
