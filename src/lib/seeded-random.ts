// シード固定のPRNG（mulberry32）。SSRとクライアントで必ず同じ配置を生成させ、
// hydrationの不一致を防ぐ。返す関数は呼ぶたびに [0, 1) の値を返す。
export function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
