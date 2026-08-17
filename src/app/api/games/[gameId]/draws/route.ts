import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { judgeBingo } from "@/lib/bingo-judge";
import type { BoardMarked, BoardNumbers } from "@/lib/bingo-board";

type GameStatus = "draft" | "open" | "playing" | "finished";

type GameRow = {
  id: string;
  status: GameStatus;
};

type DrawNextNumberRow = {
  number: number;
  draw_order: number;
};

type BoardForDrawRow = {
  id: string;
  user_id: string;
  numbers: BoardNumbers;
  marked: BoardMarked;
  is_reach: boolean;
  is_bingo: boolean;
  users: { name: string } | null;
};

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: { message } }, { status });
}

function findCell(
  numbers: BoardNumbers,
  target: number
): { col: number; row: number } | null {
  for (let col = 0; col < numbers.length; col++) {
    const row = numbers[col].indexOf(target);
    if (row !== -1) {
      return { col, row };
    }
  }
  return null;
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  const { gameId } = await params;

  const { data: gameData, error: gameError } = await supabaseAdmin
    .from("games")
    .select("id, status")
    .eq("id", gameId)
    .maybeSingle();

  if (gameError) {
    return errorResponse("ゲーム情報の取得に失敗しました。", 500);
  }

  if (!gameData) {
    return errorResponse("指定されたゲームが見つかりません。", 404);
  }

  const game = gameData as GameRow;

  if (game.status === "finished") {
    return errorResponse("このゲームは終了しています。", 409);
  }

  const { data: drawnRows, error: drawError } = await supabaseAdmin.rpc(
    "draw_next_number",
    { p_game_id: gameId }
  );

  if (drawError) {
    return errorResponse("抽選に失敗しました。", 500);
  }

  const drawn = (drawnRows as DrawNextNumberRow[] | null) ?? [];
  if (drawn.length === 0) {
    return errorResponse("すべての番号が抽選済みです。", 409);
  }

  const { number, draw_order: drawOrder } = drawn[0];

  const { data: boardsData, error: boardsError } = await supabaseAdmin
    .from("boards")
    .select("id, user_id, numbers, marked, is_reach, is_bingo, users(name)")
    .eq("game_id", gameId);

  if (boardsError || !boardsData) {
    return errorResponse("ボード情報の取得に失敗しました。", 500);
  }

  const boards = boardsData as unknown as BoardForDrawRow[];
  const now = new Date().toISOString();

  const newlyReached: { boardId: string; userId: string; userName: string }[] =
    [];
  const newlyBingo: { boardId: string; userId: string; userName: string }[] =
    [];

  const updates = boards.flatMap((board) => {
    const cell = findCell(board.numbers, number);
    if (!cell) {
      return [];
    }

    const marked = board.marked.map((column) => [...column]);
    marked[cell.col][cell.row] = true;

    const judged = judgeBingo(marked);
    const userName = board.users?.name ?? "";

    if (judged.isReach && !board.is_reach) {
      newlyReached.push({ boardId: board.id, userId: board.user_id, userName });
    }
    if (judged.isBingo && !board.is_bingo) {
      newlyBingo.push({ boardId: board.id, userId: board.user_id, userName });
    }

    return [
      supabaseAdmin
        .from("boards")
        .update({
          marked,
          is_reach: judged.isReach,
          is_bingo: judged.isBingo,
          ...(judged.isReach && !board.is_reach ? { reached_at: now } : {}),
          ...(judged.isBingo && !board.is_bingo ? { bingo_at: now } : {}),
        })
        .eq("id", board.id),
    ];
  });

  const updateResults = await Promise.all(updates);
  const updateError = updateResults.find((result) => result.error);
  if (updateError) {
    return errorResponse("ボードの更新に失敗しました。", 500);
  }

  return NextResponse.json(
    {
      number,
      drawOrder,
      newlyReached,
      newlyBingo,
    },
    { status: 201 }
  );
}
