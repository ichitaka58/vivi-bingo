"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

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

  useEffect(() => {
    let cancelled = false;
    const flashTimeouts = flashTimeoutsRef.current;

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

    async function run() {
      previousMarkedRef.current = null;
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

  useEffect(() => {
    const el = historyScrollRef.current;
    if (!el) {
      return;
    }
    el.scrollLeft = el.scrollWidth;
  }, [game?.drawHistory.length]);

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

      {(board.isReach || board.isBingo) && (
        <p className="text-center text-sm font-semibold">
          {board.isBingo ? "ビンゴ！" : "リーチ！"}
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
          return (
            <div
              key={key}
              className={`flex aspect-square items-center justify-center rounded text-lg font-semibold tabular-nums ${
                isFlashing
                  ? "animate-bingo-flash text-black"
                  : isMarked
                    ? "bg-foreground text-background"
                    : "border border-black/15 dark:border-white/20"
              }`}
            >
              {value === null ? "FREE" : value}
            </div>
          );
        })}
      </div>
    </div>
  );
}
