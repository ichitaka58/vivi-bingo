"use client";

import { useEffect, useRef, useState } from "react";

type RouletteDrawProps = {
  drawSeq: number;
  targetNumber: number | null;
  idleNumber: number | null;
  onRevealComplete: () => void;
};

const TOTAL_NUMBERS = 75;
const SPIN_DURATION_MS = 2400;
const REVEAL_PAUSE_MS = 900;

function randomNumber() {
  return Math.floor(Math.random() * TOTAL_NUMBERS) + 1;
}

export default function RouletteDraw({
  drawSeq,
  targetNumber,
  idleNumber,
  onRevealComplete,
}: RouletteDrawProps) {
  const [displayNumber, setDisplayNumber] = useState<number | null>(null);
  const [phase, setPhase] = useState<"idle" | "spinning" | "settle">("idle");
  const stageRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSeqRef = useRef(drawSeq);

  useEffect(() => {
    if (drawSeq === lastSeqRef.current || targetNumber === null) {
      return;
    }
    lastSeqRef.current = drawSeq;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    function spawnSparks() {
      const stage = stageRef.current;
      if (!stage) return;
      for (let i = 0; i < 10; i++) {
        const s = document.createElement("div");
        s.className = "admin-draw-spark fire";
        const angle = (Math.PI * 2 * i) / 10 + Math.random() * 0.4;
        const dist = 46 + Math.random() * 18;
        s.style.setProperty("--tx", `${Math.cos(angle) * dist}px`);
        s.style.setProperty("--ty", `${Math.sin(angle) * dist}px`);
        stage.appendChild(s);
        s.addEventListener("animationend", () => s.remove());
      }
    }

    function reveal() {
      setDisplayNumber(targetNumber);
      setPhase("settle");
      spawnSparks();
      timeoutRef.current = setTimeout(() => {
        setPhase("idle");
        onRevealComplete();
      }, REVEAL_PAUSE_MS);
    }

    if (reduceMotion) {
      reveal();
      return;
    }

    const start = performance.now();

    function tick(now: number) {
      setPhase("spinning");
      setDisplayNumber(randomNumber());
      const elapsed = now - start;
      if (elapsed >= SPIN_DURATION_MS) {
        reveal();
        return;
      }
      const t = elapsed / SPIN_DURATION_MS;
      const delay = 40 + Math.pow(t, 2.4) * 340;
      timeoutRef.current = setTimeout(() => {
        rafRef.current = requestAnimationFrame(tick);
      }, delay);
    }
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
    };
  }, [drawSeq, targetNumber, onRevealComplete]);

  const shownNumber = phase === "idle" ? idleNumber : displayNumber;

  return (
    <div
      ref={stageRef}
      className="relative flex h-24 w-36 items-center justify-center"
    >
      <div className={phase === "settle" ? "admin-draw-burst fire" : "admin-draw-burst"} />
      <p
        className={
          phase === "spinning"
            ? "admin-draw-number spinning"
            : phase === "settle"
              ? "admin-draw-number settle"
              : "admin-draw-number"
        }
      >
        {shownNumber ?? "-"}
      </p>
    </div>
  );
}
