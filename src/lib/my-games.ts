const STORAGE_KEY = "vivi-bingo:my-games";
const MAX_ENTRIES = 50;

export function getMyGameIds(): string[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === "string")
      : [];
  } catch {
    return [];
  }
}

export function addMyGameId(gameId: string): void {
  if (typeof window === "undefined") {
    return;
  }
  const deduped = [gameId, ...getMyGameIds().filter((id) => id !== gameId)];
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(deduped.slice(0, MAX_ENTRIES))
  );
}
