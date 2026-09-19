"use client";

import Link from "next/link";
import { useActionState, useId, useState, useTransition } from "react";
import { SubmitButton } from "@/components/auth/submit-button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Notice } from "@/components/ui/notice";
import {
  createWatchlist,
  deleteWatchlist,
  renameWatchlist,
  type ActionResult,
} from "@/lib/actions/watchlists";
import type { Watchlist } from "@/lib/data/watchlists";
import { cn } from "@/lib/utils";

type WatchlistSwitcherProps = {
  watchlists: Watchlist[];
  activeId: string | null;
};

/** Quiet row of watchlist tabs. Only rendered when there is more than one list. */
export function WatchlistTabs({ watchlists, activeId }: WatchlistSwitcherProps) {
  if (watchlists.length < 2) return null;
  return (
    <nav aria-label="Watchlists" className="-mb-px flex flex-wrap gap-x-6 gap-y-2">
      {watchlists.map((list) => {
        const active = list.id === activeId;
        return (
          <Link
            key={list.id}
            href={`/app/watch?list=${list.id}`}
            aria-current={active ? "page" : undefined}
            className={cn(
              "label-caps border-b pb-2 transition-colors duration-150",
              active ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink",
            )}
          >
            {list.name}
          </Link>
        );
      })}
    </nav>
  );
}

/** Rename and delete controls for the active list; sit next to the section heading. */
export function WatchlistManage({ watchlist }: { watchlist: Watchlist }) {
  const [mode, setMode] = useState<"idle" | "rename" | "delete">("idle");
  const [renameState, renameAction] = useActionState<ActionResult, FormData>(renameWatchlist, {});
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, startDelete] = useTransition();
  const inputId = useId();

  // Close the inline form once a rename succeeds (state adjustment during render, not in an effect).
  const [handledRename, setHandledRename] = useState(renameState);
  if (renameState !== handledRename) {
    setHandledRename(renameState);
    if (renameState.ok) setMode("idle");
  }

  function confirmDelete() {
    startDelete(async () => {
      const result = await deleteWatchlist(watchlist.id);
      if (result?.error) {
        setDeleteError(result.error);
        setMode("idle");
      }
    });
  }

  if (mode === "rename") {
    return (
      <form action={renameAction} className="flex flex-wrap items-center gap-2" noValidate>
        <input type="hidden" name="id" value={watchlist.id} />
        <label htmlFor={inputId} className="sr-only">
          Watchlist name
        </label>
        <input
          id={inputId}
          name="name"
          defaultValue={watchlist.name}
          maxLength={60}
          autoFocus
          className="h-9 rounded-[var(--radius-sm)] border border-border bg-surface px-3 text-sm text-ink focus:border-border-strong focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        />
        <SubmitButton variant="secondary" size="sm" pendingText="Saving…">
          Save
        </SubmitButton>
        <button
          type="button"
          onClick={() => setMode("idle")}
          className="label-caps px-2 text-muted hover:text-ink"
        >
          Cancel
        </button>
        {renameState.error ? (
          <p role="alert" className="basis-full text-sm text-loss-text">
            {renameState.error}
          </p>
        ) : null}
      </form>
    );
  }

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={() => setMode("rename")}
        className="label-caps text-muted transition-colors hover:text-ink"
      >
        Rename
      </button>
      <button
        type="button"
        onClick={() => setMode("delete")}
        className="label-caps text-muted transition-colors hover:text-loss-text"
      >
        Delete
      </button>
      {deleteError ? (
        <span role="alert" className="text-sm text-loss-text">
          {deleteError}
        </span>
      ) : null}
      <ConfirmDialog
        open={mode === "delete"}
        title={`Delete “${watchlist.name}”?`}
        description="The list and the tickers on it will be removed. Your trades and scenarios are not affected."
        confirmLabel="Delete watchlist"
        pending={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setMode("idle")}
      />
    </div>
  );
}

/** Dashed “+ New watchlist” pill that expands into a one-field form. */
export function NewWatchlistButton() {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState<ActionResult, FormData>(createWatchlist, {});
  const inputId = useId();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="label-caps inline-flex h-14 items-center gap-3 rounded-full border border-dashed border-border-strong px-6 text-ink-secondary transition-colors duration-150 hover:border-ink hover:text-ink"
      >
        <span aria-hidden="true">+</span> New watchlist
      </button>
    );
  }

  return (
    <form action={action} className="flex max-w-md flex-wrap items-center gap-2" noValidate>
      <label htmlFor={inputId} className="sr-only">
        New watchlist name
      </label>
      <input
        id={inputId}
        name="name"
        placeholder="Name, e.g. Long-term"
        maxLength={60}
        autoFocus
        className="h-11 min-w-56 flex-1 rounded-[var(--radius-sm)] border border-border bg-surface px-3 text-[0.9375rem] text-ink placeholder:text-faint focus:border-border-strong focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      />
      <SubmitButton pendingText="Creating…">Create</SubmitButton>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="label-caps px-2 text-muted hover:text-ink"
      >
        Cancel
      </button>
      {state.error ? (
        <Notice tone="error" className="basis-full">
          {state.error}
        </Notice>
      ) : null}
    </form>
  );
}
