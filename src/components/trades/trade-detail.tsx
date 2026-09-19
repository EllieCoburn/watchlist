import type { ReactNode } from "react";
import {
  formatMoney,
  formatShares,
  formatSignedMoney,
  formatSignedPercent,
} from "@/lib/finance/money";
import {
  tradeCapital,
  tradeHolding,
  tradePlannedReward,
  tradePlannedRisk,
  tradeRealizedPnl,
  tradeReturnPercent,
  tradeRiskReward,
  type Trade,
} from "@/lib/finance/trades";
import { cn } from "@/lib/utils";
import { formatTradeDate } from "./trade-list";
import { TradeStatusBadge } from "./trade-status-badge";

type TimelineEvent = {
  label: string;
  detail: string;
  when: string | null;
  tone: "ink" | "gain" | "loss" | "faint";
};

function timelineFor(t: Trade): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  events.push({
    label: t.status === "planned" ? "Planned" : "Entry",
    detail:
      t.entryPrice != null
        ? `${formatMoney(t.entryPrice)}${t.shares != null ? ` × ${formatShares(t.shares)} shares` : ""}`
        : "Price to be decided",
    when: t.entryDate
      ? `${formatTradeDate(t.entryDate)}${t.entryTime ? ` · ${t.entryTime}` : ""}`
      : null,
    tone: "ink",
  });
  if (t.targetPrice != null)
    events.push({ label: "Target", detail: formatMoney(t.targetPrice), when: null, tone: "gain" });
  if (t.stopPrice != null)
    events.push({ label: "Stop", detail: formatMoney(t.stopPrice), when: null, tone: "loss" });
  if (t.status === "closed") {
    events.push({
      label: "Exit",
      detail: t.exitPrice != null ? formatMoney(t.exitPrice) : "—",
      when: t.exitDate
        ? `${formatTradeDate(t.exitDate)}${t.exitTime ? ` · ${t.exitTime}` : ""}`
        : null,
      tone: "ink",
    });
  }
  if (t.status === "cancelled")
    events.push({ label: "Cancelled", detail: "Never entered", when: null, tone: "faint" });
  return events;
}

const DOT: Record<TimelineEvent["tone"], string> = {
  ink: "bg-ink",
  gain: "bg-gain",
  loss: "bg-loss",
  faint: "bg-faint",
};

function Metric({ label, children, tone }: { label: string; children: ReactNode; tone?: string }) {
  return (
    <div>
      <dt className="label-caps text-muted">{label}</dt>
      <dd className={cn("tabular mt-1.5 font-mono text-xl text-ink", tone)}>{children}</dd>
    </div>
  );
}

function Prose({ title, text }: { title: string; text: string | null }) {
  return (
    <div>
      <h3 className="text-sm font-medium text-ink-secondary">{title}</h3>
      {text ? (
        <p className="mt-1.5 whitespace-pre-wrap text-[0.9375rem] leading-relaxed text-ink">
          {text}
        </p>
      ) : (
        <p className="mt-1.5 text-sm text-muted">Nothing written yet.</p>
      )}
    </div>
  );
}

/** Fallback when no price history exists for the trade's period. */
export function TradeChartSlot({ trade }: { trade: Trade }) {
  return (
    <div className="flex min-h-40 items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-border-strong p-6 text-center">
      <p className="max-w-sm text-sm leading-relaxed text-muted">
        No price history is available for {trade.ticker} over this trade’s period yet.
      </p>
    </div>
  );
}

export function TradeDetail({ trade, chart }: { trade: Trade; chart?: ReactNode }) {
  const pnl = tradeRealizedPnl(trade);
  const ret = tradeReturnPercent(trade);
  const capital = tradeCapital(trade);
  const holding = tradeHolding(trade);
  const risk = tradePlannedRisk(trade);
  const reward = tradePlannedReward(trade);
  const rr = tradeRiskReward(trade);
  const pnlTone =
    pnl == null
      ? "text-muted"
      : pnl > 0
        ? "text-gain-text"
        : pnl < 0
          ? "text-loss-text"
          : "text-ink";

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <section
        aria-labelledby="timeline-heading"
        className="rounded-[var(--radius-lg)] border border-border/60 bg-surface p-6 shadow-[var(--shadow-card)] md:p-8"
      >
        <div className="flex items-center justify-between">
          <h2 id="timeline-heading" className="font-serif text-2xl leading-tight text-ink">
            Timeline
          </h2>
          <TradeStatusBadge status={trade.status} />
        </div>
        <ol className="mt-6 space-y-6 border-l border-border pl-6" role="list">
          {timelineFor(trade).map((ev, i) => (
            <li key={`${ev.label}-${i}`} className="relative">
              <span
                aria-hidden="true"
                className={cn(
                  "absolute top-1.5 -left-[1.6875rem] size-2.5 rounded-full ring-4 ring-surface",
                  DOT[ev.tone],
                )}
              />
              <p className="label-caps text-muted">{ev.label}</p>
              <p className="tabular mt-1 font-mono text-lg text-ink">{ev.detail}</p>
              {ev.when ? <p className="mt-0.5 font-mono text-xs text-muted">{ev.when}</p> : null}
            </li>
          ))}
        </ol>
      </section>

      <div className="space-y-6">
        <section
          aria-labelledby="numbers-heading"
          className="rounded-[var(--radius-lg)] border border-border/60 bg-surface p-6 shadow-[var(--shadow-card)] md:p-8"
        >
          <h2 id="numbers-heading" className="sr-only">
            Numbers
          </h2>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-3">
            <Metric label="Profit / loss" tone={pnlTone}>
              {pnl != null ? (
                <>
                  <span className="sr-only">{pnl > 0 ? "gain " : pnl < 0 ? "loss " : ""}</span>
                  {formatSignedMoney(pnl)}
                </>
              ) : (
                "—"
              )}
            </Metric>
            <Metric label="Return" tone={pnlTone}>
              {ret != null ? formatSignedPercent(ret) : "—"}
            </Metric>
            <Metric label="Held">{holding ? holding.label : "—"}</Metric>
            <Metric label="Capital">{capital != null ? formatMoney(capital) : "—"}</Metric>
            <Metric label="Shares">
              {trade.shares != null ? formatShares(trade.shares) : "—"}
            </Metric>
            <Metric label="Risk / reward">{rr != null ? `${rr.toFixed(1)} : 1` : "—"}</Metric>
          </dl>
          {risk != null || reward != null ? (
            <p className="mt-6 border-t border-border pt-4 text-sm leading-relaxed text-muted">
              Planned to risk {risk != null ? formatMoney(risk) : "—"} for a potential{" "}
              {reward != null ? formatMoney(reward) : "—"}.
            </p>
          ) : null}
        </section>

        {chart ?? <TradeChartSlot trade={trade} />}
      </div>

      <section
        aria-labelledby="notes-heading"
        className="rounded-[var(--radius-lg)] border border-border/60 bg-surface p-6 shadow-[var(--shadow-card)] md:p-8 lg:col-span-2"
      >
        <h2 id="notes-heading" className="font-serif text-2xl leading-tight text-ink">
          Notes and reflection
        </h2>
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <Prose title="Notes" text={trade.notes} />
          <Prose title="Why did I enter?" text={trade.entryReason} />
          <Prose title="What happened?" text={trade.reflection} />
          <Prose title="What would I do differently?" text={trade.improvement} />
          <div>
            <h3 className="text-sm font-medium text-ink-secondary">Did I follow my plan?</h3>
            <p className="mt-1.5 text-[0.9375rem] text-ink">
              {trade.followedPlan == null ? (
                <span className="text-sm text-muted">Not answered yet.</span>
              ) : trade.followedPlan ? (
                "Yes"
              ) : (
                "No"
              )}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
