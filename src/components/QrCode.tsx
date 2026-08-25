"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

type QrCodeProps = {
  value: string;
  size?: number;
  withActions?: boolean;
};

export default function QrCode({ value, size = 200, withActions = false }: QrCodeProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [canShare] = useState(
    () => typeof navigator !== "undefined" && typeof navigator.share === "function"
  );

  useEffect(() => {
    let cancelled = false;
    async function generate() {
      try {
        const url = await QRCode.toDataURL(value, { width: size });
        if (!cancelled) {
          setDataUrl(url);
        }
      } catch {
        if (!cancelled) {
          setDataUrl(null);
        }
      }
    }
    generate();
    return () => {
      cancelled = true;
    };
  }, [value, size]);

  async function handleShare() {
    try {
      await navigator.share({ title: "ViVi! Bingo! 参加用URL", url: value });
    } catch {
      // 共有シートのキャンセル等。何もしない
    }
  }

  if (!dataUrl) {
    return (
      <div
        style={{ width: size, height: size }}
        className="flex items-center justify-center rounded bg-black/5 text-xs text-zinc-400 dark:bg-white/10"
      >
        QRコード生成中...
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2">
      {/* eslint-disable-next-line @next/next/no-img-element -- data URLなのでnext/imageの最適化対象外 */}
      <img src={dataUrl} alt="参加用QRコード" width={size} height={size} />
      {withActions && (
        <div className="flex gap-3 font-heading text-[11px] font-bold text-matsuri-purple">
          <a href={dataUrl} download="vivi-bingo-qr.png" className="underline underline-offset-2">
            保存
          </a>
          {canShare && (
            <button
              type="button"
              onClick={handleShare}
              className="cursor-pointer underline underline-offset-2"
            >
              共有
            </button>
          )}
        </div>
      )}
    </div>
  );
}
