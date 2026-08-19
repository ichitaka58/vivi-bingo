import confetti from "canvas-confetti";

const CELEBRATION_DURATION_MS = 1500;
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
