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

// 抽選番号が増えたときの最初の反映を、管理者側の抽選演出とタイミングを合わせるために
// この時間だけ保留してから画面へ反映する（ルーレット演出が ≈3.3s のため、余裕をみて少し長めに設定）。
const REVEAL_HOLD_MS = 4000;

// リーチ音声（女性アニメ風「リ〜チ！」）。バナーが飛び込んで着地する頃に合わせて少し遅らせて再生する
const REACH_VOICE_SRC = "/sounds/reach.mp3";
const REACH_VOICE_DELAY_MS = 400;

// ビンゴ成立時の歓声＋拍手。クラッカー演出の発火と同時に再生する
const BINGO_CHEER_SRC = "/sounds/cheers_and_applause.mp3";

// リーチライン（セル座標の列）を比較可能な文字列キーに変換する。
// 「新たなリーチLINEができたか」を前回との差分で判定するために使う。
function reachLineKey(line: { col: number; row: number }[]): string {
  return line.map(({ col, row }) => `${col}-${row}`).join(",");
}

// リーチ中に右から左へ横切る金魚の群れ。小さめの金魚が密集したかたまりで
// ボードを通過する。奥（小さい・薄い・遅い）から
// 手前（大きい・濃い・速い）までの3層で構成し、視差で奥行きを出す。
type FishConfig = {
  top: string;
  width: number;
  height: number;
  opacity: number;
  delay: string;
  duration: string;
  wiggleDuration: string;
  bobDuration: string;
  color: string;
};

type FishLayer = {
  count: number;
  minWidth: number;
  maxWidth: number;
  opacity: number;
  minDuration: number;
  maxDuration: number;
};

const FISH_LAYERS: FishLayer[] = [
  { count: 56, minWidth: 24, maxWidth: 36, opacity: 0.3, minDuration: 1.9, maxDuration: 2.15 },
  { count: 44, minWidth: 38, maxWidth: 54, opacity: 0.52, minDuration: 1.65, maxDuration: 1.9 },
  { count: 26, minWidth: 58, maxWidth: 82, opacity: 0.78, minDuration: 1.45, maxDuration: 1.7 },
];

const FISH_COLORS = ["#FFC93C", "#E11D2E", "#B3121F", "#FF9E2C"];

// 群れの横の厚み（秒）。各個体のアニメーション開始をこの幅だけずらすことで、
// 速度をそろえたまま「かたまり」としての奥行きを作る。
const FISH_SCHOOL_SPREAD_S = 0.95;

// シード固定のPRNG（mulberry32）。SSRとクライアントで必ず同じ配置を生成させ、
// hydrationの不一致を防ぐ。
function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildFishSchool(): FishConfig[] {
  const random = createSeededRandom(20260922);
  const school: FishConfig[] = [];

  FISH_LAYERS.forEach((layer) => {
    for (let index = 0; index < layer.count; index += 1) {
      // 縦位置は層ごとに等分してからジッターを足す。完全なランダムより偏りが出にくく、
      // ボード全面がまんべんなく埋まる。
      const top = ((index + random()) / layer.count) * 94 + 2;
      const width = Math.round(
        layer.minWidth + random() * (layer.maxWidth - layer.minWidth)
      );
      // 乱数2つの平均でベル型に寄せ、群れの中央を密に・前後を疎にする
      const spread = ((random() + random()) / 2) * FISH_SCHOOL_SPREAD_S;

      school.push({
        top: `${top.toFixed(1)}%`,
        width,
        height: Math.round(width / 2),
        opacity: layer.opacity,
        delay: `${spread.toFixed(2)}s`,
        duration: `${(
          layer.minDuration + random() * (layer.maxDuration - layer.minDuration)
        ).toFixed(2)}s`,
        wiggleDuration: `${(0.26 + random() * 0.14).toFixed(2)}s`,
        bobDuration: `${(0.8 + random() * 0.5).toFixed(2)}s`,
        color: FISH_COLORS[Math.floor(random() * FISH_COLORS.length)],
      });
    }
  });

  return school;
}

const FISH = buildFishSchool();

// 最後の1匹がボードを抜け切るまでの時間（ms）。これを過ぎたら魚群レイヤーごと外す。
// 各魚の上下動・尾びれの振りは無限ループのため、残しておくと画面外で動き続けて端末が発熱する。
const FISH_PASS_MS =
  Math.ceil(
    Math.max(
      ...FISH.map((fish) => parseFloat(fish.delay) + parseFloat(fish.duration))
    ) * 1000
  ) + 200;

// 眼を描き込むサイズのしきい値。これより小さい個体では潰れて見えないので省く
const FISH_EYE_MIN_WIDTH = 40;

// 金魚のシルエット（左向き）。胴体から尾びれまでを自己交差のない1本の輪郭で描く
const FISH_PATH =
  "M2,16 C2,10.5 11,6.5 26,6.5 C38,6.5 45,10 48,15 C52,10.5 57,6 62,3 " +
  "C59.5,9 58,13 57.5,16 C58,19 59.5,23 62,29 C57,26 52,21.5 48,17 " +
  "C45,22 38,25.5 26,25.5 C11,25.5 2,21.5 2,16 Z";

// 背びれと腹びれ。胴体と少し重なるため、輪郭とは別パスにして塗り分けの破綻を避ける
const FISH_FIN_PATH =
  "M23,8 C28,2.5 35,1.5 41,4 C35,5 29,6 26,8.5 Z " +
  "M26,24.5 C29,28.5 33,29.5 37,28 C33,26.5 30,25.5 28,24.5 Z";

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
  // 魚群が横切り終えた演出回（reachAnimKeyの値）。一致している間は魚群レイヤーを描画しない
  const [fishPassedKey, setFishPassedKey] = useState(0);
  // リーチ音声。<audio>要素をrefで1つだけ保持し、reachAnimKeyの増加（＝新しいリーチLINE）に
  // 合わせて再生する。ブラウザの自動再生ブロック対策として、初回のユーザー操作で一度だけ
  // 無音再生→即停止して要素を解錠しておく。
  const reachAudioRef = useRef<HTMLAudioElement | null>(null);
  const bingoAudioRef = useRef<HTMLAudioElement | null>(null); // ビンゴ歓声。リーチ音声と同じく初回操作で解錠する

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
        const newlyMarkedKeys: string[] = [];
        for (let col = 0; col < BOARD_SIZE; col++) {
          for (let row = 0; row < BOARD_SIZE; row++) {
            if (nextBoard.marked[col][row] && !prevMarked[col][row]) {
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

        // 前回になかったリーチLINEが新たに増えていたら、リーチ演出（バナー/金魚）を
        // 再生対象としてマークする（既存のリーチLINEが残っているだけでは発火させない）
        const prevReachKeys = new Set(
          judgeBingo(prevMarked).reachLines.map(reachLineKey)
        );
        const hasNewReachLine = judgeBingo(nextBoard.marked).reachLines.some(
          (line) => !prevReachKeys.has(reachLineKey(line))
        );
        if (hasNewReachLine) {
          setPendingNewReachLine(true);
        }
      } else if (judgeBingo(nextBoard.marked).reachLines.length > 0) {
        // 初回反映時点で既にリーチ状態だった場合も、演出は表示する
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
      setFishPassedKey(0);
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
    const audio = bingoAudioRef.current;
    if (audio) {
      audio.currentTime = 0;
      audio.play().catch(() => {});
    }
  }, [board?.isBingo, flashingCells.size]);

  // アンマウント時に発火中のクラッカー演出を止める
  useEffect(() => {
    return () => {
      confettiCancelRef.current?.();
    };
  }, []);

  // リーチ音声・ビンゴ歓声の初期化と、自動再生ブロック対策の解錠。
  // 最初の pointerdown を1回だけ拾い、各音声を無音で play→pause して以降の play() を通す。
  useEffect(() => {
    const reachAudio = new Audio(REACH_VOICE_SRC);
    reachAudio.preload = "auto";
    reachAudioRef.current = reachAudio;
    const bingoAudio = new Audio(BINGO_CHEER_SRC);
    bingoAudio.preload = "auto";
    bingoAudioRef.current = bingoAudio;
    const audios = [reachAudio, bingoAudio];

    let unlocked = false;
    const unlock = () => {
      if (unlocked) {
        return;
      }
      unlocked = true;
      window.removeEventListener("pointerdown", unlock);
      audios.forEach((audio) => {
        const restoreMuted = audio.muted;
        audio.muted = true;
        audio
          .play()
          .then(() => {
            audio.pause();
            audio.currentTime = 0;
            audio.muted = restoreMuted;
          })
          .catch(() => {
            audio.muted = restoreMuted;
          });
      });
    };
    window.addEventListener("pointerdown", unlock);

    return () => {
      window.removeEventListener("pointerdown", unlock);
      audios.forEach((audio) => audio.pause());
      reachAudioRef.current = null;
      bingoAudioRef.current = null;
    };
  }, []);

  // 新しいリーチLINEができるたび（reachAnimKeyの増加）に、バナー着地の頃を狙って1回だけ再生。
  // 初回マウント時（reachAnimKey === 0）や、自動再生がブロックされた場合は何もしない。
  useEffect(() => {
    if (reachAnimKey === 0) {
      return;
    }
    const timeoutId = setTimeout(() => {
      const audio = reachAudioRef.current;
      if (!audio) {
        return;
      }
      audio.currentTime = 0;
      audio.play().catch(() => {});
    }, REACH_VOICE_DELAY_MS);
    return () => clearTimeout(timeoutId);
  }, [reachAnimKey]);

  // 魚群が横切り終えたらレイヤーを外し、画面外で動き続けるアニメーションを止める
  useEffect(() => {
    if (reachAnimKey === 0) {
      return;
    }
    const timeoutId = setTimeout(() => {
      setFishPassedKey(reachAnimKey);
    }, FISH_PASS_MS);
    return () => clearTimeout(timeoutId);
  }, [reachAnimKey]);

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
  const fishSwimming = reachZoneMounted && fishPassedKey !== reachAnimKey;

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
          <div className="relative">
            {fishSwimming && (
              <div
                key={reachAnimKey}
                className={`board-fish-layer overflow-hidden rounded-xl ${reachZoneVisible ? "" : "invisible"}`}
              >
                {FISH.map((fish, index) => (
                  <div
                    key={index}
                    className="board-fish-track"
                    style={
                      {
                        top: fish.top,
                        animationDelay: fish.delay,
                        animationDuration: fish.duration,
                        // 魚の実寸。左端から完全に抜け切る移動量の算出にCSS側で使う
                        "--fish-width": `${fish.width}px`,
                      } as CSSProperties
                    }
                  >
                    <div
                      className="board-fish"
                      style={{
                        width: fish.width,
                        height: fish.height,
                        marginTop: -fish.height / 2,
                        opacity: fish.opacity,
                        animationDuration: fish.bobDuration,
                      }}
                    >
                      <svg
                        viewBox="0 0 64 32"
                        style={{ animationDuration: fish.wiggleDuration }}
                      >
                        <path d={FISH_PATH} fill={fish.color} />
                        <path d={FISH_FIN_PATH} fill={fish.color} opacity="0.75" />
                        {fish.width >= FISH_EYE_MIN_WIDTH && (
                          <circle cx="11" cy="14" r="1.7" fill="#7A0D16" />
                        )}
                      </svg>
                    </div>
                  </div>
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
