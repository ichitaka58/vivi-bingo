"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { createSeededRandom } from "@/lib/seeded-random";

// リーチ中に右から左へ横切る金魚の群れ。小さめの金魚が密集したかたまりで
// ボードを通過する。奥（小さい・薄い・遅い）から
// 手前（大きい・濃い・速い）までの3層で構成し、視差で奥行きを出す。
type FishConfig = {
  top: string;
  width: number;
  height: number;
  opacity: number;
  delay: string;
  duration: string;
  wiggleDuration: string;
  bobDuration: string;
  color: string;
};

type FishLayer = {
  count: number;
  minWidth: number;
  maxWidth: number;
  opacity: number;
  minDuration: number;
  maxDuration: number;
};

const FISH_LAYERS: FishLayer[] = [
  { count: 56, minWidth: 24, maxWidth: 36, opacity: 0.3, minDuration: 1.9, maxDuration: 2.15 },
  { count: 44, minWidth: 38, maxWidth: 54, opacity: 0.52, minDuration: 1.65, maxDuration: 1.9 },
  { count: 26, minWidth: 58, maxWidth: 82, opacity: 0.78, minDuration: 1.45, maxDuration: 1.7 },
];

const FISH_COLORS = ["#FFC93C", "#E11D2E", "#B3121F", "#FF9E2C"];

// 群れの横の厚み（秒）。各個体のアニメーション開始をこの幅だけずらすことで、
// 速度をそろえたまま「かたまり」としての奥行きを作る。
const FISH_SCHOOL_SPREAD_S = 0.95;

function buildFishSchool(): FishConfig[] {
  const random = createSeededRandom(20260922);
  const school: FishConfig[] = [];

  FISH_LAYERS.forEach((layer) => {
    for (let index = 0; index < layer.count; index += 1) {
      // 縦位置は層ごとに等分してからジッターを足す。完全なランダムより偏りが出にくく、
      // ボード全面がまんべんなく埋まる。
      const top = ((index + random()) / layer.count) * 94 + 2;
      const width = Math.round(
        layer.minWidth + random() * (layer.maxWidth - layer.minWidth)
      );
      // 乱数2つの平均でベル型に寄せ、群れの中央を密に・前後を疎にする
      const spread = ((random() + random()) / 2) * FISH_SCHOOL_SPREAD_S;

      school.push({
        top: `${top.toFixed(1)}%`,
        width,
        height: Math.round(width / 2),
        opacity: layer.opacity,
        delay: `${spread.toFixed(2)}s`,
        duration: `${(
          layer.minDuration + random() * (layer.maxDuration - layer.minDuration)
        ).toFixed(2)}s`,
        wiggleDuration: `${(0.26 + random() * 0.14).toFixed(2)}s`,
        bobDuration: `${(0.8 + random() * 0.5).toFixed(2)}s`,
        color: FISH_COLORS[Math.floor(random() * FISH_COLORS.length)],
      });
    }
  });

  return school;
}

const FISH = buildFishSchool();

// 最後の1匹がボードを抜け切るまでの時間（ms）。これを過ぎたら魚群レイヤーごと外す。
// 各魚の上下動・尾びれの振りは無限ループのため、残しておくと画面外で動き続けて端末が発熱する。
const FISH_PASS_MS =
  Math.ceil(
    Math.max(
      ...FISH.map((fish) => parseFloat(fish.delay) + parseFloat(fish.duration))
    ) * 1000
  ) + 200;

// 眼を描き込むサイズのしきい値。これより小さい個体では潰れて見えないので省く
const FISH_EYE_MIN_WIDTH = 40;

// 金魚のシルエット（左向き）。胴体から尾びれまでを自己交差のない1本の輪郭で描く
const FISH_PATH =
  "M2,16 C2,10.5 11,6.5 26,6.5 C38,6.5 45,10 48,15 C52,10.5 57,6 62,3 " +
  "C59.5,9 58,13 57.5,16 C58,19 59.5,23 62,29 C57,26 52,21.5 48,17 " +
  "C45,22 38,25.5 26,25.5 C11,25.5 2,21.5 2,16 Z";

// 背びれと腹びれ。胴体と少し重なるため、輪郭とは別パスにして塗り分けの破綻を避ける
const FISH_FIN_PATH =
  "M23,8 C28,2.5 35,1.5 41,4 C35,5 29,6 26,8.5 Z " +
  "M26,24.5 C29,28.5 33,29.5 37,28 C33,26.5 30,25.5 28,24.5 Z";

type FishSchoolProps = {
  // falseの間もアニメーションは進めたまま、見た目だけ隠す（フラッシュ演出中など）
  visible: boolean;
};

// 1回分の魚群演出。マウントした瞬間から横切りが始まるので、再生し直すときは
// 呼び出し側でkeyを変えて再マウントする。
export default function FishSchool({ visible }: FishSchoolProps) {
  const [passed, setPassed] = useState(false);

  // 横切り終えたらレイヤーを外し、画面外で動き続けるアニメーションを止める
  useEffect(() => {
    const timeoutId = setTimeout(() => setPassed(true), FISH_PASS_MS);
    return () => clearTimeout(timeoutId);
  }, []);

  if (passed) {
    return null;
  }

  return (
    <div
      className={`board-fish-layer overflow-hidden rounded-xl ${visible ? "" : "invisible"}`}
    >
      {FISH.map((fish, index) => (
        <div
          key={index}
          className="board-fish-track"
          style={
            {
              top: fish.top,
              animationDelay: fish.delay,
              animationDuration: fish.duration,
              // 魚の実寸。左端から完全に抜け切る移動量の算出にCSS側で使う
              "--fish-width": `${fish.width}px`,
            } as CSSProperties
          }
        >
          <div
            className="board-fish"
            style={{
              width: fish.width,
              height: fish.height,
              marginTop: -fish.height / 2,
              opacity: fish.opacity,
              animationDuration: fish.bobDuration,
            }}
          >
            <svg
              viewBox="0 0 64 32"
              style={{ animationDuration: fish.wiggleDuration }}
            >
              <path d={FISH_PATH} fill={fish.color} />
              <path d={FISH_FIN_PATH} fill={fish.color} opacity="0.75" />
              {fish.width >= FISH_EYE_MIN_WIDTH && (
                <circle cx="11" cy="14" r="1.7" fill="#7A0D16" />
              )}
            </svg>
          </div>
        </div>
      ))}
    </div>
  );
}
