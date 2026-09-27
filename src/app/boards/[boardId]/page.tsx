"use client";

import { useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { judgeBingo } from "@/lib/bingo-judge";
import { fireBingoCelebration } from "@/lib/bingo-confetti";
import BingoBurst from "@/components/BingoBurst";
import BoardDecorations from "@/components/BoardDecorations";
import DrawHistory from "@/components/DrawHistory";
import FishSchool from "@/components/FishSchool";
import { useBoardAudio } from "@/hooks/useBoardAudio";
import { useBoardSync } from "@/hooks/useBoardSync";

const COLUMN_LABELS = ["B", "I", "N", "G", "O"];
const COLUMN_COLORS = [
  "var(--color-matsuri-red)",
  "var(--color-matsuri-gold)",
  "var(--color-matsuri-navy)",
  "var(--color-matsuri-gold)",
  "var(--color-matsuri-red)",
];
const BOARD_SIZE = 5;

export default function BoardPage() {
  const params = useParams<{ boardId: string }>();
  const boardId = params.boardId;

  const bingoCelebratedRef = useRef(false); // このボードでクラッカー演出を発火済みか（1回だけ発火させるため）
  const confettiCancelRef = useRef<(() => void) | null>(null); // 発火中のクラッカー演出を止める関数
  // ボード/ゲーム情報の取得＋Realtime購読。reachAnimKeyは新たなリーチLINEの演出を再生するたびに増える
  const { board, game, loading, error, flashingCells, reachAnimKey } =
    useBoardSync(boardId);
  // 効果音。リーチ音声はreachAnimKeyの増加に合わせてフック内で自動再生される
  const { playBingoCheer } = useBoardAudio(reachAnimKey);

  // ボードが切り替わったらクラッカー演出を再び発火できるようにする
  useEffect(() => {
    bingoCelebratedRef.current = false;
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
  // リーチ演出（バナー/金魚）: バナー/金魚はkey={reachAnimKey}でマウントしているため、
  // reachAnimKeyの増分のたびに新規DOM要素として再マウント＝演出が再生される。
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
