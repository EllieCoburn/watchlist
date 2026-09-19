import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { isSupabaseConfigured } from "@/lib/supabase/env";

type AuthCardProps = {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
};

export function AuthCard({ title, description, children, footer }: AuthCardProps) {
  const configured = isSupabaseConfigured();
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="font-serif text-4xl leading-none tracking-tight text-ink">{title}</h1>
        {description ? (
          <p className="text-[0.9375rem] leading-relaxed text-muted">{description}</p>
        ) : null}
      </div>
      {!configured ? (
        <Notice tone="info">
          Supabase is not configured for this environment yet. Copy <code>.env.example</code> to{" "}
          <code>.env.local</code> and add your project URL and anon key to enable sign in.
        </Notice>
      ) : null}
      <Card className="md:p-8">{children}</Card>
      {footer ? <div className="text-sm text-muted">{footer}</div> : null}
    </div>
  );
}
