"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { UserEntry } from "@/components/admin/UserListCard";
import type { DrawEntry } from "@/components/admin/DrawHistoryCard";

export type GameStatus = "draft" | "open" | "playing" | "finished";

export type GameDetail = {
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

// 管理者画面のゲーム状態の同期（初回取得＋Supabase Realtime購読）と、抽選・ゲーム終了の操作。
// 抽選中は演出が終わる（completeReveal が呼ばれる）まで最新状態の反映を保留し、結果を先に見せない。
export function useAdminGame(gameId: string): {
  game: GameDetail | null;
  loading: boolean;
  error: string | null;
  drawing: boolean;
  finishing: boolean;
  drawSeq: number;
  pendingNumber: number | null;
  draw: () => Promise<void>;
  completeReveal: () => void;
  finish: () => Promise<void>;
} {
  const [game, setGame] = useState<GameDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [finishing, setFinishing] = useState(false);
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

  async function draw() {
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

  const completeReveal = useCallback(() => {
    frozenRef.current = false;
    setDrawing(false);
    if (pendingGameRef.current) {
      setGame(pendingGameRef.current);
      pendingGameRef.current = null;
    }
  }, []);

  async function finish() {
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

  return {
    game,
    loading,
    error,
    drawing,
    finishing,
    drawSeq,
    pendingNumber,
    draw,
    completeReveal,
    finish,
  };
}
