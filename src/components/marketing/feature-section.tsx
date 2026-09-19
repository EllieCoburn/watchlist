import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";

export type Feature = {
  title: string;
  description: string;
  /** Small visual sample rendered inside the card. */
  sample: ReactNode;
};

export function FeatureGrid({ features }: { features: Feature[] }) {
  return (
    <ul className="grid gap-6 md:grid-cols-2 xl:grid-cols-3" role="list">
      {features.map((feature) => (
        <li key={feature.title}>
          <Card className="flex h-full flex-col gap-6">
            <div className="rounded-[var(--radius-md)] bg-canvas p-5">{feature.sample}</div>
            <div className="space-y-2">
              <h3 className="font-serif text-2xl leading-tight text-ink">{feature.title}</h3>
              <p className="text-[0.9375rem] leading-relaxed text-muted">{feature.description}</p>
            </div>
          </Card>
        </li>
      ))}
    </ul>
  );
}
