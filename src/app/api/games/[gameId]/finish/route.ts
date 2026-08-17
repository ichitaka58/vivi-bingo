import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

type GameStatus = "draft" | "open" | "playing" | "finished";

type GameRow = {
  id: string;
  status: GameStatus;
};

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: { message } }, { status });
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  const { gameId } = await params;

  const { data, error } = await supabaseAdmin
    .from("games")
    .update({ status: "finished" satisfies GameStatus })
    .eq("id", gameId)
    .select("id, status")
    .maybeSingle();

  if (error) {
    return errorResponse("ゲームの終了処理に失敗しました。", 500);
  }

  if (!data) {
    return errorResponse("指定されたゲームが見つかりません。", 404);
  }

  const game = data as GameRow;

  return NextResponse.json({ id: game.id, status: game.status });
}
