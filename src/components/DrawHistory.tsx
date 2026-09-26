"use client";

import { useEffect, useRef } from "react";

export type DrawEntry = {
  number: number;
  drawOrder: number;
};

type DrawHistoryProps = {
  draws: DrawEntry[];
};

// 参加者ボード上部の抽選番号一覧。横スクロールで並べ、最新の番号を強調する
export default function DrawHistory({ draws }: DrawHistoryProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // 抽選履歴が増えるたびに横スクロールを右端（最新）まで動かす
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) {
      return;
    }
    el.scrollLeft = el.scrollWidth;
  }, [draws.length]);

  if (draws.length === 0) {
    return null;
  }

  return (
    <div className="relative rounded-2xl border-2 border-matsuri-border-gold bg-white pt-6 pr-3 pb-3 pl-3">
      <span className="absolute top-2 left-3.5 font-heading text-[10px] font-bold tracking-widest text-matsuri-label">
        抽選番号
      </span>
      <div
        ref={scrollRef}
        className="flex items-center gap-2.5 overflow-x-auto py-1.5"
      >
        {draws.map((draw, index) => {
          const isLatest = index === draws.length - 1;
          return (
            <div
              key={draw.number}
              className={
                isLatest ? "board-chip board-chip-latest" : "board-chip"
              }
            >
              {draw.number}
            </div>
          );
        })}
      </div>
    </div>
  );
}
