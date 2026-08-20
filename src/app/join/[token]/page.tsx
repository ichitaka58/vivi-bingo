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
      <div className="flex flex-1 items-center justify-center bg-matsuri-cream px-4 py-16 font-round">
        <p className="text-sm text-matsuri-purple">読み込み中...</p>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="flex flex-1 items-center justify-center bg-matsuri-cream px-4 py-16 font-round">
        <p className="text-sm text-matsuri-red">
          {error ?? "このゲームには参加できません。"}
        </p>
      </div>
    );
  }

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

      <div className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-5 py-16">
        <div className="flex flex-col gap-1.5">
          <span className="inline-flex w-fit rounded-full bg-matsuri-red px-3 py-1 font-heading text-xs font-bold tracking-wide text-matsuri-cream-soft">
            BINGO PARTY
          </span>
          <h1 className="mt-1 font-heading text-3xl leading-tight font-extrabold">
            {game.title}
          </h1>
          <div
            className="mt-2 h-1.5 w-16 rounded-full"
            style={{
              background: "linear-gradient(90deg, #E11D2E, #FFC93C, #E11D2E)",
            }}
          />
          <p className="mt-3 text-sm font-bold text-matsuri-purple">
            ユーザー名を入力してBingoボードを発行してください。
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-1.5 rounded-2xl border-2 border-matsuri-border-gold bg-white p-6"
        >
          <label
            htmlFor="userName"
            className="font-heading text-sm font-bold"
          >
            ユーザー名
          </label>
          <input
            id="userName"
            type="text"
            required
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            className="w-full rounded-xl border-2 border-matsuri-border-token px-4 py-3 text-[15px] font-bold text-matsuri-navy focus:outline-none"
          />

          {error && (
            <p className="mt-1 text-sm font-bold text-matsuri-red">{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="matsuri-primary-btn mt-4 w-full rounded-full py-3.5 font-heading text-[17px] font-bold text-matsuri-cream-soft disabled:opacity-50"
          >
            {submitting ? "発行中..." : "ボードを発行"}
          </button>
        </form>
      </div>
    </div>
  );
}
