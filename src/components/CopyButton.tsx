"use client";

import { useState } from "react";

type CopyButtonProps = {
  value: string;
  className?: string;
};

const DEFAULT_CLASS =
  "shrink-0 cursor-pointer rounded-full border-[1.5px] border-matsuri-border-calm px-3 py-1 font-heading text-[11px] font-bold text-matsuri-purple";

export default function CopyButton({ value, className }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // クリップボードAPIが使えない環境では何もしない
    }
  }

  return (
    <button type="button" onClick={handleCopy} className={className ?? DEFAULT_CLASS}>
      {copied ? "コピーしました" : "コピー"}
    </button>
  );
}
