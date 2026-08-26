// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { getStoredBoardId, setStoredBoardId } from "@/lib/board-storage";

beforeEach(() => {
  window.localStorage.clear();
});

describe("board-storage", () => {
  it("未保存の場合はnullを返す", () => {
    expect(getStoredBoardId("game-1")).toBeNull();
  });

  it("保存したboardIdを同じgameIdで復元できる", () => {
    setStoredBoardId("game-1", "board-abc");
    expect(getStoredBoardId("game-1")).toBe("board-abc");
  });

  it("gameIdごとにスコープされ、別のgameIdとは混同しない", () => {
    setStoredBoardId("game-1", "board-abc");
    setStoredBoardId("game-2", "board-xyz");
    expect(getStoredBoardId("game-1")).toBe("board-abc");
    expect(getStoredBoardId("game-2")).toBe("board-xyz");
  });

  it("同じgameIdに再度保存すると上書きされる", () => {
    setStoredBoardId("game-1", "board-abc");
    setStoredBoardId("game-1", "board-new");
    expect(getStoredBoardId("game-1")).toBe("board-new");
  });
});
