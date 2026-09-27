"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { BoardMarked, BoardNumbers } from "@/lib/bingo-board";
import { findNewlyMarkedCells, hasNewReachLine } from "@/lib/board-diff";
import type { DrawEntry } from "@/components/DrawHistory";

export type GameStatus = "draft" | "open" | "playing" | "finished";

export type Board = {
  boardId: string;
  gameId: string;
  userName: string;
  numbers: BoardNumbers;
  marked: BoardMarked;
  isReach: boolean;
  isBingo: boolean;
};

export type GameSummary = {
  title: string;
  status: GameStatus;
  lastDrawNumber: number | null;
  drawHistory: DrawEntry[];
};

// 抽選番号が増えたときの最初の反映を、管理者側の抽選演出とタイミングを合わせるために
// この時間だけ保留してから画面へ反映する（ルーレット演出が ≈3.3s のため、余裕をみて少し長めに設定）。
const REVEAL_HOLD_MS = 4000;

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

// 参加者ボードのデータ同期（初回取得＋Supabase Realtime購読＋抽選番号の反映保留）。
// 新しく当たったマスを検出してflashingCellsに積み、3秒後に自動で外す（＝当選フラッシュ演出）。
// 新しいリーチLINEの発生はフラッシュ終了を待ってreachAnimKeyの増加として返す（＝リーチ演出の再生合図）。
export function useBoardSync(boardId: string): {
  board: Board | null;
  game: GameSummary | null;
  loading: boolean;
  error: string | null;
  flashingCells: Set<string>;
  reachAnimKey: number;
} {
  const [board, setBoard] = useState<Board | null>(null);
  const [game, setGame] = useState<GameSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flashingCells, setFlashingCells] = useState<Set<string>>(new Set());
  const previousMarkedRef = useRef<BoardMarked | null>(null);
  const flashTimeoutsRef = useRef<Set<ReturnType<typeof setTimeout>>>(
    new Set()
  );
  // 抽選番号の反映保留（Bug対応: 管理者の演出より先に参加者へネタバレしないようにする）。
  //   displayedDrawCountRef: 現在画面に反映済みの抽選回数（drawHistory の件数）
  //   revealHoldRef: 保留中フラグ / revealHoldTimerRef: 保留解除タイマー
  //   pendingUpdateRef: 保留中に取得した最新のボード/ゲーム（解除時にまとめて反映する）
  const displayedDrawCountRef = useRef<number | null>(null);
  const revealHoldRef = useRef(false);
  const revealHoldTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingUpdateRef = useRef<{ board: Board; game: GameSummary } | null>(
    null
  );
  // リーチ演出（バナー/金魚/音声）を新たなリーチLINEの発生ごとに再生するための状態。
  // pendingNewReachLine: 前回取得時からリーチLINEが増えた（まだ演出未消化）ことを示すフラグ
  // reachAnimKey: 演出を再生した回数。バナー/金魚のkeyに使い、増分のたびに新規DOM要素として再マウントさせる
  const [pendingNewReachLine, setPendingNewReachLine] = useState(false);
  const [reachAnimKey, setReachAnimKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const flashTimeouts = flashTimeoutsRef.current;

    // 取得したボード/ゲームを実際に画面へ反映する。前回表示との差分から
    // 新しく当たったマス（フラッシュ）と新規リーチLINE（リーチ演出）を検出する。
    function applyUpdate(nextBoard: Board, nextGame: GameSummary) {
      // 初回反映時（prevMarked未設定）は比較対象がないのでフラッシュさせない。
      // 2回目以降で「前回false→今回true」になったマスだけを新規当選とみなす。
      const prevMarked = previousMarkedRef.current;
      if (prevMarked) {
        const newlyMarkedKeys = findNewlyMarkedCells(
          prevMarked,
          nextBoard.marked
        );
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
      // 前回になかったリーチLINEが新たに増えていたら、リーチ演出（バナー/金魚）を
      // 再生対象としてマークする（初回反映時点で既にリーチ状態だった場合も表示する）
      if (hasNewReachLine(prevMarked, nextBoard.marked)) {
        setPendingNewReachLine(true);
      }
      previousMarkedRef.current = nextBoard.marked;

      setBoard(nextBoard);
      setGame(nextGame);
      setLoading(false);
      displayedDrawCountRef.current = nextGame.drawHistory.length;
    }

    // ボード/ゲーム情報を取得し直す。抽選番号が増えた最初の反映だけは、
    // 管理者の抽選演出より先にネタバレしないよう REVEAL_HOLD_MS だけ保留してから applyUpdate する。
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
      const gameId = result.board.gameId;

      // 既に保留中なら、最新データだけ差し替えてタイマー満了を待つ
      if (revealHoldRef.current) {
        pendingUpdateRef.current = { board: result.board, game: result.game };
        return gameId;
      }

      // 初回反映（displayedDrawCountRef 未設定）は保留しない。
      // 以降、抽選回数が増えていたら「新しい抽選の反映」とみなして保留する。
      const displayedDrawCount = displayedDrawCountRef.current;
      const hasNewDraw =
        displayedDrawCount !== null &&
        result.game.drawHistory.length > displayedDrawCount;

      if (hasNewDraw) {
        revealHoldRef.current = true;
        pendingUpdateRef.current = { board: result.board, game: result.game };
        revealHoldTimerRef.current = setTimeout(() => {
          revealHoldTimerRef.current = null;
          revealHoldRef.current = false;
          const pending = pendingUpdateRef.current;
          pendingUpdateRef.current = null;
          if (cancelled || !pending) {
            return;
          }
          applyUpdate(pending.board, pending.game);
        }, REVEAL_HOLD_MS);
        return gameId;
      }

      applyUpdate(result.board, result.game);
      return gameId;
    }

    // boardIdが変わるたびに演出関連の状態をリセットしてから初回取得し、
    // その後はboards/draws/gamesテーブルの変更をRealtimeで購読してrefresh()を呼び直す
    async function run() {
      previousMarkedRef.current = null;
      setPendingNewReachLine(false);
      setReachAnimKey(0);
      setFlashingCells(new Set());
      displayedDrawCountRef.current = null;
      revealHoldRef.current = false;
      pendingUpdateRef.current = null;
      if (revealHoldTimerRef.current) {
        clearTimeout(revealHoldTimerRef.current);
        revealHoldTimerRef.current = null;
      }
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
      if (revealHoldTimerRef.current) {
        clearTimeout(revealHoldTimerRef.current);
        revealHoldTimerRef.current = null;
      }
      cleanupPromise.then((cleanup) => cleanup?.());
    };
  }, [boardId]);

  // 新たなリーチLINEが発生した（pendingNewReachLine）場合のみ、フラッシュ終了を待って
  // reachAnimKeyを進める（抽選直後のマスはまず当選フラッシュを最後まで見せてから演出を出す）。
  // 新たなLINEが発生していないフラッシュではreachAnimKeyが変わらないため、演出はやり直されない。
  if (flashingCells.size === 0 && pendingNewReachLine) {
    setReachAnimKey((key) => key + 1);
    setPendingNewReachLine(false);
  }

  return { board, game, loading, error, flashingCells, reachAnimKey };
}
