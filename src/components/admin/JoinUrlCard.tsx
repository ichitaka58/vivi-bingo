import QrCode from "@/components/QrCode";
import CopyButton from "@/components/CopyButton";

type JoinUrlCardProps = {
  joinUrlToken: string;
  joinExpiresAt: string;
};

// 管理者画面の参加用URLカード。QRコード・URL・コピーボタン・参加受付期限を表示する
export default function JoinUrlCard({
  joinUrlToken,
  joinExpiresAt,
}: JoinUrlCardProps) {
  const joinUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/join/${joinUrlToken}`
      : `/join/${joinUrlToken}`;

  return (
    <div className="rounded-2xl border-[1.5px] border-matsuri-border-calm bg-white px-5 py-4.5">
      <p className="font-heading text-2xl font-bold">参加用URL</p>
      <div className="mt-2.5 flex items-start gap-3.5">
        <div className="shrink-0 rounded-[10px] border-[1.5px] border-matsuri-border-calm p-1">
          <QrCode value={joinUrl} size={72} withActions />
        </div>
        <div className="flex flex-1 flex-col gap-2">
          <p className="rounded-lg bg-[#FBF8EE] px-2.5 py-2 font-mono text-[11px] leading-relaxed break-all text-matsuri-purple">
            {joinUrl}
          </p>
          <CopyButton
            value={joinUrl}
            className="w-fit shrink-0 cursor-pointer self-start rounded-full border-[1.5px] border-matsuri-border-calm px-3 py-1 font-heading text-[11px] font-bold text-matsuri-purple"
          />
          <p className="text-xs font-bold text-matsuri-muted">
            参加受付期限: {new Date(joinExpiresAt).toLocaleString("ja-JP")}
          </p>
        </div>
      </div>
    </div>
  );
}
