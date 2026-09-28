"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import RouletteDraw from "@/components/RouletteDraw";
import ConfirmDialog from "@/components/ConfirmDialog";
import UserListCard, { type UserEntry } from "@/components/admin/UserListCard";
import DrawHistoryCard, {
  type DrawEntry,
} from "@/components/admin/DrawHistoryCard";
import JoinUrlCard from "@/components/admin/JoinUrlCard";

type GameStatus = "draft" | "open" | "playing" | "finished";

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
  const [confirmingFinish, setConfirmingFinish] = useState(false);
  const [drawSeq, setDrawSeq] = useState(0);
  const [pendingNumber, setPendingNumber] = useState<number | null>(null);
  const frozenRef = useRef(false);
  const pendingGameRef = useRef<GameDetail | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      const result = await fetchGameDetail(gameId);
      if (cancelled) {
        return;
      }
      if (result.error) {
        setError(result.error);
      } else if (result.game) {
        if (frozenRef.current) {
          pendingGameRef.current = result.game;
        } else {
          setGame(result.game);
        }
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
    frozenRef.current = true;
    pendingGameRef.current = null;

    let number: number;
    try {
      const res = await fetch(`/api/games/${gameId}/draws`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message ?? "抽選に失敗しました。");
        frozenRef.current = false;
        setDrawing(false);
        return;
      }
      number = data.number as number;
    } catch {
      setError("通信エラーが発生しました。");
      frozenRef.current = false;
      setDrawing(false);
      return;
    }

    // 番号が取れたら演出を開始する。最新のゲーム状態は裏で取得しておき、
    // 演出が終わるまで(frozenRef)画面への反映を保留して結果を先に見せない。
    setPendingNumber(number);
    setDrawSeq((n) => n + 1);

    const result = await fetchGameDetail(gameId);
    if (result.error) {
      setError(result.error);
    } else if (result.game) {
      pendingGameRef.current = result.game;
    }
  }

  const handleRevealComplete = useCallback(() => {
    frozenRef.current = false;
    setDrawing(false);
    if (pendingGameRef.current) {
      setGame(pendingGameRef.current);
      pendingGameRef.current = null;
    }
  }, []);

  async function handleFinish() {
    setConfirmingFinish(false);
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
      <div className="flex flex-1 items-center justify-center bg-matsuri-cream px-4 py-16 font-round">
        <p className="text-sm text-matsuri-purple">読み込み中...</p>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="flex flex-1 items-center justify-center bg-matsuri-cream px-4 py-16 font-round">
        <p className="text-sm text-matsuri-red">
          {error ?? "ゲームが見つかりません。"}
        </p>
      </div>
    );
  }

  const isFinished = game.status === "finished";
  const isDrawExhausted = game.drawCount >= TOTAL_NUMBERS;

  return (
    <div className="flex w-full flex-1 flex-col bg-matsuri-cream font-round text-matsuri-navy">
      <div className="admin-banner flex flex-wrap items-start justify-between gap-4 px-6 py-5 sm:px-9 sm:py-6">
        <div className="flex flex-col gap-2">
          <Link
            href="/admin"
            className="inline-flex w-fit items-center gap-1 font-heading text-xs font-bold text-matsuri-cream-soft underline underline-offset-2"
          >
            ← ゲーム一覧
          </Link>
          <span className="inline-flex w-fit rounded-full bg-white px-3 py-1 font-heading text-xs font-bold tracking-wide text-matsuri-red">
            BINGO PARTY
          </span>
          <h1 className="font-heading text-2xl font-extrabold text-matsuri-cream-soft sm:text-[28px]">
            {game.title}
          </h1>
          <p className="text-sm font-bold text-matsuri-border-gold">
            発行枚数 {game.boardCount} / {game.maxBoards}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setConfirmingFinish(true)}
          disabled={finishing || isFinished}
          className="cursor-pointer self-start rounded-full border-[1.5px] border-matsuri-cream-soft px-5 py-2.5 font-heading text-[13px] font-bold text-matsuri-cream-soft disabled:cursor-not-allowed disabled:opacity-50"
        >
          {finishing ? "終了処理中..." : "ゲームを終了する"}
        </button>
      </div>

      <ConfirmDialog
        open={confirmingFinish}
        emoji="🏁"
        title="ゲームを終了しますか？"
        message="終了すると、以降の抽選ができなくなります。この操作は取り消せません。"
        confirmLabel="終了する"
        cancelLabel="キャンセル"
        confirmDisabled={finishing}
        onConfirm={handleFinish}
        onCancel={() => setConfirmingFinish(false)}
      />

      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-6 py-6 sm:px-9">
        {isFinished && (
          <p className="rounded-lg border-2 border-matsuri-border-gold bg-white px-3 py-2 text-sm font-bold">
            このゲームは終了しました。
          </p>
        )}

        {error && <p className="text-sm font-bold text-matsuri-red">{error}</p>}

        <div className="grid grid-cols-1 gap-4.5 lg:grid-cols-[1.2fr_1fr]">
          <div className="flex flex-col gap-5">
            <div className="rounded-2xl border-[1.5px] border-matsuri-border-calm bg-white px-5 py-4.5">
              <p className="font-heading text-2xl font-bold">直近の抽選番号</p>

              <div className="mt-2.5 flex items-start justify-center gap-5">
                <div className="mt-2.5 text-center">
                  <RouletteDraw
                    drawSeq={drawSeq}
                    targetNumber={pendingNumber}
                    idleNumber={game.lastDrawNumber}
                    onRevealComplete={handleRevealComplete}
                  />
                  <p className="mt-1.5 text-sm font-bold text-matsuri-muted">
                    抽選回数 {game.drawCount} / {TOTAL_NUMBERS}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleDraw}
                  disabled={drawing || isFinished || isDrawExhausted}
                  className="admin-draw-btn flex h-23 w-23 shrink-0 items-center justify-center rounded-full font-heading text-[17px] font-extrabold text-matsuri-cream-soft disabled:opacity-50"
                >
                  {drawing ? "抽選中" : "抽選"}
                </button>
              </div>
            </div>

            <DrawHistoryCard draws={game.drawHistory} />
          </div>

          <div className="flex flex-col gap-5">
            <UserListCard title="リーチ" users={game.reachUsers} />
            <UserListCard
              title="ビンゴ"
              users={game.bingoUsers}
              avatarVariant="gold"
            />

            <JoinUrlCard
              joinUrlToken={game.joinUrlToken}
              joinExpiresAt={game.joinExpiresAt}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
