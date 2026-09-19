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
import type { PerformancePoint } from "@/lib/finance/analytics";
import { formatMoney, formatSignedMoney } from "@/lib/finance/money";

function shortDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function compactMoney(v: number): string {
  const abs = Math.abs(v);
  const sign = v < 0 ? "−" : "";
  if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(abs >= 10_000 ? 0 : 1)}k`;
  return `${sign}$${abs.toFixed(0)}`;
}

type TooltipPayload = { payload?: PerformancePoint }[];

function ChartTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload }) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return (
    <div className="rounded-[var(--radius-sm)] border border-border bg-surface px-3 py-2 font-mono text-xs shadow-[var(--shadow-pop)]">
      <p className="text-muted">{shortDate(point.date)}</p>
      <p className="tabular mt-1 text-ink">Total {formatSignedMoney(point.cumulative)}</p>
      <p className="tabular text-muted">That day {formatSignedMoney(point.realized)}</p>
    </div>
  );
}

/** Cumulative realized profit/loss over time. One series, so no legend; the title names it. */
export function PerformanceChart({ points }: { points: PerformancePoint[] }) {
  if (points.length === 0) return null;
  const last = points[points.length - 1].cumulative;
  const summary = `Cumulative realized profit and loss across ${points.length} days, ending at ${formatMoney(last)}.`;

  return (
    <figure className="rounded-[var(--radius-lg)] border border-border/60 bg-surface p-5 shadow-[var(--shadow-card)] md:p-6">
      <figcaption className="flex items-baseline justify-between gap-4">
        <div>
          <p className="label-caps text-muted">Performance over time</p>
          <p className="mt-1 text-sm text-muted">
            Realized profit and loss, added up trade by trade.
          </p>
        </div>
        <p className="tabular font-mono text-xl text-ink">{formatSignedMoney(last)}</p>
      </figcaption>
      <div className="mt-5 h-56 w-full" role="img" aria-label={summary}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={points} margin={{ top: 8, right: 24, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="perf-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-ink)" stopOpacity={0.08} />
                <stop offset="100%" stopColor="var(--color-ink)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="0" />
            <XAxis
              dataKey="date"
              tickFormatter={shortDate}
              tick={{ fill: "var(--color-faint)", fontSize: 11, fontFamily: "var(--font-mono)" }}
              axisLine={false}
              tickLine={false}
              minTickGap={32}
            />
            <YAxis
              tickFormatter={compactMoney}
              tick={{ fill: "var(--color-faint)", fontSize: 11, fontFamily: "var(--font-mono)" }}
              axisLine={false}
              tickLine={false}
              width={52}
            />
            <ReferenceLine y={0} stroke="var(--color-border-strong)" />
            <Tooltip content={<ChartTooltip />} cursor={{ stroke: "var(--color-border-strong)" }} />
            <Area
              type="monotone"
              dataKey="cumulative"
              stroke="var(--color-ink)"
              strokeWidth={2}
              fill="url(#perf-fill)"
              dot={false}
              activeDot={{
                r: 4,
                stroke: "var(--color-surface)",
                strokeWidth: 2,
                fill: "var(--color-ink)",
              }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <details className="mt-4">
        <summary className="cursor-pointer text-xs text-muted underline-offset-4 hover:text-ink hover:underline">
          Show as a table
        </summary>
        <table className="mt-3 w-full font-mono text-xs">
          <thead>
            <tr className="label-caps text-left text-muted">
              <th className="py-1 font-normal">Date</th>
              <th className="py-1 text-right font-normal">That day</th>
              <th className="py-1 text-right font-normal">Total</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.date} className="border-t border-border">
                <td className="py-1 text-muted">{shortDate(p.date)}</td>
                <td className="tabular py-1 text-right text-ink">
                  {formatSignedMoney(p.realized)}
                </td>
                <td className="tabular py-1 text-right text-ink">
                  {formatSignedMoney(p.cumulative)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
