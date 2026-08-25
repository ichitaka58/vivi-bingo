"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getMyGameIds } from "@/lib/my-games";

type GameStatus = "draft" | "open" | "playing" | "finished";

type GameSummary = {
  id: string;
  title: string;
  maxBoards: number;
  boardCount: number;
  status: GameStatus;
  createdAt: string;
};

type GameCardState =
  | { status: "loaded"; game: GameSummary }
  | { status: "error"; id: string };

const STATUS_LABELS: Record<GameStatus, string> = {
  draft: "下書き",
  open: "募集中",
  playing: "進行中",
  finished: "終了",
};

async function fetchGameSummary(gameId: string): Promise<GameCardState> {
  try {
    const res = await fetch(`/api/games/${gameId}`);
    if (!res.ok) {
      return { status: "error", id: gameId };
    }
    const data = await res.json();
    return { status: "loaded", game: data as GameSummary };
  } catch {
    return { status: "error", id: gameId };
  }
}

export default function AdminGameListPage() {
  const [cards, setCards] = useState<GameCardState[] | null>(null);

  useEffect(() => {
    const gameIds = getMyGameIds();
    const cardsPromise =
      gameIds.length === 0
        ? Promise.resolve<GameCardState[]>([])
        : Promise.all(gameIds.map(fetchGameSummary));
    cardsPromise.then(setCards);
  }, []);

  return (
    <div className="flex w-full flex-1 flex-col bg-matsuri-cream font-round text-matsuri-navy">
      <div className="admin-banner flex flex-wrap items-center justify-between gap-4 px-6 py-5 sm:px-9 sm:py-6">
        <div className="flex flex-col gap-2">
          <span className="inline-flex w-fit rounded-full bg-white px-3 py-1 font-heading text-xs font-bold tracking-wide text-matsuri-red">
            BINGO PARTY
          </span>
          <h1 className="font-heading text-2xl font-extrabold text-matsuri-cream-soft sm:text-[28px]">
            ゲーム一覧
          </h1>
        </div>
        <Link
          href="/admin/new"
          className="cursor-pointer self-start rounded-full border-[1.5px] border-matsuri-cream-soft px-5 py-2.5 font-heading text-[13px] font-bold text-matsuri-cream-soft"
        >
          新しいゲームを作成
        </Link>
      </div>

      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-6 py-6 sm:px-9">
        {cards === null && (
          <p className="text-sm text-matsuri-purple">読み込み中...</p>
        )}

        {cards !== null && cards.length === 0 && (
          <div className="flex flex-col items-center gap-4 rounded-2xl border-[1.5px] border-matsuri-border-calm bg-white px-5 py-10 text-center">
            <p className="text-sm font-bold text-matsuri-muted">
              このブラウザで作成したゲームはまだありません。
            </p>
            <Link
              href="/admin/new"
              className="matsuri-primary-btn inline-flex items-center justify-center rounded-full px-8 py-3 font-heading text-sm font-bold text-matsuri-cream-soft"
            >
              ゲームを作成する
            </Link>
          </div>
        )}

        {cards !== null && cards.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {cards.map((card) => {
              const key = card.status === "loaded" ? card.game.id : card.id;

              if (card.status === "error") {
                return (
                  <div
                    key={key}
                    className="rounded-2xl border-[1.5px] border-matsuri-border-calm bg-white px-5 py-4.5"
                  >
                    <p className="text-sm font-bold text-matsuri-red">
                      ゲーム情報の取得に失敗しました。
                    </p>
                  </div>
                );
              }

              const { game } = card;
              return (
                <Link
                  key={key}
                  href={`/admin/games/${game.id}`}
                  className="flex flex-col gap-2 rounded-2xl border-[1.5px] border-matsuri-border-calm bg-white px-5 py-4.5 transition hover:border-matsuri-gold"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="font-heading text-lg font-bold">
                      {game.title}
                    </h2>
                    <span className="shrink-0 rounded-full border-[1.5px] border-matsuri-border-gold bg-matsuri-cream-soft px-2.5 py-0.5 font-heading text-[11px] font-bold text-matsuri-label">
                      {STATUS_LABELS[game.status]}
                    </span>
                  </div>
                  <p className="text-sm font-bold text-matsuri-muted">
                    発行枚数 {game.boardCount} / {game.maxBoards}
                  </p>
                  <p className="text-xs text-matsuri-placeholder">
                    作成: {new Date(game.createdAt).toLocaleString("ja-JP")}
                  </p>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
