import type { CSSProperties } from "react";

// ビンゴ演出: 中央のBINGO!!文字の周りに飛び散る紙吹雪風の粒
type SparkConfig = {
  tx: number;
  ty: number;
  color: string;
  delay: string;
  shape: "dot" | "chip";
};

const BINGO_SPARKS: SparkConfig[] = [
  { tx: 0, ty: -100, color: "#FFD700", delay: "0.04s", shape: "dot" },
  { tx: 72, ty: -72, color: "#E11D2E", delay: "0.08s", shape: "chip" },
  { tx: 100, ty: 0, color: "#FFC93C", delay: "0.02s", shape: "dot" },
  { tx: 72, ty: 72, color: "#2F6FED", delay: "0.10s", shape: "chip" },
  { tx: 0, ty: 100, color: "#E11D2E", delay: "0.06s", shape: "dot" },
  { tx: -72, ty: 72, color: "#FFD700", delay: "0.12s", shape: "chip" },
  { tx: -100, ty: 0, color: "#FFC93C", delay: "0.03s", shape: "dot" },
  { tx: -72, ty: -72, color: "#E11D2E", delay: "0.09s", shape: "chip" },
];

export default function BingoBurst() {
  return (
    <div className="board-bingo-burst">
      <div className="board-bingo-spark-field">
        {BINGO_SPARKS.map((spark, index) => (
          <div
            key={index}
            className={`board-bingo-spark ${spark.shape}`}
            style={
              {
                "--tx": `${spark.tx}px`,
                "--ty": `${spark.ty}px`,
                background: spark.color,
                animationDelay: spark.delay,
              } as CSSProperties
            }
          />
        ))}
      </div>
      <span className="board-bingo-text">BINGO!!</span>
    </div>
  );
}
