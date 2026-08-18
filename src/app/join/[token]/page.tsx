"use client";

import { useEffect, useState, type SubmitEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import { getStoredBoardId, setStoredBoardId } from "@/lib/board-storage";

type GameStatus = "draft" | "open" | "playing" | "finished";

type JoinGame = {
  id: string;
  title: string;
  status: GameStatus;
};

export default function JoinPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const router = useRouter();

  const [game, setGame] = useState<JoinGame | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userName, setUserName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        const res = await fetch(`/api/join/${token}`);
        const data = await res.json();
        if (cancelled) {
          return;
        }
        if (!res.ok) {
          setError(data.error?.message ?? "このゲームには参加できません。");
          setLoading(false);
          return;
        }
        const joinedGame = data as JoinGame;
        const existingBoardId = getStoredBoardId(joinedGame.id);
        if (existingBoardId) {
          router.replace(`/boards/${existingBoardId}`);
          return;
        }
        setGame(joinedGame);
        setLoading(false);
      } catch {
        if (!cancelled) {
          setError("通信エラーが発生しました。");
          setLoading(false);
        }
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [token, router]);

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!game) {
      return;
    }
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/games/${game.id}/boards`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userName }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message ?? "ボードの発行に失敗しました。");
        setSubmitting(false);
        return;
      }
      setStoredBoardId(game.id, data.boardId as string);
      router.replace(`/boards/${data.boardId}`);
    } catch {
      setError("通信エラーが発生しました。");
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-16">
        <p className="text-sm text-zinc-500">読み込み中...</p>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-16">
        <p className="text-sm text-red-600">
          {error ?? "このゲームには参加できません。"}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-16">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md space-y-4 rounded-lg border border-black/10 p-6 dark:border-white/15"
      >
        <h1 className="text-xl font-semibold">{game.title}</h1>
        <p className="text-sm text-zinc-500">
          ユーザー名を入力してBingoボードを発行してください。
        </p>

        <div className="space-y-1">
          <label htmlFor="userName" className="block text-sm font-medium">
            ユーザー名
          </label>
          <input
            id="userName"
            type="text"
            required
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            className="w-full rounded border border-black/15 px-3 py-2 dark:border-white/20 dark:bg-transparent"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded bg-foreground px-4 py-2 text-background disabled:opacity-50"
        >
          {submitting ? "発行中..." : "ボードを発行"}
        </button>
      </form>
    </div>
  );
}
