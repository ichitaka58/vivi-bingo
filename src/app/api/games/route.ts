import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

const DEFAULT_JOIN_EXPIRES_HOURS = 24;

type GameStatus = "draft" | "open" | "playing" | "finished";

type GameRow = {
  id: string;
  title: string;
  max_boards: number;
  status: GameStatus;
  join_url_token: string;
  join_expires_at: string;
  created_at: string;
};

type CreateGameRequestBody = {
  title?: unknown;
  maxBoards?: unknown;
  joinExpiresInHours?: unknown;
};

function toGameResponse(game: GameRow) {
  return {
    id: game.id,
    title: game.title,
    maxBoards: game.max_boards,
    status: game.status,
    joinUrlToken: game.join_url_token,
    joinExpiresAt: game.join_expires_at,
    createdAt: game.created_at,
  };
}

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: { message } }, { status });
}

export async function POST(request: Request) {
  let body: CreateGameRequestBody;
  try {
    body = await request.json();
  } catch {
    return errorResponse("リクエストボディがJSONとして解釈できません。", 400);
  }

  const { title, maxBoards, joinExpiresInHours } = body;

  if (typeof title !== "string" || title.trim().length === 0) {
    return errorResponse("title は必須です。", 400);
  }

  if (
    typeof maxBoards !== "number" ||
    !Number.isInteger(maxBoards) ||
    maxBoards <= 0
  ) {
    return errorResponse("maxBoards は1以上の整数で指定してください。", 400);
  }

  let joinExpiresHours = DEFAULT_JOIN_EXPIRES_HOURS;
  if (joinExpiresInHours !== undefined) {
    if (
      typeof joinExpiresInHours !== "number" ||
      !Number.isFinite(joinExpiresInHours) ||
      joinExpiresInHours <= 0
    ) {
      return errorResponse(
        "joinExpiresInHours は正の数で指定してください。",
        400
      );
    }
    joinExpiresHours = joinExpiresInHours;
  }

  const joinExpiresAt = new Date(
    Date.now() + joinExpiresHours * 60 * 60 * 1000
  );

  const { data, error } = await supabaseAdmin
    .from("games")
    .insert({
      title: title.trim(),
      max_boards: maxBoards,
      status: "open" satisfies GameStatus,
      join_url_token: randomUUID(),
      join_expires_at: joinExpiresAt.toISOString(),
    })
    .select()
    .single();

  if (error || !data) {
    return errorResponse("ゲームの作成に失敗しました。", 500);
  }

  return NextResponse.json(toGameResponse(data as GameRow), { status: 201 });
}
