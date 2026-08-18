const STORAGE_KEY_PREFIX = "vivi-bingo:board:";

export function getStoredBoardId(gameId: string): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage.getItem(STORAGE_KEY_PREFIX + gameId);
}

export function setStoredBoardId(gameId: string, boardId: string): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(STORAGE_KEY_PREFIX + gameId, boardId);
}
