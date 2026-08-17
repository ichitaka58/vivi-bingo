import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  createInitialMarked,
  generateBoardNumbers,
  type BoardMarked,
  type BoardNumbers,
} from "@/lib/bingo-board";

type GameStatus = "draft" | "open" | "playing" | "finished";

type GameRow = {
  id: string;
  status: GameStatus;
  max_boards: number;
  join_expires_at: string;
};

type BoardRow = {
  id: string;
  game_id: string;
  user_id: string;
  numbers: BoardNumbers;
  marked: BoardMarked;
  is_reach: boolean;
  is_bingo: boolean;
  created_at: string;
};

type CreateBoardRequestBody = {
  userName?: unknown;
};

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: { message } }, { status });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  const { gameId } = await params;

  let body: CreateBoardRequestBody;
  try {
    body = await request.json();
  } catch {
    return errorResponse("リクエストボディがJSONとして解釈できません。", 400);
  }

  const { userName } = body;
  if (typeof userName !== "string" || userName.trim().length === 0) {
    return errorResponse("userName は必須です。", 400);
  }

  const { data: gameData, error: gameError } = await supabaseAdmin
    .from("games")
    .select("id, status, max_boards, join_expires_at")
    .eq("id", gameId)
    .maybeSingle();

  if (gameError) {
    return errorResponse("ゲーム情報の取得に失敗しました。", 500);
  }

  if (!gameData) {
    return errorResponse("指定されたゲームが見つかりません。", 404);
  }

  const game = gameData as GameRow;

  if (new Date(game.join_expires_at).getTime() < Date.now()) {
    return errorResponse("このゲームの参加受付は終了しています。", 410);
  }

  if (game.status !== "open") {
    return errorResponse("このゲームは現在参加を受け付けていません。", 409);
  }

  const { count: boardCount, error: countError } = await supabaseAdmin
    .from("boards")
    .select("id", { count: "exact", head: true })
    .eq("game_id", gameId);

  if (countError) {
    return errorResponse("発行済み枚数の確認に失敗しました。", 500);
  }

  if ((boardCount ?? 0) >= game.max_boards) {
    return errorResponse("このゲームは満員です。", 409);
  }

  const { data: userData, error: userError } = await supabaseAdmin
    .from("users")
    .insert({ game_id: gameId, name: userName.trim() })
    .select("id, name")
    .single();

  if (userError || !userData) {
    return errorResponse("参加者の登録に失敗しました。", 500);
  }

  const { data: boardData, error: boardError } = await supabaseAdmin
    .from("boards")
    .insert({
      game_id: gameId,
      user_id: userData.id,
      numbers: generateBoardNumbers(),
      marked: createInitialMarked(),
      is_reach: false,
      is_bingo: false,
    })
    .select()
    .single();

  if (boardError || !boardData) {
    return errorResponse("ボードの発行に失敗しました。", 500);
  }

  const board = boardData as BoardRow;

  return NextResponse.json(
    {
      boardId: board.id,
      gameId: board.game_id,
      userId: board.user_id,
      userName: userData.name as string,
      numbers: board.numbers,
      marked: board.marked,
      isReach: board.is_reach,
      isBingo: board.is_bingo,
      createdAt: board.created_at,
    },
    { status: 201 }
  );
}
