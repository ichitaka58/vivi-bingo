"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { judgeBingo } from "@/lib/bingo-judge";
import { findNewlyMarkedCells, hasNewReachLine } from "@/lib/board-diff";
import { fireBingoCelebration } from "@/lib/bingo-confetti";
import BingoBurst from "@/components/BingoBurst";
import BoardDecorations from "@/components/BoardDecorations";
import DrawHistory, { type DrawEntry } from "@/components/DrawHistory";
import FishSchool from "@/components/FishSchool";
import { useBoardAudio } from "@/hooks/useBoardAudio";

type GameStatus = "draft" | "open" | "playing" | "finished";
type BoardNumbers = (number | null)[][];
type BoardMarked = boolean[][];

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
const COLUMN_COLORS = [
  "var(--color-matsuri-red)",
  "var(--color-matsuri-gold)",
  "var(--color-matsuri-navy)",
  "var(--color-matsuri-gold)",
  "var(--color-matsuri-red)",
];
const BOARD_SIZE = 5;

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

export default function BoardPage() {
  const params = useParams<{ boardId: string }>();
  const boardId = params.boardId;

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
  const bingoCelebratedRef = useRef(false); // このボードでクラッカー演出を発火済みか（1回だけ発火させるため）
  const confettiCancelRef = useRef<(() => void) | null>(null); // 発火中のクラッカー演出を止める関数
  // リーチ演出（バナー/金魚）を新たなリーチLINEの発生ごとに再生するための状態。
  // pendingNewReachLine: 前回取得時からリーチLINEが増えた（まだ演出未消化）ことを示すフラグ
  // reachAnimKey: 演出を再生した回数。バナー/金魚のkeyに使い、増分のたびに新規DOM要素として再マウントさせる
  const [pendingNewReachLine, setPendingNewReachLine] = useState(false);
  const [reachAnimKey, setReachAnimKey] = useState(0);
  // 効果音。リーチ音声はreachAnimKeyの増加に合わせてフック内で自動再生される
  const { playBingoCheer } = useBoardAudio(reachAnimKey);

  // ボード/ゲーム情報の取得＋Supabase Realtime購読。
  // 新しく当たったマスを検出してflashingCellsに積み、3秒後に自動で外す（＝当選フラッシュ演出）。
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
      bingoCelebratedRef.current = false;
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

  // ビンゴ成立時にクラッカー演出を1回だけ発火する。
  // 当選フラッシュが残っている間（flashingCells.size > 0）は演出を待機し、
  // フラッシュが終わってから発火する（celebrationReadyと同じ考え方）
  useEffect(() => {
    if (!board?.isBingo || flashingCells.size > 0 || bingoCelebratedRef.current) {
      return;
    }
    bingoCelebratedRef.current = true;
    confettiCancelRef.current = fireBingoCelebration();
    playBingoCheer();
  }, [board?.isBingo, flashingCells.size, playBingoCheer]);

  // アンマウント時に発火中のクラッカー演出を止める
  useEffect(() => {
    return () => {
      confettiCancelRef.current?.();
    };
  }, []);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center bg-matsuri-cream px-4 py-16 font-round">
        <p className="text-sm text-matsuri-purple">読み込み中...</p>
      </div>
    );
  }

  if (!board || !game) {
    return (
      <div className="flex flex-1 items-center justify-center bg-matsuri-cream px-4 py-16 font-round">
        <p className="text-sm text-matsuri-red">
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
  // リーチ演出（バナー/金魚）: 新たなリーチLINEが発生した（pendingNewReachLine）場合のみ、
  // フラッシュ終了を待ってreachAnimKeyを進める。バナー/金魚はkey={reachAnimKey}で
  // マウントしているため、増分のたびに新規DOM要素として再マウント＝演出が再生される。
  // 新たなLINEが発生していないフラッシュ（celebrationReadyの単なるtrue/false切り替え）では
  // reachAnimKeyが変わらないため、既存のDOM要素が維持され演出はやり直されない。
  if (celebrationReady && pendingNewReachLine) {
    setReachAnimKey((key) => key + 1);
    setPendingNewReachLine(false);
  }
  const reachZoneVisible = board.isReach && celebrationReady;
  const reachZoneMounted = board.isReach && reachAnimKey > 0;

  return (
    <div className="relative flex w-full flex-1 flex-col overflow-hidden bg-matsuri-cream font-round text-matsuri-navy">
      <BoardDecorations />

      <div className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-5 py-7">
        <div className="flex flex-col gap-1.5">
          <span className="inline-flex w-fit rounded-full bg-matsuri-red px-3 py-1 font-heading text-xs font-bold tracking-wide text-matsuri-cream-soft">
            BINGO PARTY
          </span>
          <h1 className="mt-1 font-heading text-2xl leading-tight font-extrabold">
            {game.title}
          </h1>
          <div
            className="mt-2 h-1.5 w-16 rounded-full"
            style={{
              background:
                "linear-gradient(90deg, #E11D2E, #FFC93C, #E11D2E)",
            }}
          />
          <p className="mt-3 text-sm font-bold text-matsuri-purple">
            {board.userName} さんのボード
          </p>
        </div>

        {game.status === "finished" && (
          <p className="rounded-lg border-2 border-matsuri-border-gold bg-white px-3 py-2 text-sm">
            このゲームは終了しました。
          </p>
        )}

        <DrawHistory draws={game.drawHistory} />

        <div className="relative mt-6">
          {reachZoneMounted && (
            <div
              className={`board-reach-zone ${reachZoneVisible ? "" : "invisible"}`}
            >
              <div key={`banner-${reachAnimKey}`} className="board-reach-banner">
                <span className="board-reach-banner-text">リーチ!</span>
              </div>
              <div key={`badge-${reachAnimKey}`} className="board-reach-badge">
                <span className="board-reach-badge-dot" />
                リーチ中
              </div>
            </div>
          )}
          {board.isBingo && celebrationReady && <BingoBurst />}
          <div className="relative">
            {reachZoneMounted && (
              <FishSchool key={reachAnimKey} visible={reachZoneVisible} />
            )}
            <div className="grid grid-cols-5 gap-1.5">
              {COLUMN_LABELS.map((label, index) => (
                <div
                  key={label}
                  className="flex items-end justify-center pb-1 font-heading text-4xl leading-none font-extrabold"
                  style={{ color: COLUMN_COLORS[index] }}
                >
                  {label}
                </div>
              ))}
              {cells.map(({ col, row }) => {
                const value = board.numbers[col][row];
                const key = `${col}-${row}`;
                const isFlashing = flashingCells.has(key);
                const isMarked = board.marked[col][row];
                const isFree = value === null;
                const isReachCell = celebrationReady && reachCellKeys.has(key);
                const isBingoCell = celebrationReady && bingoCellKeys.has(key);
                // トークンの見た目の優先順位: フラッシュ中 > ビンゴライン > 通常の当選/FREE > 未当選
                const tokenClass = isFlashing
                  ? "board-token animate-bingo-flash"
                  : isBingoCell
                    ? isFree
                      ? "board-token board-token-free-bingo"
                      : "board-token board-token-bingo"
                    : isMarked
                      ? isFree
                        ? "board-token board-token-free"
                        : "board-token board-token-marked"
                      : "board-token";
                return (
                  <div
                    key={key}
                    className={`board-cell ${isReachCell ? "board-cell-reach" : ""} ${
                      isBingoCell ? "board-cell-bingo" : ""
                    } ${isReachCell || isBingoCell ? "animate-reach-pop" : ""}`}
                  >
                    <span className={tokenClass}>{isFree ? "FREE" : value}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
