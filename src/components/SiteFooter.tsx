import { Baloo_2, Nunito } from "next/font/google";

const baloo2 = Baloo_2({
  variable: "--font-baloo",
  weight: "variable",
  subsets: ["latin"],
});
const nunito = Nunito({
  variable: "--font-nunito",
  weight: "variable",
  subsets: ["latin"],
});

export default function SiteFooter() {
  return (
    <footer
      className={`${baloo2.variable} ${nunito.variable} mt-auto bg-matsuri-navy px-4 py-8 font-round text-matsuri-cream-soft`}
    >
      <div className="mx-auto flex w-full max-w-lg flex-col items-center gap-5 text-center">
        <div className="flex flex-col items-center gap-1">
          <span className="font-heading text-lg font-extrabold">
            ViVi! Bingo!
          </span>
          <span className="text-xs font-bold text-matsuri-cream-soft/70">
            URLとQRコードで遊ぶ、オンライン縁日ビンゴ
          </span>
        </div>

        <p className="max-w-sm text-[11px] leading-relaxed font-bold text-matsuri-cream-soft/60">
          個人が制作・運営する非公式のサービスです。ご利用は自己責任でお願いします。
          ゲームのデータは参加URLの有効期限後に削除されることがあります。
        </p>

        <div className="flex flex-col items-center gap-1 text-[10px] font-bold text-matsuri-cream-soft/50">
          <span>音声: VOICEVOX:ずんだもん</span>
          <span>© 2026 ViVi! Bingo!</span>
        </div>
      </div>
    </footer>
  );
}
