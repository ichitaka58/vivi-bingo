import Link from "next/link";
import { Baloo_2, Fredoka, Nunito } from "next/font/google";

const baloo2 = Baloo_2({
  variable: "--font-baloo",
  weight: "variable",
  subsets: ["latin"],
});

const fredoka = Fredoka({
  variable: "--font-fredoka",
  weight: "variable",
  subsets: ["latin"],
});

const nunito = Nunito({
  variable: "--font-nunito",
  weight: "variable",
  subsets: ["latin"],
});

const COLUMN_LABELS = ["B", "I", "N", "G", "O"];
const COLUMN_COLORS = [
  "var(--color-matsuri-red)",
  "var(--color-matsuri-gold)",
  "var(--color-matsuri-navy)",
  "var(--color-matsuri-gold)",
  "var(--color-matsuri-red)",
];

// プレビュー用のサンプル盤面（col→row）。1行分を当選済みにして雰囲気を出す
const PREVIEW_NUMBERS: (number | null)[][] = [
  [4, 12, 7, 15, 2],
  [22, 18, 29, 16, 25],
  [31, 38, null, 44, 33],
  [52, 47, 59, 50, 60],
  [61, 70, 65, 74, 68],
];
const PREVIEW_MARKED: boolean[][] = [
  [true, false, false, true, false],
  [true, false, true, false, false],
  [true, false, true, false, false],
  [true, false, false, false, true],
  [true, false, false, true, false],
];

export default function Home() {
  return (
    <div
      className={`contents ${baloo2.variable} ${fredoka.variable} ${nunito.variable}`}
    >
      <div className="flex w-full flex-1 flex-col items-center justify-center bg-matsuri-cream px-4 py-16 font-round text-matsuri-navy">
        <div className="w-full max-w-lg text-center">
          <span className="inline-flex w-fit rounded-full bg-matsuri-red px-3 py-1 font-heading text-xs font-bold tracking-wide text-matsuri-cream-soft">
            BINGO PARTY
          </span>
          <h1 className="mt-4 font-heading text-6xl leading-none font-extrabold sm:text-7xl">
            ViVi! Bingo!
          </h1>
          <p className="mt-5 text-sm leading-relaxed font-bold text-matsuri-muted sm:text-base">
            URLとQRコードだけで参加できる、オンライン縁日ビンゴ。
            <br />
            ゲームを作って、みんなでリアルタイムに盛り上がろう。
          </p>

          <div className="mt-8 rounded-2xl border-[1.5px] border-matsuri-border-calm bg-white p-4 sm:mx-auto sm:w-64 sm:p-3">
            <div className="grid grid-cols-5 gap-1.5 sm:gap-1">
              {COLUMN_LABELS.map((label, index) => (
                <div
                  key={label}
                  className="flex items-end justify-center pb-1 font-heading text-xl leading-none font-extrabold sm:pb-0.5 sm:text-sm"
                  style={{ color: COLUMN_COLORS[index] }}
                >
                  {label}
                </div>
              ))}
              {PREVIEW_NUMBERS.flatMap((column, col) =>
                column.map((value, row) => {
                  const isFree = value === null;
                  const isMarked = PREVIEW_MARKED[col][row];
                  const tokenClass = `${
                    isMarked
                      ? isFree
                        ? "board-token board-token-free"
                        : "board-token board-token-marked"
                      : "board-token"
                  } sm:text-[12px]!`;
                  return (
                    <div
                      key={`${col}-${row}`}
                      className={`board-cell ${row === 0 ? "board-cell-reach" : ""}`}
                    >
                      <span className={tokenClass}>
                        {isFree ? "FREE" : value}
                      </span>
                    </div>
                  );
                }),
              )}
            </div>
          </div>

          <div className="mt-8 rounded-2xl border-[1.5px] border-matsuri-border-calm bg-white p-6 text-left">
            <ul className="flex flex-col gap-3.5 text-sm font-bold">
              <li className="flex items-start gap-2.5">
                <span aria-hidden>🎫</span>
                参加者はアプリ不要。URL・QRコードを開くだけでボードが発行されます
              </li>
              <li className="flex items-start gap-2.5">
                <span aria-hidden>🎯</span>
                抽選結果はリアルタイムで全員の画面に反映されます
              </li>
              <li className="flex items-start gap-2.5">
                <span aria-hidden>🏮</span>
                リーチ・ビンゴを盛り上げる祭り演出つき
              </li>
            </ul>
          </div>

          <Link
            href="/admin/new"
            className="matsuri-primary-btn mt-8 inline-flex items-center justify-center rounded-full px-10 py-3.5 font-heading text-base font-bold text-matsuri-cream-soft"
          >
            ゲームを作成する
          </Link>
        </div>
      </div>
    </div>
  );
}
