import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type PageHeaderProps = {
  title: string;
  /** Small line rendered under the title, e.g. market status. */
  status?: ReactNode;
  /** Right-aligned slot, e.g. a time-range selector. */
  aside?: ReactNode;
  className?: string;
};

/** Large serif title with an optional status line and a right-aligned slot; hairline rule below. */
export function PageHeader({ title, status, aside, className }: PageHeaderProps) {
  return (
    <header className={cn("border-b border-border pb-8", className)}>
      <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
        <div className="space-y-3">
          <h1 className="font-serif text-4xl leading-none tracking-tight text-ink md:text-5xl">
            {title}
          </h1>
          {status ? <div className="text-muted">{status}</div> : null}
        </div>
        {aside ? <div className="flex flex-col items-start gap-3 md:items-end">{aside}</div> : null}
      </div>
    </header>
  );
}
