"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
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
const COLUMN_COLORS = [
  "var(--color-matsuri-red)",
  "var(--color-matsuri-gold)",
  "var(--color-matsuri-navy)",
  "var(--color-matsuri-gold)",
  "var(--color-matsuri-red)",
];
const BOARD_SIZE = 5;

// リーチ中に右から左へ横切る金魚。位置・サイズ・タイミングはデザイン確定版のモックアップから移植
type FishConfig = {
  top: string;
  width: number;
  height: number;
  delay: string;
  duration: string;
  color: string;
};

const FISH: FishConfig[] = [
  { top: "4%", width: 52, height: 26, delay: "0.15s", duration: "1.5s", color: "#FFC93C" },
  { top: "10%", width: 60, height: 30, delay: "0.30s", duration: "1.7s", color: "#E11D2E" },
  { top: "16%", width: 44, height: 22, delay: "0.42s", duration: "1.4s", color: "#B3121F" },
  { top: "22%", width: 56, height: 28, delay: "0.58s", duration: "1.6s", color: "#FFC93C" },
  { top: "29%", width: 48, height: 24, delay: "0.70s", duration: "1.5s", color: "#E11D2E" },
  { top: "35%", width: 62, height: 31, delay: "0.85s", duration: "1.8s", color: "#FFC93C" },
  { top: "41%", width: 40, height: 20, delay: "0.95s", duration: "1.4s", color: "#B3121F" },
  { top: "47%", width: 58, height: 29, delay: "1.10s", duration: "1.6s", color: "#E11D2E" },
  { top: "53%", width: 50, height: 25, delay: "1.25s", duration: "1.5s", color: "#FFC93C" },
  { top: "59%", width: 60, height: 30, delay: "1.35s", duration: "1.7s", color: "#B3121F" },
  { top: "65%", width: 46, height: 23, delay: "1.50s", duration: "1.4s", color: "#E11D2E" },
  { top: "71%", width: 56, height: 28, delay: "1.65s", duration: "1.6s", color: "#FFC93C" },
  { top: "77%", width: 52, height: 26, delay: "1.80s", duration: "1.5s", color: "#B3121F" },
  { top: "83%", width: 62, height: 31, delay: "1.95s", duration: "1.8s", color: "#E11D2E" },
  { top: "89%", width: 44, height: 22, delay: "2.10s", duration: "1.4s", color: "#FFC93C" },
  { top: "94%", width: 58, height: 29, delay: "2.25s", duration: "1.6s", color: "#B3121F" },
];

const FISH_PATH =
  "M2,16 C2,8 14,4 26,4 C40,4 50,10 50,16 C50,22 40,28 26,28 C14,28 2,24 2,16 Z M50,16 L62,6 L62,26 Z";

// ビンゴ演出: 中央のBINGO!!文字の周りに飛び散る紙吹雪風の粒
type SparkConfig = {
  tx: number;
  ty: number;
  color: string;
  delay: string;
  shape: "dot" | "chip";
};

const BINGO_SPARKS: SparkConfig[] = [
  { tx: 0, ty: -100, color: "#FFD700", delay: "0.04s", shape: "dot" },
  { tx: 72, ty: -72, color: "#E11D2E", delay: "0.08s", shape: "chip" },
  { tx: 100, ty: 0, color: "#FFC93C", delay: "0.02s", shape: "dot" },
  { tx: 72, ty: 72, color: "#2F6FED", delay: "0.10s", shape: "chip" },
  { tx: 0, ty: 100, color: "#E11D2E", delay: "0.06s", shape: "dot" },
  { tx: -72, ty: 72, color: "#FFD700", delay: "0.12s", shape: "chip" },
  { tx: -100, ty: 0, color: "#FFC93C", delay: "0.03s", shape: "dot" },
  { tx: -72, ty: -72, color: "#E11D2E", delay: "0.09s", shape: "chip" },
];

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
  const [reachZoneShown, setReachZoneShown] = useState(false); // リーチ演出（バナー/金魚）を一度でも表示済みか（演出のやり直しを防ぐラッチ）

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
      setReachZoneShown(false);
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
  // リーチ演出（バナー/金魚）: 初回はフラッシュ終了後にマウントしてフルで再生し、
  // 一度表示したら（reachZoneShown）以降はDOMを維持したままフラッシュ中だけ非表示にする
  // （マウント状態を保つことで、新たなリーチLINEが発生していないフラッシュのたびに
  // アニメーションがやり直されるのを防ぐ）
  if (board.isReach && celebrationReady && !reachZoneShown) {
    setReachZoneShown(true);
  }
  const reachZoneVisible = board.isReach && celebrationReady;
  const reachZoneMounted = board.isReach && reachZoneShown;

  return (
    <div className="relative flex w-full flex-1 flex-col overflow-hidden bg-matsuri-cream font-round text-matsuri-navy">
      <svg
        className="pointer-events-none absolute -top-3 -right-2 z-0"
        width="90"
        height="90"
        viewBox="0 0 90 90"
      >
        <circle cx="45" cy="45" r="30" fill="#E11D2E" opacity="0.18" />
      </svg>
      <svg
        className="pointer-events-none absolute top-10 -left-4 z-0"
        width="50"
        height="50"
        viewBox="0 0 50 50"
      >
        <polygon points="25,2 48,45 2,45" fill="#2F6FED" opacity="0.12" />
      </svg>
      <svg
        className="pointer-events-none absolute top-40 right-2 z-0"
        width="26"
        height="26"
        viewBox="0 0 26 26"
      >
        <circle cx="13" cy="13" r="13" fill="#FF3D81" opacity="0.22" />
      </svg>
      <svg
        className="pointer-events-none absolute bottom-28 left-1 z-0"
        width="34"
        height="34"
        viewBox="0 0 34 34"
      >
        <rect
          x="4"
          y="4"
          width="26"
          height="26"
          rx="8"
          fill="#FFC93C"
          opacity="0.2"
          transform="rotate(18 17 17)"
        />
      </svg>

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

        {game.drawHistory.length > 0 && (
          <div className="relative rounded-2xl border-2 border-matsuri-border-gold bg-white pt-6 pr-3 pb-3 pl-3">
            <span className="absolute top-2 left-3.5 font-heading text-[10px] font-bold tracking-widest text-matsuri-label">
              抽選番号
            </span>
            <div
              ref={historyScrollRef}
              className="flex items-center gap-2.5 overflow-x-auto py-1.5"
            >
              {game.drawHistory.map((draw, index) => {
                const isLatest = index === game.drawHistory.length - 1;
                return (
                  <div
                    key={draw.number}
                    className={
                      isLatest ? "board-chip board-chip-latest" : "board-chip"
                    }
                  >
                    {draw.number}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="relative mt-12">
          {reachZoneMounted && (
            <div
              className={`board-reach-zone ${reachZoneVisible ? "" : "invisible"}`}
            >
              <div className="board-reach-banner">
                <span className="board-reach-banner-text">リーチ!</span>
              </div>
              <div className="board-reach-badge">
                <span className="board-reach-badge-dot" />
                リーチ中
              </div>
            </div>
          )}
          {board.isBingo && celebrationReady && (
            <div className="board-bingo-burst">
              <div className="board-bingo-spark-field">
                {BINGO_SPARKS.map((spark, index) => (
                  <div
                    key={index}
                    className={`board-bingo-spark ${spark.shape}`}
                    style={
                      {
                        "--tx": `${spark.tx}px`,
                        "--ty": `${spark.ty}px`,
                        background: spark.color,
                        animationDelay: spark.delay,
                      } as CSSProperties
                    }
                  />
                ))}
              </div>
              <span className="board-bingo-text">BINGO!!</span>
            </div>
          )}
          <div className="relative overflow-hidden rounded-xl">
            {reachZoneMounted && (
              <div
                className={`board-fish-layer ${reachZoneVisible ? "" : "invisible"}`}
              >
                {FISH.map((fish, index) => (
                  <svg
                    key={index}
                    className="board-fish"
                    style={{
                      top: fish.top,
                      width: fish.width,
                      height: fish.height,
                      animationDelay: fish.delay,
                      animationDuration: fish.duration,
                    }}
                    viewBox="0 0 64 32"
                  >
                    <path d={FISH_PATH} fill={fish.color} />
                    <circle cx="10" cy="13" r="1.6" fill="#7A0D16" />
                  </svg>
                ))}
              </div>
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
