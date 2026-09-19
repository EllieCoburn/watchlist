/**
 * Hand-written Database types matching supabase/migrations.
 * Regenerate with:  supabase gen types typescript --project-id <id> > src/lib/supabase/types.ts
 * Keep this file in sync with DATABASE.md.
 */

export type TradeStatus = "planned" | "open" | "closed" | "cancelled";

type Timestamps = {
  created_at: string;
  updated_at: string;
};

export type ProfileRow = {
  id: string;
  display_name: string | null;
} & Timestamps;

export type WatchlistRow = {
  id: string;
  user_id: string;
  name: string;
  position: number;
} & Timestamps;

export type WatchlistItemRow = {
  id: string;
  watchlist_id: string;
  user_id: string;
  ticker: string;
  company_name: string | null;
  position: number;
  created_at: string;
};

export type TradeScenarioRow = {
  id: string;
  user_id: string;
  ticker: string;
  entry_price: string; // numeric columns arrive as strings
  capital: string;
  shares: string;
  target_price: string | null;
  stop_price: string | null;
  note: string | null;
} & Timestamps;

export type PriceTickRow = {
  symbol: string;
  t: string;
  price: string;
};

export type TradeRow = {
  id: string;
  user_id: string;
  ticker: string;
  company_name: string | null;
  status: TradeStatus;
  entry_price: string | null;
  entry_date: string | null;
  entry_time: string | null;
  shares: string | null;
  capital: string | null;
  target_price: string | null;
  stop_price: string | null;
  exit_price: string | null;
  exit_date: string | null;
  exit_time: string | null;
  notes: string | null;
  entry_reason: string | null;
  reflection: string | null;
  followed_plan: boolean | null;
  improvement: string | null;
  scenario_id: string | null;
} & Timestamps;

type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

type Table<Row, Insert, Update = Partial<Insert>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      profiles: Table<
        ProfileRow,
        Optional<ProfileRow, "display_name" | "created_at" | "updated_at">
      >;
      watchlists: Table<
        WatchlistRow,
        Optional<WatchlistRow, "id" | "position" | "created_at" | "updated_at">
      >;
      watchlist_items: Table<
        WatchlistItemRow,
        Optional<WatchlistItemRow, "id" | "company_name" | "position" | "created_at">
      >;
      trade_scenarios: Table<
        TradeScenarioRow,
        Optional<
          TradeScenarioRow,
          "id" | "target_price" | "stop_price" | "note" | "created_at" | "updated_at"
        >
      >;
      price_ticks: Table<PriceTickRow, PriceTickRow>;
      trades: Table<
        TradeRow,
        Optional<
          TradeRow,
          | "id"
          | "company_name"
          | "status"
          | "entry_price"
          | "entry_date"
          | "entry_time"
          | "shares"
          | "capital"
          | "target_price"
          | "stop_price"
          | "exit_price"
          | "exit_date"
          | "exit_time"
          | "notes"
          | "entry_reason"
          | "reflection"
          | "followed_plan"
          | "improvement"
          | "scenario_id"
          | "created_at"
          | "updated_at"
        >
      >;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      trade_status: TradeStatus;
    };
    CompositeTypes: Record<string, never>;
  };
};
