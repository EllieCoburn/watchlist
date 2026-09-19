import { Card } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";

export function PricingPlaceholder() {
  return (
    <Card className="flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between md:p-10">
      <div className="space-y-2">
        <p className="label-caps text-muted">Pricing</p>
        <h3 className="font-serif text-3xl leading-tight text-ink">Free while we build.</h3>
        <p className="max-w-lg text-[0.9375rem] leading-relaxed text-muted">
          Every feature is included for early accounts. Paid plans will arrive later, and we will
          say so well in advance.
        </p>
      </div>
      <ButtonLink href="/signup">Create free account</ButtonLink>
    </Card>
  );
}
