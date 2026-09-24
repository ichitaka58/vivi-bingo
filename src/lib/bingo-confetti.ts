import confetti from "canvas-confetti";

// 歓声（cheers_and_applause.mp3 ≈4.1s）に合わせた長さ。噴出終了後も紙吹雪が落ちきるまで1〜2秒残るので、音より少し短めにしている
const CELEBRATION_DURATION_MS = 3500;
const COLORS = ["#ffd700", "#ffffff", "#b8860b"];

// 画面左右下からクラッカーのように紙吹雪を連射する
export function fireBingoCelebration(): () => void {
  let cancelled = false;
  const end = Date.now() + CELEBRATION_DURATION_MS;

  function frame() {
    if (cancelled) {
      return;
    }
    confetti({
      particleCount: 3,
      angle: 60,
      spread: 55,
      startVelocity: 55,
      origin: { x: 0, y: 1 },
      colors: COLORS,
    });
    confetti({
      particleCount: 3,
      angle: 120,
      spread: 55,
      startVelocity: 55,
      origin: { x: 1, y: 1 },
      colors: COLORS,
    });

    if (Date.now() < end) {
      requestAnimationFrame(frame);
    }
  }

  frame();

  return () => {
    cancelled = true;
  };
}
