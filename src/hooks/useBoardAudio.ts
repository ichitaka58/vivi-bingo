"use client";

import { useCallback, useEffect, useRef } from "react";

// リーチ音声（女性アニメ風「リ〜チ！」）。バナーが飛び込んで着地する頃に合わせて少し遅らせて再生する
const REACH_VOICE_SRC = "/sounds/reach.mp3";
const REACH_VOICE_DELAY_MS = 400;

// ビンゴ成立時の歓声＋拍手。クラッカー演出の発火と同時に再生する
const BINGO_CHEER_SRC = "/sounds/cheers_and_applause.mp3";

// 参加者ボードの効果音（リーチ音声・ビンゴ歓声）。
// reachAnimKeyの増加（＝新しいリーチLINE）に合わせてリーチ音声を自動で再生し、
// ビンゴ歓声は呼び出し側のタイミングで鳴らせるよう関数で返す。
// ブラウザの自動再生ブロック対策として、初回のユーザー操作で一度だけ
// 無音再生→即停止して各<audio>要素を解錠しておく。
export function useBoardAudio(reachAnimKey: number): {
  playBingoCheer: () => void;
} {
  const reachAudioRef = useRef<HTMLAudioElement | null>(null);
  const bingoAudioRef = useRef<HTMLAudioElement | null>(null);

  // リーチ音声・ビンゴ歓声の初期化と、自動再生ブロック対策の解錠。
  // 最初の pointerdown を1回だけ拾い、各音声を無音で play→pause して以降の play() を通す。
  useEffect(() => {
    const reachAudio = new Audio(REACH_VOICE_SRC);
    reachAudio.preload = "auto";
    reachAudioRef.current = reachAudio;
    const bingoAudio = new Audio(BINGO_CHEER_SRC);
    bingoAudio.preload = "auto";
    bingoAudioRef.current = bingoAudio;
    const audios = [reachAudio, bingoAudio];

    let unlocked = false;
    const unlock = () => {
      if (unlocked) {
        return;
      }
      unlocked = true;
      window.removeEventListener("pointerdown", unlock);
      audios.forEach((audio) => {
        const restoreMuted = audio.muted;
        audio.muted = true;
        audio
          .play()
          .then(() => {
            audio.pause();
            audio.currentTime = 0;
            audio.muted = restoreMuted;
          })
          .catch(() => {
            audio.muted = restoreMuted;
          });
      });
    };
    window.addEventListener("pointerdown", unlock);

    return () => {
      window.removeEventListener("pointerdown", unlock);
      audios.forEach((audio) => audio.pause());
      reachAudioRef.current = null;
      bingoAudioRef.current = null;
    };
  }, []);

  // 新しいリーチLINEができるたび（reachAnimKeyの増加）に、バナー着地の頃を狙って1回だけ再生。
  // 初回マウント時（reachAnimKey === 0）や、自動再生がブロックされた場合は何もしない。
  useEffect(() => {
    if (reachAnimKey === 0) {
      return;
    }
    const timeoutId = setTimeout(() => {
      const audio = reachAudioRef.current;
      if (!audio) {
        return;
      }
      audio.currentTime = 0;
      audio.play().catch(() => {});
    }, REACH_VOICE_DELAY_MS);
    return () => clearTimeout(timeoutId);
  }, [reachAnimKey]);

  const playBingoCheer = useCallback(() => {
    const audio = bingoAudioRef.current;
    if (!audio) {
      return;
    }
    audio.currentTime = 0;
    audio.play().catch(() => {});
  }, []);

  return { playBingoCheer };
}
