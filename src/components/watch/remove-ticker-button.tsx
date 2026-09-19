"use client";

import { X } from "lucide-react";
import { useTransition } from "react";
import { removeTicker } from "@/lib/actions/watchlists";

type RemoveTickerButtonProps = {
  itemId: string;
  ticker: string;
  onRemoved: (itemId: string) => void;
  onError: (message: string) => void;
};

export function RemoveTickerButton({
  itemId,
  ticker,
  onRemoved,
  onError,
}: RemoveTickerButtonProps) {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      onRemoved(itemId);
      const result = await removeTicker(itemId);
      if (result.error) onError(result.error);
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      aria-label={`Remove ${ticker} from watchlist`}
      className="-mt-1 -mr-1 rounded-full p-1.5 text-faint transition-colors duration-150 hover:bg-canvas hover:text-ink disabled:opacity-50"
    >
      <X className="size-4" aria-hidden="true" />
    </button>
  );
}
