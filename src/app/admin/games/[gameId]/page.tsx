"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import RouletteDraw from "@/components/RouletteDraw";
import ConfirmDialog from "@/components/ConfirmDialog";
import UserListCard from "@/components/admin/UserListCard";
import DrawHistoryCard from "@/components/admin/DrawHistoryCard";
import JoinUrlCard from "@/components/admin/JoinUrlCard";
import { useAdminGame } from "@/hooks/useAdminGame";

const TOTAL_NUMBERS = 75;

export default function AdminGamePage() {
  const params = useParams<{ gameId: string }>();
  const gameId = params.gameId;

  const {
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
  } = useAdminGame(gameId);
  const [confirmingFinish, setConfirmingFinish] = useState(false);

  function handleFinish() {
    setConfirmingFinish(false);
    finish();
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
      <>
        <SiteHeader />
        <div className="flex flex-1 items-center justify-center bg-matsuri-cream px-4 py-16 font-round">
          <p className="text-sm text-matsuri-red">
            {error ?? "ゲームが見つかりません。"}
          </p>
        </div>
      </>
    );
  }

  const isFinished = game.status === "finished";
  const isDrawExhausted = game.drawCount >= TOTAL_NUMBERS;

  return (
    <div className="flex w-full flex-1 flex-col bg-matsuri-cream font-round text-matsuri-navy">
      <div className="admin-banner">
        <SiteHeader tone="banner" />
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 px-6 py-4 sm:px-9">
          <div className="flex min-w-0 flex-col gap-1">
            <Link
              href="/admin"
              className="w-fit font-heading text-xs font-bold text-matsuri-cream-soft/80 hover:underline hover:underline-offset-2"
            >
              ← ゲーム一覧
            </Link>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h1 className="min-w-0 font-heading text-2xl font-extrabold break-words text-matsuri-cream-soft sm:text-[28px]">
                {game.title}
              </h1>
              <span className="shrink-0 text-sm font-bold text-matsuri-border-gold">
                発行枚数 {game.boardCount} / {game.maxBoards}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setConfirmingFinish(true)}
            disabled={finishing || isFinished}
            className="cursor-pointer rounded-full border-[1.5px] border-matsuri-cream-soft px-5 py-2.5 font-heading text-[13px] font-bold text-matsuri-cream-soft disabled:cursor-not-allowed disabled:opacity-50"
          >
            {finishing ? "終了処理中..." : "ゲームを終了する"}
          </button>
        </div>
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
                    onRevealComplete={completeReveal}
                  />
                  <p className="mt-1.5 text-sm font-bold text-matsuri-muted">
                    抽選回数 {game.drawCount} / {TOTAL_NUMBERS}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={draw}
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
