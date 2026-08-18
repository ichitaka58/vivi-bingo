import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

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

type BoardUserRow = {
  user_id: string;
  users: { name: string } | null;
};

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: { message } }, { status });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  const { gameId } = await params;

  const { data: gameData, error: gameError } = await supabaseAdmin
    .from("games")
    .select(
      "id, title, max_boards, status, join_url_token, join_expires_at, created_at"
    )
    .eq("id", gameId)
    .maybeSingle();

  if (gameError) {
    return errorResponse("ゲーム情報の取得に失敗しました。", 500);
  }

  if (!gameData) {
    return errorResponse("指定されたゲームが見つかりません。", 404);
  }

  const game = gameData as GameRow;

  const [
    { count: boardCount, error: boardCountError },
    { count: drawCount, error: drawCountError },
    { data: drawHistoryData, error: drawHistoryError },
    { data: reachData, error: reachError },
    { data: bingoData, error: bingoError },
  ] = await Promise.all([
    supabaseAdmin
      .from("boards")
      .select("id", { count: "exact", head: true })
      .eq("game_id", gameId),
    supabaseAdmin
      .from("draws")
      .select("id", { count: "exact", head: true })
      .eq("game_id", gameId),
    supabaseAdmin
      .from("draws")
      .select("number, draw_order")
      .eq("game_id", gameId)
      .order("draw_order", { ascending: true }),
    supabaseAdmin
      .from("boards")
      .select("user_id, users(name)")
      .eq("game_id", gameId)
      .eq("is_reach", true),
    supabaseAdmin
      .from("boards")
      .select("user_id, users(name)")
      .eq("game_id", gameId)
      .eq("is_bingo", true),
  ]);

  if (
    boardCountError ||
    drawCountError ||
    drawHistoryError ||
    reachError ||
    bingoError
  ) {
    return errorResponse("ゲーム集計情報の取得に失敗しました。", 500);
  }

  const drawHistory = (
    (drawHistoryData as { number: number; draw_order: number }[] | null) ?? []
  ).map((row) => ({ number: row.number, drawOrder: row.draw_order }));

  const toUserList = (rows: BoardUserRow[] | null) =>
    (rows ?? []).map((row) => ({
      userId: row.user_id,
      userName: row.users?.name ?? "",
    }));

  return NextResponse.json({
    id: game.id,
    title: game.title,
    maxBoards: game.max_boards,
    boardCount: boardCount ?? 0,
    status: game.status,
    joinUrlToken: game.join_url_token,
    joinExpiresAt: game.join_expires_at,
    createdAt: game.created_at,
    drawCount: drawCount ?? 0,
    lastDrawNumber:
      drawHistory.length > 0
        ? drawHistory[drawHistory.length - 1].number
        : null,
    drawHistory,
    reachUsers: toUserList(reachData as unknown as BoardUserRow[] | null),
    bingoUsers: toUserList(bingoData as unknown as BoardUserRow[] | null),
  });
}
