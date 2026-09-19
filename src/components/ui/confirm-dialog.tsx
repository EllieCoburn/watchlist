"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Button } from "./button";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/** Native <dialog> confirmation: focus trapping, Escape and backdrop come from the browser. */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  pending,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onCancel}
      onClick={(e) => {
        if (e.target === ref.current) onCancel();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-[var(--radius-xl)] border border-border bg-surface p-0 text-ink shadow-[var(--shadow-pop)] backdrop:bg-ink/20"
    >
      <div className="space-y-5 p-6 md:p-8">
        <h2 className="font-serif text-2xl leading-tight">{title}</h2>
        <div className="text-[0.9375rem] leading-relaxed text-muted">{description}</div>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onCancel} disabled={pending}>
            Cancel
          </Button>
          <Button variant="danger" onClick={onConfirm} disabled={pending} aria-busy={pending}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
