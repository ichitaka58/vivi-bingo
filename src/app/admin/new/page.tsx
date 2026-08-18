"use client";

import { useState, type FormEvent } from "react";

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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
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
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-16">
        <div className="w-full max-w-md space-y-4 rounded-lg border border-black/10 p-6 dark:border-white/15">
          <h1 className="text-xl font-semibold">ゲームを作成しました</h1>
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-zinc-500">ゲームタイトル</dt>
              <dd>{createdGame.title}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">ゲームID</dt>
              <dd className="break-all font-mono text-xs">
                {createdGame.id}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">参加用URL</dt>
              <dd className="break-all font-mono text-xs">{joinUrl}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">参加受付期限</dt>
              <dd>
                {new Date(createdGame.joinExpiresAt).toLocaleString("ja-JP")}
              </dd>
            </div>
          </dl>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-16">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md space-y-4 rounded-lg border border-black/10 p-6 dark:border-white/15"
      >
        <h1 className="text-xl font-semibold">ゲームを作成</h1>

        <div className="space-y-1">
          <label htmlFor="title" className="block text-sm font-medium">
            ゲームタイトル
          </label>
          <input
            id="title"
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded border border-black/15 px-3 py-2 dark:border-white/20 dark:bg-transparent"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="maxBoards" className="block text-sm font-medium">
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
            className="w-full rounded border border-black/15 px-3 py-2 dark:border-white/20 dark:bg-transparent"
          />
        </div>

        <div className="space-y-1">
          <label
            htmlFor="joinExpiresInHours"
            className="block text-sm font-medium"
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
            className="w-full rounded border border-black/15 px-3 py-2 dark:border-white/20 dark:bg-transparent"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded bg-foreground px-4 py-2 text-background disabled:opacity-50"
        >
          {submitting ? "作成中..." : "作成"}
        </button>
      </form>
    </div>
  );
}
