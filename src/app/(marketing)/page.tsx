import { ButtonLink } from "@/components/ui/button";
import { Disclaimer } from "@/components/ui/disclaimer";
import { FeatureGrid, type Feature } from "@/components/marketing/feature-section";
import {
  SampleMetrics,
  SamplePerformance,
  SampleRiskReward,
  SampleScenario,
  SampleTrade,
  SampleWatchlist,
} from "@/components/marketing/feature-samples";
import { PricingPlaceholder } from "@/components/marketing/pricing-placeholder";
import { ProductPreview } from "@/components/marketing/product-preview";

const features: Feature[] = [
  {
    title: "Understand a trade before entering it",
    description:
      "Enter a price, an amount, a target and a stop. See the potential outcome in plain numbers before any money moves.",
    sample: <SampleScenario />,
  },
  {
    title: "Build and organize watchlists",
    description:
      "Keep the tickers you care about in calm, readable cards. As many lists and as many rows as you need.",
    sample: <SampleWatchlist />,
  },
  {
    title: "Model potential profit and loss",
    description:
      "Drag a hypothetical price and watch position value, gain and loss update instantly. Every scenario is clearly labeled as hypothetical.",
    sample: <SampleRiskReward />,
  },
  {
    title: "Record real trades",
    description:
      "Log entries, exits, and the reasoning behind them. Add a reflection when you are ready, never because a form demands it.",
    sample: <SampleTrade />,
  },
  {
    title: "Learn from your own performance",
    description:
      "Realized results over time, your best and worst tickers, and how often you follow your plan.",
    sample: <SamplePerformance />,
  },
  {
    title: "Simple analytics without financial jargon",
    description:
      "Win rate, average winner, average loser and expectancy, each with a one-line explanation in plain language.",
    sample: <SampleMetrics />,
  },
];

export default function LandingPage() {
  return (
    <>
      <section className="container-page pt-16 pb-12 md:pt-24 md:pb-16">
        <div className="max-w-3xl space-y-8">
          <h1 className="font-serif text-5xl leading-[1.02] tracking-tight text-ink md:text-7xl">
            See the trade before you make it.
          </h1>
          <p className="max-w-2xl text-lg leading-relaxed text-ink-secondary md:text-xl">
            Plan trades, understand potential outcomes, track what actually happened, and learn from
            your trading history without the clutter of traditional brokerage software.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/signup" size="lg">
              Create free account
            </ButtonLink>
            <ButtonLink href="/login" variant="secondary" size="lg">
              Log in
            </ButtonLink>
          </div>
        </div>
      </section>

      <section
        id="preview"
        className="container-page pb-20 md:pb-28"
        aria-labelledby="preview-heading"
      >
        <h2 id="preview-heading" className="sr-only">
          Product preview
        </h2>
        <ProductPreview />
      </section>

      <section
        id="features"
        className="bg-canvas-deep/40 py-20 md:py-28"
        aria-labelledby="features-heading"
      >
        <div className="container-page space-y-12">
          <div className="max-w-2xl space-y-4">
            <p className="label-caps text-muted">What it does</p>
            <h2
              id="features-heading"
              className="font-serif text-4xl leading-tight tracking-tight text-ink md:text-5xl"
            >
              Beautiful financial software for people who find normal financial software
              overwhelming.
            </h2>
          </div>
          <FeatureGrid features={features} />
        </div>
      </section>

      <section
        id="pricing"
        className="container-page py-20 md:py-28"
        aria-labelledby="pricing-heading"
      >
        <h2 id="pricing-heading" className="sr-only">
          Pricing
        </h2>
        <PricingPlaceholder />
        <Disclaimer className="mt-6" />
      </section>
    </>
  );
}
