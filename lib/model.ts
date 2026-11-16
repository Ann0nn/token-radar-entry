// The value model for token-radar-01.
//
// WHAT THE BOARD RANKS
// Every protocol in the snapshot that records no token (both gecko_id and
// symbol null) and is not an exchange, a bridge, a wrapped or staked product,
// or a versioned copy — the watchlist's own visible-field rule, applied to the
// whole snapshot. That is 201 protocols: the 40 on the watchlist plus 161
// below the $50M floor. The rule matters: ranked on raw TVL alone, the board
// would be topped by exchanges (Bybit, Bitfinex) and wrapped products (WBTC,
// Binance staked ETH) that record no token only because they are not protocols
// that issue one. They are set aside, and the board ranks the protocols a
// reader can actually farm.
//
// THE IMPLIED VALUE, IN ONE LINE
//   implied_value_usd = tvl_usd x BASE x GROWTH x MATURITY
//
// BASE — the snapshot's own multiple. Take every protocol in the snapshot
// that records a token, has a market cap, and holds at least $50M of TVL
// (52 of them), and take the median of mcap_usd / tvl_usd. On this snapshot
// that median is about 0.08: a token-trading protocol's circulating market
// cap is typically about 8% of its TVL. The multiple is computed from the
// snapshot at run time, never hardcoded, and the median (not the mean) is
// used because a few ratios run to 10x and would drag a mean with them.
// It is a conservative read — circulating market cap, not fully diluted
// value — and the dashboard says so. Per-category multiples were considered
// and rejected: the largest categories on the board (Risk Curators, 34 rows;
// Derivatives, 13) have zero token-trading protocols in the snapshot, so a
// category multiple would be noise for most of the board.
//
// GROWTH — the seven-day TVL change, clamped. change_7d is a percentage;
// a protocol up 4,448% in a week and one up 200% both read as strong, not
// as 44x and 2x, so the weekly change is clamped to [-50%, +200%] and the
// multiplier is 1 + 0.5 x clamped change: 0.75 for a protocol halving in a
// week, 2.0 for one tripling. A null change reads as flat (1.0).
//
// MATURITY — how long the protocol has run with no token. A protocol that
// has held TVL for two years without issuing a token has a longer record to
// price than one listed last month, so the multiplier rises from 1.0 at
// listing to 1.25 at two years and stays there. A null listed_at reads as
// unseasoned (1.0).
//
// No name is ever hardcoded: every input is one of the snapshot's ten
// fields, and the same formula scores every row. Rows sort by implied value
// descending, ties broken by TVL then slug, so the board is deterministic.

import { farmStepsFor } from './farm.ts';

export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The gate's own caps, so the model never writes a board the gate refuses. */
export const MIN_ROWS = 100;
export const MAX_ROWS = 4_000;
export const MAX_VALUE_USD = 100_000_000_000_000;
export const MIN_STEP_CHARS = 20;
export const MAX_STEP_CHARS = 600;

/** Categories the watchlist rule keeps out, and the exchange names it bars. */
const EXCLUDED_CATEGORIES = new Set([
  'Bridge',
  'Canonical Bridge',
  'Liquid Staking',
  'Liquid Restaking',
  'Restaked BTC',
  'CEX',
]);
const EXCHANGE_NAMES = new Set([
  'Binance',
  'Coinbase',
  'Bybit',
  'Kraken',
  'Bitget',
  'OKX',
  'Bitfinex',
  'Gemini',
]);
const VERSION_SUFFIX = /\s(V2|v2|V3|v3|2\.0|3\.0)$/;
const WRAPPED_WORD = /\b(wrapped|staked|staking)\b/i;

/** A protocol records no token when DefiLlama carries neither id nor symbol. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.gecko_id === null && p.symbol === null;
}

/**
 * The watchlist's visible-field rule: true when the protocol is an exchange,
 * a bridge, a wrapped or staked product, or a versioned copy. parentProtocol
 * is not one of the snapshot's ten fields, so this is the rule as the
 * snapshot itself can state it.
 */
export function isExcludedProduct(p: SnapshotProtocol): boolean {
  if (p.category !== null && EXCLUDED_CATEGORIES.has(p.category)) return true;
  if (VERSION_SUFFIX.test(p.name)) return true;
  if (WRAPPED_WORD.test(p.name)) return true;
  const firstWord = p.name.split(' ')[0];
  if (firstWord !== undefined && EXCHANGE_NAMES.has(firstWord)) return true;
  return false;
}

/** Rankable = pre-token and not an excluded product. */
export function isRankable(p: SnapshotProtocol): boolean {
  return isPreToken(p) && !isExcludedProduct(p);
}

/** Whole days from listed_at to the snapshot date, or null when unlisted. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const start = Date.parse(`${listedAt}T00:00:00Z`);
  const end = Date.parse(`${asOf}T00:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return null;
  return Math.floor((end - start) / 86_400_000);
}

function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x;
}

/** Median of a non-empty list of numbers. */
export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid] as number;
  return (((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2);
}

/**
 * The base multiple: the median mcap/TVL of the snapshot's token-trading
 * protocols with at least $50M of TVL. Returns the multiple and how many
 * protocols it was measured over, so the dashboard can say both.
 */
export function baseMultiple(snapshot: Snapshot): { multiple: number; measuredOver: number } {
  const ratios: number[] = [];
  for (const p of snapshot.protocols) {
    if (p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd >= snapshot.floor_usd) {
      ratios.push(p.mcap_usd / p.tvl_usd);
    }
  }
  if (ratios.length === 0) return { multiple: 0.08, measuredOver: 0 };
  return { multiple: median(ratios), measuredOver: ratios.length };
}

export interface ValueBreakdown {
  implied: number;
  growthPct: number | null;
  growthMultiplier: number;
  maturityMultiplier: number;
  age: number | null;
}

/**
 * implied = TVL x base x growth x maturity, rounded to whole dollars and
 * capped at the gate's maximum. growthPct is the raw weekly change in
 * percent (null when unreported); the multipliers are what the dashboard
 * shows beside each row.
 */
export function impliedValue(
  p: SnapshotProtocol,
  asOf: string,
  base: number,
): ValueBreakdown {
  const weekly = p.change_7d === null ? 0 : p.change_7d / 100;
  const growthMultiplier = 1 + 0.5 * clamp(weekly, -0.5, 2.0);
  const age = ageDays(asOf, p.listed_at);
  const maturityMultiplier = age === null ? 1 : 1 + 0.25 * (Math.min(age, 730) / 730);
  const raw = p.tvl_usd * base * growthMultiplier * maturityMultiplier;
  const implied = Math.max(1, Math.min(MAX_VALUE_USD, Math.round(raw)));
  return { implied, growthPct: p.change_7d, growthMultiplier, maturityMultiplier, age };
}

export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  listed_at: string | null;
  token_status: 'pre-token';
  on_watchlist: boolean;
  age_days: number | null;
  implied_value_usd: number;
  model: {
    base_multiple: number;
    growth_multiplier: number;
    maturity_multiplier: number;
  };
  farm_steps: string[];
}

export interface LiveComparable {
  slug: string;
  name: string;
  category: string | null;
  tvl_usd: number;
  mcap_usd: number;
  multiple: number;
}

export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  board_size: number;
  watchlist_size: number;
  base_multiple: number;
  base_measured_over: number;
  total_implied_usd: number;
  rows: BoardRow[];
  live: LiveComparable[];
}

/** The token-trading protocols the base multiple was measured over, top 16 by TVL. */
export function liveComparables(snapshot: Snapshot): LiveComparable[] {
  const live = snapshot.protocols
    .filter((p) => p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd >= snapshot.floor_usd)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd as number,
      multiple: (p.mcap_usd as number) / p.tvl_usd,
    }))
    .sort((a, b) => b.tvl_usd - a.tvl_usd);
  return live.slice(0, 16);
}

/**
 * Build the board: every rankable protocol, scored, sorted by implied value
 * descending (ties by TVL, then slug), ranked 1..N. The watchlist is always
 * covered because every watchlist slug is rankable by the same rule.
 */
export function buildBoard(snapshot: Snapshot): { board: BoardRow[]; radar: RadarData } {
  const { multiple: base, measuredOver } = baseMultiple(snapshot);
  const watchlist = new Set(snapshot.watchlist);
  const scored = snapshot.protocols
    .filter(isRankable)
    .map((p) => ({ p, value: impliedValue(p, snapshot.as_of, base) }));
  scored.sort((a, b) => {
    if (b.value.implied !== a.value.implied) return b.value.implied - a.value.implied;
    if (b.p.tvl_usd !== a.p.tvl_usd) return b.p.tvl_usd - a.p.tvl_usd;
    return a.p.slug < b.p.slug ? -1 : 1;
  });
  const board: BoardRow[] = scored.map(({ p, value }, i) => ({
    rank: i + 1,
    slug: p.slug,
    name: p.name,
    category: p.category,
    chains: p.chains,
    tvl_usd: p.tvl_usd,
    change_7d: p.change_7d,
    listed_at: p.listed_at,
    token_status: 'pre-token',
    on_watchlist: watchlist.has(p.slug),
    age_days: value.age,
    implied_value_usd: value.implied,
    model: {
      base_multiple: base,
      growth_multiplier: round3(value.growthMultiplier),
      maturity_multiplier: round3(value.maturityMultiplier),
    },
    farm_steps: farmStepsFor(p),
  }));
  const totalImplied = board.reduce((sum, row) => sum + row.implied_value_usd, 0);
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    board_size: board.length,
    watchlist_size: snapshot.watchlist.length,
    base_multiple: base,
    base_measured_over: measuredOver,
    total_implied_usd: totalImplied,
    rows: board,
    live: liveComparables(snapshot),
  };
  return { board, radar };
}

function round3(x: number): number {
  return Math.round(x * 1000) / 1000;
}

/** Parse and minimally validate the snapshot JSON. */
export function parseSnapshot(text: string): Snapshot {
  const data = JSON.parse(text) as Snapshot;
  if (!Array.isArray(data.protocols) || !Array.isArray(data.watchlist)) {
    throw new Error('snapshot: expected protocols and watchlist arrays');
  }
  return data;
}

/**
 * The gate's own checks, run before anything is written: row count, ranks
 * 1..N, values non-increasing, watchlist coverage, farm-step shape, slug
 * validity. Returns the first problem, or null when the board is valid.
 */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  if (board.length < MIN_ROWS) return `board holds ${board.length} rows, fewer than ${MIN_ROWS}`;
  if (board.length > MAX_ROWS) return `board holds ${board.length} rows, more than ${MAX_ROWS}`;
  const slugs = new Set(snapshot.protocols.map((p) => p.slug));
  const seen = new Set<string>();
  let previous = Number.POSITIVE_INFINITY;
  for (const row of board) {
    if (row.rank < 1 || row.rank > board.length) return `row ${row.slug}: rank ${row.rank} out of range`;
    if (!slugs.has(row.slug)) return `row ${row.slug}: not a snapshot protocol`;
    if (seen.has(row.slug)) return `row ${row.slug}: listed twice`;
    seen.add(row.slug);
    if (row.implied_value_usd < 1 || row.implied_value_usd > MAX_VALUE_USD) {
      return `row ${row.slug}: implied value ${row.implied_value_usd} out of range`;
    }
    if (row.implied_value_usd > previous) return `row ${row.slug}: value rises above the row before it`;
    previous = row.implied_value_usd;
    if (row.farm_steps.length < 3 || row.farm_steps.length > 12) {
      return `row ${row.slug}: ${row.farm_steps.length} farm steps, need 3 to 12`;
    }
    for (const step of row.farm_steps) {
      const trimmed = step.trim();
      if (trimmed.length < MIN_STEP_CHARS || trimmed.length > MAX_STEP_CHARS) {
        return `row ${row.slug}: a farm step is ${trimmed.length} characters, need ${MIN_STEP_CHARS} to ${MAX_STEP_CHARS}`;
      }
    }
  }
  for (const slug of snapshot.watchlist) {
    if (!seen.has(slug)) return `watchlist slug ${slug} is missing from the board`;
  }
  const values = new Set(board.map((row) => row.implied_value_usd));
  if (board.length > 1 && values.size === 1) return 'every row has the same implied value';
  return null;
}

/** The dashboard's data as a script tag's contents: window.RADAR = {...}. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
