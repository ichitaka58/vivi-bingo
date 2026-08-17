import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import type { BoardMarked, BoardNumbers } from "@/lib/bingo-board";

type BoardWithUserRow = {
  id: string;
  game_id: string;
  user_id: string;
  numbers: BoardNumbers;
  marked: BoardMarked;
  is_reach: boolean;
  is_bingo: boolean;
  created_at: string;
  users: { name: string } | null;
};

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: { message } }, { status });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const { boardId } = await params;

  const { data, error } = await supabaseAdmin
    .from("boards")
    .select(
      "id, game_id, user_id, numbers, marked, is_reach, is_bingo, created_at, users(name)"
    )
    .eq("id", boardId)
    .maybeSingle();

  if (error) {
    return errorResponse("ボード情報の取得に失敗しました。", 500);
  }

  if (!data) {
    return errorResponse("指定されたボードが見つかりません。", 404);
  }

  const board = data as unknown as BoardWithUserRow;

  return NextResponse.json({
    boardId: board.id,
    gameId: board.game_id,
    userId: board.user_id,
    userName: board.users?.name ?? "",
    numbers: board.numbers,
    marked: board.marked,
    isReach: board.is_reach,
    isBingo: board.is_bingo,
    createdAt: board.created_at,
  });
}
