"use client";

import { useEffect, useRef } from "react";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  message: string;
  emoji?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmDisabled?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmDialog({
  open,
  title,
  message,
  emoji = "🎯",
  confirmLabel = "OK",
  cancelLabel = "キャンセル",
  confirmDisabled = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onCancel();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    confirmRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onCancel]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="confirm-backdrop fixed inset-0 z-50 flex items-center justify-center px-5"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        className="confirm-card w-full max-w-sm rounded-2xl border-[1.5px] border-matsuri-border-gold bg-white px-6 py-6 text-center font-round text-matsuri-navy"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="confirm-emoji mx-auto flex h-14 w-14 items-center justify-center rounded-full text-2xl">
          {emoji}
        </div>
        <h2
          id="confirm-dialog-title"
          className="mt-3 font-heading text-xl font-extrabold"
        >
          {title}
        </h2>
        <p className="mt-2 text-sm font-bold leading-relaxed text-matsuri-muted">
          {message}
        </p>
        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 cursor-pointer rounded-full border-[1.5px] border-matsuri-border-calm px-4 py-2.5 font-heading text-[13px] font-bold text-matsuri-purple"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            disabled={confirmDisabled}
            className="confirm-danger-btn flex-1 cursor-pointer rounded-full px-4 py-2.5 font-heading text-[13px] font-bold text-matsuri-cream-soft disabled:cursor-not-allowed disabled:opacity-50"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
