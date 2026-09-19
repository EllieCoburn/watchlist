"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { SymbolMatch } from "@/lib/market-data/types";
import { cn } from "@/lib/utils";

type TickerComboboxProps = {
  id: string;
  name?: string;
  /** Controlled value. Omit to let the component manage its own state. */
  value?: string;
  onChange?: (value: string) => void;
  /** Called when a suggestion is picked. */
  onSelect?: (match: SymbolMatch) => void;
  defaultValue?: string;
  placeholder?: string;
  className?: string;
  required?: boolean;
  invalid?: boolean;
  describedBy?: string;
  autoFocus?: boolean;
};

const DEBOUNCE_MS = 180;

/**
 * Ticker input with search suggestions (ARIA combobox). Type a symbol or a company name;
 * pick with the arrow keys and Enter, or click. Suggestions come from /api/market/search.
 */
export function TickerCombobox({
  id,
  name = "ticker",
  value,
  onChange,
  onSelect,
  defaultValue = "",
  placeholder = "AAPL or Apple",
  className,
  required,
  invalid,
  describedBy,
  autoFocus,
}: TickerComboboxProps) {
  const controlled = value !== undefined;
  const [inner, setInner] = useState(defaultValue);
  const text = controlled ? value : inner;
  const [matches, setMatches] = useState<SymbolMatch[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [queryFor, setQueryFor] = useState("");
  const listId = useId();
  const abortRef = useRef<AbortController | null>(null);

  function setText(next: string) {
    const upper = next.toUpperCase();
    if (!controlled) setInner(upper);
    onChange?.(upper);
  }

  // Fetch suggestions while the list is open and the text differs from the last fetched query.
  useEffect(() => {
    if (!open) return;
    const q = text.trim();
    if (!q || q === queryFor) return;
    const timer = window.setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const res = await fetch(`/api/market/search?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!res.ok) throw new Error();
        const data = (await res.json()) as { matches: SymbolMatch[] };
        setMatches(data.matches);
        setQueryFor(q);
        setActive(data.matches.length ? 0 : -1);
      } catch {
        /* aborted or unavailable: keep whatever we had */
      }
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [open, text, queryFor]);

  function pick(match: SymbolMatch) {
    setText(match.symbol);
    setQueryFor(match.symbol);
    setOpen(false);
    setActive(-1);
    onSelect?.(match);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) setOpen(true);
      else if (matches.length) setActive((i) => (i + 1) % matches.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (matches.length) setActive((i) => (i - 1 + matches.length) % matches.length);
    } else if (e.key === "Enter") {
      if (open && active >= 0 && matches[active]) {
        e.preventDefault();
        pick(matches[active]);
      }
    } else if (e.key === "Escape") {
      if (open) {
        e.preventDefault();
        setOpen(false);
      }
    }
  }

  const showList = open && text.trim().length > 0 && matches.length > 0;

  return (
    <div className="relative">
      <input
        id={id}
        name={name}
        type="text"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList && active >= 0 ? `${listId}-${active}` : undefined}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        maxLength={10}
        required={required}
        placeholder={placeholder}
        value={text}
        autoFocus={autoFocus}
        onChange={(e) => {
          setText(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
        className={cn(
          "tabular h-11 w-full rounded-[var(--radius-sm)] border border-border bg-surface px-3 font-mono uppercase tracking-[0.04em] text-ink placeholder:font-sans placeholder:normal-case placeholder:tracking-normal placeholder:text-faint transition-colors duration-150 hover:border-border-strong focus:border-border-strong focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus aria-[invalid=true]:border-loss-text",
          className,
        )}
      />
      <ul
        id={listId}
        role="listbox"
        aria-label="Matching tickers"
        hidden={!showList}
        className="absolute inset-x-0 top-full z-30 mt-1 max-h-72 overflow-auto rounded-[var(--radius-sm)] border border-border bg-surface py-1 shadow-[var(--shadow-pop)]"
      >
        {matches.map((m, i) => (
          <li
            key={m.symbol}
            id={`${listId}-${i}`}
            role="option"
            aria-selected={i === active}
            onMouseDown={(e) => e.preventDefault()}
            onMouseEnter={() => setActive(i)}
            onClick={() => pick(m)}
            className={cn(
              "flex cursor-pointer items-baseline gap-3 px-3 py-2 text-sm",
              i === active ? "bg-surface-muted" : "",
            )}
          >
            <span className="font-mono font-semibold tracking-[0.04em] text-ink">{m.symbol}</span>
            <span className="truncate text-muted">{m.companyName}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
