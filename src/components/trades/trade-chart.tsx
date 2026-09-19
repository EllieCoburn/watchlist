"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatMoney, formatPrice } from "@/lib/finance/money";
import type { PricePoint } from "@/lib/market-data/types";

export type TradeChartLevels = {
  entry: number | null;
  target: number | null;
  stop: number | null;
  exit: number | null;
};

function fmtTick(t: number, spanMs: number): string {
  const d = new Date(t);
  if (spanMs <= 2 * 86_400_000)
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

type TooltipPayload = { payload?: PricePoint }[];

function ChartTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload }) {
  const p = payload?.[0]?.payload;
  if (!active || !p) return null;
  return (
    <div className="rounded-[var(--radius-sm)] border border-border bg-surface px-3 py-2 font-mono text-xs shadow-[var(--shadow-pop)]">
      <p className="text-muted">
        {new Date(p.t).toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })}
      </p>
      <p className="tabular mt-1 text-ink">{formatMoney(p.price)}</p>
    </div>
  );
}

/** Price over the trade's period with entry, target, stop and exit as labeled reference lines. */
export function TradeChart({
  ticker,
  points,
  levels,
  dataLabel,
}: {
  ticker: string;
  points: PricePoint[];
  levels: TradeChartLevels;
  dataLabel: string;
}) {
  if (points.length < 2) return null;
  const spanMs = points[points.length - 1].t - points[0].t;
  const prices = points.map((p) => p.price);
  const levelValues = [levels.entry, levels.target, levels.stop, levels.exit].filter(
    (v): v is number => v != null,
  );
  const min = Math.min(...prices, ...levelValues);
  const max = Math.max(...prices, ...levelValues);
  const pad = (max - min || 1) * 0.08;
  const refs: { key: string; value: number; label: string; color: string }[] = [];
  if (levels.entry != null)
    refs.push({
      key: "entry",
      value: levels.entry,
      label: `entry ${formatPrice(levels.entry)}`,
      color: "var(--color-ink)",
    });
  if (levels.target != null)
    refs.push({
      key: "target",
      value: levels.target,
      label: `target ${formatPrice(levels.target)}`,
      color: "var(--color-gain-text)",
    });
  if (levels.stop != null)
    refs.push({
      key: "stop",
      value: levels.stop,
      label: `stop ${formatPrice(levels.stop)}`,
      color: "var(--color-loss-text)",
    });
  if (levels.exit != null)
    refs.push({
      key: "exit",
      value: levels.exit,
      label: `exit ${formatPrice(levels.exit)}`,
      color: "var(--color-ink-secondary)",
    });

  return (
    <figure className="rounded-[var(--radius-lg)] border border-border/60 bg-surface p-5 shadow-[var(--shadow-card)] md:p-6">
      <figcaption className="flex items-baseline justify-between gap-4">
        <div>
          <p className="label-caps text-muted">Price over the trade</p>
          <p className="mt-1 text-sm text-muted">
            {ticker} · {dataLabel}
          </p>
        </div>
      </figcaption>
      <div
        className="mt-5 h-56 w-full"
        role="img"
        aria-label={`${ticker} price from ${formatMoney(points[0].price)} to ${formatMoney(points[points.length - 1].price)} over the trade period`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={points} margin={{ top: 8, right: 24, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="trade-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-ink)" stopOpacity={0.06} />
                <stop offset="100%" stopColor="var(--color-ink)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--color-border)" />
            <XAxis
              dataKey="t"
              type="number"
              domain={["dataMin", "dataMax"]}
              scale="time"
              tickFormatter={(t: number) => fmtTick(t, spanMs)}
              tick={{ fill: "var(--color-faint)", fontSize: 11, fontFamily: "var(--font-mono)" }}
              axisLine={false}
              tickLine={false}
              minTickGap={40}
            />
            <YAxis
              domain={[min - pad, max + pad]}
              tickFormatter={(v: number) => formatPrice(v)}
              tick={{ fill: "var(--color-faint)", fontSize: 11, fontFamily: "var(--font-mono)" }}
              axisLine={false}
              tickLine={false}
              width={56}
            />
            {refs.map((r) => (
              <ReferenceLine
                key={r.key}
                y={r.value}
                stroke={r.color}
                strokeDasharray="3 3"
                label={{
                  value: r.label,
                  position: "insideTopRight",
                  fill: r.color,
                  fontSize: 10,
                  fontFamily: "var(--font-mono)",
                }}
              />
            ))}
            <Tooltip content={<ChartTooltip />} cursor={{ stroke: "var(--color-border-strong)" }} />
            <Area
              type="monotone"
              dataKey="price"
              stroke="var(--color-ink)"
              strokeWidth={1.5}
              fill="url(#trade-fill)"
              dot={false}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      {refs.length > 0 ? (
        <ul
          className="mt-3 flex flex-wrap gap-x-5 gap-y-1 font-mono text-xs text-muted"
          aria-label="Reference levels"
        >
          {refs.map((r) => (
            <li key={r.key} className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="inline-block h-0 w-4 border-t border-dashed"
                style={{ borderColor: r.color }}
              />
              <span className="tabular">{r.label}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </figure>
  );
}
