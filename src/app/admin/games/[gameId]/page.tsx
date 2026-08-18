"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import QrCode from "@/components/QrCode";

type GameStatus = "draft" | "open" | "playing" | "finished";

type UserEntry = {
  userId: string;
  userName: string;
};

type DrawEntry = {
  number: number;
  drawOrder: number;
};

type GameDetail = {
  id: string;
  title: string;
  maxBoards: number;
  boardCount: number;
  status: GameStatus;
  joinUrlToken: string;
  joinExpiresAt: string;
  createdAt: string;
  drawCount: number;
  lastDrawNumber: number | null;
  drawHistory: DrawEntry[];
  reachUsers: UserEntry[];
  bingoUsers: UserEntry[];
};

const TOTAL_NUMBERS = 75;

async function fetchGameDetail(
  gameId: string
): Promise<{ game?: GameDetail; error?: string }> {
  try {
    const res = await fetch(`/api/games/${gameId}`);
    const data = await res.json();
    if (!res.ok) {
      return { error: data.error?.message ?? "ゲーム情報の取得に失敗しました。" };
    }
    return { game: data as GameDetail };
  } catch {
    return { error: "通信エラーが発生しました。" };
  }
}

export default function AdminGamePage() {
  const params = useParams<{ gameId: string }>();
  const gameId = params.gameId;

  const [game, setGame] = useState<GameDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [finishing, setFinishing] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      const result = await fetchGameDetail(gameId);
      if (cancelled) {
        return;
      }
      if (result.error) {
        setError(result.error);
      } else {
        setGame(result.game ?? null);
      }
      setLoading(false);
    }

    async function run() {
      await refresh();
      if (cancelled) {
        return;
      }
      const channel = supabase
        .channel(`admin-game-${gameId}`)
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
            table: "boards",
            filter: `game_id=eq.${gameId}`,
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
      cleanupPromise.then((cleanup) => cleanup?.());
    };
  }, [gameId]);

  async function handleDraw() {
    setDrawing(true);
    setError(null);
    try {
      const res = await fetch(`/api/games/${gameId}/draws`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message ?? "抽選に失敗しました。");
        return;
      }
      const result = await fetchGameDetail(gameId);
      if (result.error) {
        setError(result.error);
      } else if (result.game) {
        setGame(result.game);
      }
    } catch {
      setError("通信エラーが発生しました。");
    } finally {
      setDrawing(false);
    }
  }

  async function handleFinish() {
    if (!window.confirm("ゲームを終了しますか？終了後は抽選できません。")) {
      return;
    }
    setFinishing(true);
    setError(null);
    try {
      const res = await fetch(`/api/games/${gameId}/finish`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message ?? "ゲームの終了に失敗しました。");
        return;
      }
      const result = await fetchGameDetail(gameId);
      if (result.error) {
        setError(result.error);
      } else if (result.game) {
        setGame(result.game);
      }
    } catch {
      setError("通信エラーが発生しました。");
    } finally {
      setFinishing(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-16">
        <p className="text-sm text-zinc-500">読み込み中...</p>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-16">
        <p className="text-sm text-red-600">
          {error ?? "ゲームが見つかりません。"}
        </p>
      </div>
    );
  }

  const joinUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/join/${game.joinUrlToken}`
      : `/join/${game.joinUrlToken}`;
  const isFinished = game.status === "finished";
  const isDrawExhausted = game.drawCount >= TOTAL_NUMBERS;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-10">
      <div>
        <h1 className="text-2xl font-semibold">{game.title}</h1>
        <p className="text-sm text-zinc-500">
          発行枚数: {game.boardCount} / {game.maxBoards}
        </p>
      </div>

      {isFinished && (
        <p className="rounded border border-black/10 bg-black/5 px-3 py-2 text-sm dark:border-white/15 dark:bg-white/5">
          このゲームは終了しました。
        </p>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="rounded-lg border border-black/10 p-6 text-center dark:border-white/15">
        <p className="text-sm text-zinc-500">直近の抽選番号</p>
        <p className="text-6xl font-bold tabular-nums">
          {game.lastDrawNumber ?? "-"}
        </p>
        <p className="mt-2 text-sm text-zinc-500">
          抽選回数: {game.drawCount} / {TOTAL_NUMBERS}
        </p>
        <button
          type="button"
          onClick={handleDraw}
          disabled={drawing || isFinished || isDrawExhausted}
          className="mt-4 w-full rounded bg-foreground px-4 py-2 text-background disabled:opacity-50"
        >
          {drawing ? "抽選中..." : "抽選する"}
        </button>
      </div>

      <div className="rounded-lg border border-black/10 p-4 dark:border-white/15">
        <h2 className="text-sm font-medium text-zinc-500">抽選履歴</h2>
        {game.drawHistory.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-400">まだありません</p>
        ) : (
          <ul className="mt-2 flex flex-wrap gap-2">
            {game.drawHistory.map((draw, index) => {
              const isLatest = index === game.drawHistory.length - 1;
              return (
                <li
                  key={draw.number}
                  className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold tabular-nums ${
                    isLatest
                      ? "bg-foreground text-background"
                      : "bg-black/5 dark:bg-white/10"
                  }`}
                >
                  {draw.number}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-black/10 p-4 dark:border-white/15">
          <h2 className="text-sm font-medium text-zinc-500">リーチ</h2>
          {game.reachUsers.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-400">まだいません</p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm">
              {game.reachUsers.map((user) => (
                <li key={user.userId}>{user.userName}</li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-lg border border-black/10 p-4 dark:border-white/15">
          <h2 className="text-sm font-medium text-zinc-500">ビンゴ</h2>
          {game.bingoUsers.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-400">まだいません</p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm">
              {game.bingoUsers.map((user) => (
                <li key={user.userId}>{user.userName}</li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-black/10 p-4 dark:border-white/15">
        <h2 className="text-sm font-medium text-zinc-500">参加用URL</h2>
        <p className="mt-1 break-all font-mono text-xs">{joinUrl}</p>
        <p className="mt-2 text-sm text-zinc-500">
          参加受付期限: {new Date(game.joinExpiresAt).toLocaleString("ja-JP")}
        </p>
        <div className="mt-3 flex justify-center">
          <QrCode value={joinUrl} />
        </div>
      </div>

      <button
        type="button"
        onClick={handleFinish}
        disabled={finishing || isFinished}
        className="w-full rounded border border-red-600 px-4 py-2 text-red-600 disabled:opacity-50"
      >
        {finishing ? "終了処理中..." : "ゲームを終了する"}
      </button>
    </div>
  );
}
