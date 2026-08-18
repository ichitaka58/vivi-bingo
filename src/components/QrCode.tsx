"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

type QrCodeProps = {
  value: string;
  size?: number;
};

export default function QrCode({ value, size = 200 }: QrCodeProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

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

  // eslint-disable-next-line @next/next/no-img-element -- data URLなのでnext/imageの最適化対象外
  return <img src={dataUrl} alt="参加用QRコード" width={size} height={size} />;
}
