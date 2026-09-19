import { cn } from "@/lib/utils";

type SparklineChartProps = {
  values: number[];
  /** Direction decides the stroke and fill colour. */
  direction: "up" | "down" | "flat";
  className?: string;
  /** Decorative by default; the numbers next to it carry the information. */
  label?: string;
};

const WIDTH = 100;
const HEIGHT = 40;

/**
 * Tiny inline-SVG area sparkline. Hand-rolled instead of Recharts so it renders on the
 * server, has no layout shift, and stays visually quiet.
 */
export function SparklineChart({ values, direction, className, label }: SparklineChartProps) {
  if (values.length < 2) {
    return <div className={cn("h-24 w-full", className)} aria-hidden="true" />;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = WIDTH / (values.length - 1);
  const points = values.map((v, i) => {
    const x = i * step;
    // Leave a little headroom so the line never touches the edges.
    const y = HEIGHT - 3 - ((v - min) / range) * (HEIGHT - 6);
    return [x, y] as const;
  });

  const line = points
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`)
    .join(" ");
  const area = `${line} L${WIDTH},${HEIGHT} L0,${HEIGHT} Z`;

  const stroke =
    direction === "up" ? "text-gain" : direction === "down" ? "text-loss" : "text-faint";
  const fill =
    direction === "up"
      ? "fill-gain-soft"
      : direction === "down"
        ? "fill-loss-soft"
        : "fill-canvas-deep";

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="none"
      className={cn("h-24 w-full", stroke, className)}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <path d={area} className={fill} stroke="none" />
      <path
        d={line}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
