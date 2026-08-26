// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { getMyGameIds, addMyGameId } from "@/lib/my-games";

const STORAGE_KEY = "vivi-bingo:my-games";
const MAX_ENTRIES = 50;

beforeEach(() => {
  window.localStorage.clear();
});

describe("getMyGameIds", () => {
  it("未保存の場合は空配列を返す", () => {
    expect(getMyGameIds()).toEqual([]);
  });

  it("保存されたJSONが配列でない場合は空配列を返す", () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ foo: "bar" }));
    expect(getMyGameIds()).toEqual([]);
  });

  it("壊れたJSONの場合は空配列を返す", () => {
    window.localStorage.setItem(STORAGE_KEY, "not-json{");
    expect(getMyGameIds()).toEqual([]);
  });

  it("文字列以外の要素は除外する", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(["game-1", 42, null, "game-2"])
    );
    expect(getMyGameIds()).toEqual(["game-1", "game-2"]);
  });
});

describe("addMyGameId", () => {
  it("追加したgameIdが先頭に入る", () => {
    addMyGameId("game-1");
    addMyGameId("game-2");
    expect(getMyGameIds()).toEqual(["game-2", "game-1"]);
  });

  it("既存のgameIdを追加すると重複せず先頭に移動する", () => {
    addMyGameId("game-1");
    addMyGameId("game-2");
    addMyGameId("game-1");
    expect(getMyGameIds()).toEqual(["game-1", "game-2"]);
  });

  it(`件数が${MAX_ENTRIES}件を超えると古いものから切り詰められる`, () => {
    for (let i = 0; i < MAX_ENTRIES + 5; i++) {
      addMyGameId(`game-${i}`);
    }
    const ids = getMyGameIds();
    expect(ids).toHaveLength(MAX_ENTRIES);
    expect(ids[0]).toBe(`game-${MAX_ENTRIES + 4}`);
    expect(ids).not.toContain("game-0");
    expect(ids).not.toContain("game-4");
  });
});
