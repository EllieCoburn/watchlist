import type { Metadata } from "next";
import { IBM_Plex_Mono, Inter, Instrument_Serif } from "next/font/google";
import "./globals.css";

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: {
    default: "Watchlist",
    template: "%s · Watchlist",
  },
  description:
    "Plan trades, understand potential outcomes, track what actually happened, and learn from your trading history without the clutter.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${instrumentSerif.variable} ${inter.variable} ${plexMono.variable} h-full`}
    >
      <body className="flex min-h-full flex-col">
        <nav aria-label="Skip link">
          <a
            href="#main"
            className="sr-only z-50 rounded-[var(--radius-sm)] bg-ink px-3 py-2 text-sm text-accent-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
          >
            Skip to content
          </a>
        </nav>
        {children}
      </body>
    </html>
  );
}
