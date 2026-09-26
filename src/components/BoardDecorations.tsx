// 参加者ボード画面の背景に散らす飾り図形（丸・三角・角丸四角）。
// 親要素を relative にしておき、コンテンツより背面（z-0）に配置する。
export default function BoardDecorations() {
  return (
    <>
      <svg
        className="pointer-events-none absolute -top-3 -right-2 z-0"
        width="90"
        height="90"
        viewBox="0 0 90 90"
      >
        <circle cx="45" cy="45" r="30" fill="#E11D2E" opacity="0.18" />
      </svg>
      <svg
        className="pointer-events-none absolute top-10 -left-4 z-0"
        width="50"
        height="50"
        viewBox="0 0 50 50"
      >
        <polygon points="25,2 48,45 2,45" fill="#2F6FED" opacity="0.12" />
      </svg>
      <svg
        className="pointer-events-none absolute top-40 right-2 z-0"
        width="26"
        height="26"
        viewBox="0 0 26 26"
      >
        <circle cx="13" cy="13" r="13" fill="#FF3D81" opacity="0.22" />
      </svg>
      <svg
        className="pointer-events-none absolute bottom-28 left-1 z-0"
        width="34"
        height="34"
        viewBox="0 0 34 34"
      >
        <rect
          x="4"
          y="4"
          width="26"
          height="26"
          rx="8"
          fill="#FFC93C"
          opacity="0.2"
          transform="rotate(18 17 17)"
        />
      </svg>
    </>
  );
}
