"use client";

import { useState, type SubmitEvent } from "react";
import Link from "next/link";
import QrCode from "@/components/QrCode";
import CopyButton from "@/components/CopyButton";

type CreatedGame = {
  id: string;
  title: string;
  maxBoards: number;
  status: string;
  joinUrlToken: string;
  joinExpiresAt: string;
  createdAt: string;
};

export default function NewGamePage() {
  const [title, setTitle] = useState("");
  const [maxBoards, setMaxBoards] = useState("");
  const [joinExpiresInHours, setJoinExpiresInHours] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdGame, setCreatedGame] = useState<CreatedGame | null>(null);

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const body: Record<string, unknown> = {
      title,
      maxBoards: Number(maxBoards),
    };
    if (joinExpiresInHours.trim() !== "") {
      body.joinExpiresInHours = Number(joinExpiresInHours);
    }

    try {
      const res = await fetch("/api/games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error?.message ?? "ゲームの作成に失敗しました。");
        return;
      }

      setCreatedGame(data as CreatedGame);
    } catch {
      setError("通信エラーが発生しました。");
    } finally {
      setSubmitting(false);
    }
  }

  if (createdGame) {
    const joinUrl =
      typeof window !== "undefined"
        ? `${window.location.origin}/join/${createdGame.joinUrlToken}`
        : `/join/${createdGame.joinUrlToken}`;

    return (
      <div className="flex w-full flex-1 flex-col items-center justify-center gap-6 bg-matsuri-cream px-4 py-16 font-round text-matsuri-navy">
        <h1 className="font-heading text-6xl font-extrabold sm:text-7xl">
          ViVi! Bingo!
        </h1>
        <div className="w-full max-w-md rounded-2xl border-[1.5px] border-matsuri-border-calm bg-white p-7">
          <div className="flex items-center gap-2.5">
            <span
              className="flex h-8.5 w-8.5 shrink-0 items-center justify-center rounded-full"
              style={{
                background:
                  "linear-gradient(135deg, var(--color-matsuri-gold-bright), var(--color-matsuri-gold-deep))",
              }}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path
                  d="M3 9.5L7 13.5L15 4.5"
                  stroke="#7A5B00"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <h2 className="font-heading text-xl font-bold">
              ゲームを作成しました
            </h2>
          </div>

          <dl className="mt-5">
            <div className="border-t border-matsuri-border-calm py-3 first:border-t-0 first:pt-0">
              <dt className="font-heading text-[11px] font-bold tracking-wide text-matsuri-muted uppercase">
                ゲームタイトル
              </dt>
              <dd className="mt-1 text-sm font-bold">{createdGame.title}</dd>
            </div>
            <div className="border-t border-matsuri-border-calm py-3">
              <dt className="font-heading text-[11px] font-bold tracking-wide text-matsuri-muted uppercase">
                ゲームID
              </dt>
              <dd className="mt-1 font-mono text-xs break-all text-matsuri-purple">
                {createdGame.id}
              </dd>
            </div>
            <div className="border-t border-matsuri-border-calm py-3">
              <dt className="font-heading text-[11px] font-bold tracking-wide text-matsuri-muted uppercase">
                参加用URL
              </dt>
              <dd className="mt-1 flex items-center gap-2">
                <span className="flex-1 font-mono text-xs break-all text-matsuri-purple">
                  {joinUrl}
                </span>
                <CopyButton value={joinUrl} />
              </dd>
            </div>
            <div className="border-t border-matsuri-border-calm py-3">
              <dt className="font-heading text-[11px] font-bold tracking-wide text-matsuri-muted uppercase">
                参加受付期限
              </dt>
              <dd className="mt-1 text-sm font-bold">
                {new Date(createdGame.joinExpiresAt).toLocaleString("ja-JP")}
              </dd>
            </div>
          </dl>

          <div className="mt-5 flex justify-center">
            <div className="rounded-xl border-[1.5px] border-matsuri-border-calm p-2">
              <QrCode value={joinUrl} size={132} withActions />
            </div>
          </div>

          <Link
            href={`/admin/games/${createdGame.id}`}
            className="matsuri-primary-btn mt-6 flex w-full items-center justify-center rounded-full py-3.5 font-heading text-base font-bold text-matsuri-cream-soft"
          >
            管理画面へ
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-1 flex-col items-center justify-center gap-6 bg-matsuri-cream px-4 py-16 font-round text-matsuri-navy">
      <h1 className="font-heading text-6xl font-extrabold sm:text-7xl">
        ViVi! Bingo!
      </h1>
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-2xl border-[1.5px] border-matsuri-border-calm bg-white p-7"
      >
        <span className="inline-flex w-fit rounded-full bg-matsuri-red px-3 py-1 font-heading text-xs font-bold tracking-wide text-matsuri-cream-soft">
          NEW GAME
        </span>
        <h2 className="mt-2.5 mb-5 font-heading text-[22px] font-bold">
          ゲームを作成
        </h2>

        <div>
          <label
            htmlFor="title"
            className="mb-1.5 block font-heading text-[13px] font-bold"
          >
            ゲームタイトル
          </label>
          <input
            id="title"
            type="text"
            required
            placeholder="例）サマーピクニック大抽選会"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-[10px] border-[1.5px] border-matsuri-border-calm px-3.5 py-2.5 text-sm font-bold text-matsuri-navy placeholder:font-bold placeholder:text-matsuri-placeholder focus:outline-none"
          />
        </div>

        <div className="mt-4">
          <label
            htmlFor="maxBoards"
            className="mb-1.5 block font-heading text-[13px] font-bold"
          >
            最大発行枚数
          </label>
          <input
            id="maxBoards"
            type="number"
            min={1}
            step={1}
            required
            value={maxBoards}
            onChange={(e) => setMaxBoards(e.target.value)}
            className="w-full rounded-[10px] border-[1.5px] border-matsuri-border-calm px-3.5 py-2.5 text-sm font-bold text-matsuri-navy placeholder:font-bold placeholder:text-matsuri-placeholder focus:outline-none"
          />
        </div>

        <div className="mt-4">
          <label
            htmlFor="joinExpiresInHours"
            className="mb-1.5 block font-heading text-[13px] font-bold"
          >
            参加受付期限（時間）
          </label>
          <input
            id="joinExpiresInHours"
            type="number"
            min={1}
            step={1}
            placeholder="未入力の場合は24時間"
            value={joinExpiresInHours}
            onChange={(e) => setJoinExpiresInHours(e.target.value)}
            className="w-full rounded-[10px] border-[1.5px] border-matsuri-border-calm px-3.5 py-2.5 text-sm font-bold text-matsuri-navy placeholder:font-bold placeholder:text-matsuri-placeholder focus:outline-none"
          />
        </div>

        {error && (
          <p className="mt-3 text-sm font-bold text-matsuri-red">{error}</p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="matsuri-primary-btn mt-6 w-full rounded-full py-3.5 font-heading text-base font-bold text-matsuri-cream-soft disabled:opacity-50"
        >
          {submitting ? "作成中..." : "作成"}
        </button>
      </form>
    </div>
  );
}
