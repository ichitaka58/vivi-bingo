import Link from "next/link";

const NAV_LINKS = [
  { href: "/admin/new", label: "ゲームを作成" },
  { href: "/#howto", label: "遊び方" },
  { href: "/admin", label: "管理画面" },
];

type SiteHeaderProps = {
  // navy: クリーム地の画面用（フッターと同じ紺の帯）
  // banner: 管理画面の赤いバナー（.admin-banner）の中に置き、背景を持たずバナーに溶け込ませる
  tone?: "navy" | "banner";
};

// 主催者向け画面（トップ・管理画面）の共通ヘッダー。参加者画面（/join, /boards）には置かない。
export default function SiteHeader({ tone = "navy" }: SiteHeaderProps) {
  const isBanner = tone === "banner";

  return (
    <header
      className={
        isBanner
          ? "w-full px-6 pt-2 font-round text-matsuri-cream-soft sm:px-9"
          : "w-full bg-matsuri-navy px-4 font-round text-matsuri-cream-soft sm:px-9"
      }
    >
      <div
        // banner はバナー内の見出し・ボタンと左右端をそろえるため幅を絞らない
        className={`flex h-14 w-full items-center justify-between gap-4 ${
          isBanner
            ? "border-b border-matsuri-cream-soft/25"
            : "mx-auto max-w-5xl"
        }`}
      >
        <Link
          href="/"
          className="shrink-0 font-heading text-lg leading-none font-extrabold"
        >
          ViVi! Bingo!
        </Link>

        <nav className="flex items-center gap-4 text-xs font-bold sm:gap-6 sm:text-sm">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="whitespace-nowrap underline-offset-4 hover:underline"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
