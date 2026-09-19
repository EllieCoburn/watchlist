import Link from "next/link";
import { formatMoney, formatSignedMoney, formatSignedPercent } from "@/lib/finance/money";
import {
  tradePrimaryDate,
  tradeRealizedPnl,
  tradeReturnPercent,
  type Trade,
} from "@/lib/finance/trades";
import { cn } from "@/lib/utils";
import { TradeStatusBadge } from "./trade-status-badge";

export function formatTradeDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function pnlClass(pnl: number | null): string {
  if (pnl == null) return "text-faint";
  if (pnl > 0) return "text-gain-text";
  if (pnl < 0) return "text-loss-text";
  return "text-ink";
}

function PnlCell({ trade }: { trade: Trade }) {
  const pnl = tradeRealizedPnl(trade);
  const pct = tradeReturnPercent(trade);
  if (pnl == null) return <span className="text-faint">—</span>;
  return (
    <span className={cn("tabular", pnlClass(pnl))}>
      <span className="sr-only">{pnl > 0 ? "gain " : pnl < 0 ? "loss " : ""}</span>
      <span className="whitespace-nowrap">{formatSignedMoney(pnl)}</span>
      {pct != null ? (
        <span className="block whitespace-nowrap text-xs md:ml-2 md:inline">
          {formatSignedPercent(pct)}
        </span>
      ) : null}
    </span>
  );
}

/** Desktop table. Six columns only: ticker, entry, exit, P/L, date, status. */
export function TradeTable({ trades }: { trades: Trade[] }) {
  return (
    <div className="hidden overflow-hidden rounded-[var(--radius-lg)] border border-border/60 bg-surface shadow-[var(--shadow-card)] md:block">
      <table className="w-full text-sm">
        <thead>
          <tr className="label-caps border-b border-border text-left text-muted">
            <th scope="col" className="px-5 py-3 font-normal">
              Ticker
            </th>
            <th scope="col" className="px-5 py-3 text-right font-normal">
              Entry
            </th>
            <th scope="col" className="px-5 py-3 text-right font-normal">
              Exit
            </th>
            <th scope="col" className="px-5 py-3 text-right font-normal">
              Profit / loss
            </th>
            <th scope="col" className="px-5 py-3 font-normal">
              Date
            </th>
            <th scope="col" className="px-5 py-3 font-normal">
              Status
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border font-mono">
          {trades.map((t) => (
            <tr key={t.id} className="transition-colors hover:bg-surface-muted">
              <td className="px-5 py-4">
                <Link
                  href={`/app/trades/${t.id}`}
                  className="font-semibold tracking-[0.04em] text-ink underline-offset-4 hover:underline"
                >
                  {t.ticker}
                </Link>
                {t.companyName ? (
                  <span className="ml-3 hidden font-sans text-muted lg:inline">
                    {t.companyName}
                  </span>
                ) : null}
              </td>
              <td className="tabular px-5 py-4 text-right text-ink">
                {t.entryPrice != null ? formatMoney(t.entryPrice) : "—"}
              </td>
              <td className="tabular px-5 py-4 text-right text-ink">
                {t.exitPrice != null ? formatMoney(t.exitPrice) : "—"}
              </td>
              <td className="px-5 py-4 text-right">
                <PnlCell trade={t} />
              </td>
              <td className="px-5 py-4 text-muted">{formatTradeDate(tradePrimaryDate(t))}</td>
              <td className="px-5 py-4">
                <TradeStatusBadge status={t.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Mobile card. */
export function TradeCard({ trade }: { trade: Trade }) {
  return (
    <Link
      href={`/app/trades/${trade.id}`}
      className="block rounded-[var(--radius-lg)] border border-border/60 bg-surface p-5 shadow-[var(--shadow-card)] transition-colors hover:border-border-strong"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono font-semibold tracking-[0.04em] text-ink">{trade.ticker}</p>
          <p className="mt-0.5 text-sm text-muted">
            {trade.companyName ?? formatTradeDate(tradePrimaryDate(trade))}
          </p>
        </div>
        <TradeStatusBadge status={trade.status} />
      </div>
      <dl className="mt-4 grid grid-cols-3 gap-3 font-mono text-sm">
        <div>
          <dt className="label-caps text-muted">Entry</dt>
          <dd className="tabular mt-1 text-ink">
            {trade.entryPrice != null ? formatMoney(trade.entryPrice) : "—"}
          </dd>
        </div>
        <div>
          <dt className="label-caps text-muted">Exit</dt>
          <dd className="tabular mt-1 text-ink">
            {trade.exitPrice != null ? formatMoney(trade.exitPrice) : "—"}
          </dd>
        </div>
        <div>
          <dt className="label-caps text-muted">P / L</dt>
          <dd className="mt-1">
            <PnlCell trade={trade} />
          </dd>
        </div>
      </dl>
      <p className="mt-3 font-mono text-xs text-muted">
        {formatTradeDate(tradePrimaryDate(trade))}
      </p>
    </Link>
  );
}

export function TradeList({ trades }: { trades: Trade[] }) {
  return (
    <>
      <TradeTable trades={trades} />
      <ul className="space-y-3 md:hidden" role="list">
        {trades.map((t) => (
          <li key={t.id}>
            <TradeCard trade={t} />
          </li>
        ))}
      </ul>
    </>
  );
}
