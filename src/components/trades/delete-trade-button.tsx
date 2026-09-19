"use client";

import { useState, useTransition } from "react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { deleteTrade } from "@/lib/actions/trades";

export function DeleteTradeButton({ id, ticker }: { id: string; ticker: string }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="label-caps text-muted transition-colors hover:text-loss-text"
      >
        Delete
      </button>
      {error ? (
        <span role="alert" className="text-sm text-loss-text">
          {error}
        </span>
      ) : null}
      <ConfirmDialog
        open={open}
        title={`Delete the ${ticker} trade?`}
        description="This removes the trade and its notes permanently. Analytics will update."
        confirmLabel="Delete trade"
        pending={pending}
        onCancel={() => setOpen(false)}
        onConfirm={() =>
          start(async () => {
            const r = await deleteTrade(id);
            if (r?.error) {
              setError(r.error);
              setOpen(false);
            }
          })
        }
      />
    </>
  );
}
