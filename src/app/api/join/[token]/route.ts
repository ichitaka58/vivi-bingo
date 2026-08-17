import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

type GameStatus = "draft" | "open" | "playing" | "finished";

type GameRow = {
  id: string;
  title: string;
  status: GameStatus;
  join_expires_at: string;
};

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: { message } }, { status });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const { data, error } = await supabaseAdmin
    .from("games")
    .select("id, title, status, join_expires_at")
    .eq("join_url_token", token)
    .maybeSingle();

  if (error) {
    return errorResponse("ゲーム情報の取得に失敗しました。", 500);
  }

  if (!data) {
    return errorResponse("このURLは無効です。", 404);
  }

  const game = data as GameRow;

  if (new Date(game.join_expires_at).getTime() < Date.now()) {
    return errorResponse("このURLの有効期限が切れています。", 410);
  }

  return NextResponse.json({
    id: game.id,
    title: game.title,
    status: game.status,
  });
}
