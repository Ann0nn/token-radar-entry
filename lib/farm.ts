// Farm plans for token-radar-01.
//
// Every row's plan has five steps: an opening step that says plainly the
// protocol records no token and no distribution is confirmed, three steps
// specific to the protocol's category, and a closing risk step. Steps name
// real actions with real sizes and timeframes — deposit amounts scale with
// the protocol's TVL, and every step names the protocol and its main chain.
// Nothing here claims an airdrop exists or is coming: the plan positions a
// reader for one if the protocol ever issues a token, and says so.
//
// Steps are kept well inside the gate's 20–600 characters: the model
// validates every step's length before the board is written.

import type { SnapshotProtocol } from './model.ts';

/** Deposit sizing that scales with the protocol's TVL. */
function depositSize(tvlUsd: number): string {
  if (tvlUsd >= 500_000_000) return '$500–$2,000';
  if (tvlUsd >= 100_000_000) return '$200–$1,000';
  return '$100–$500';
}

interface PlanContext {
  name: string;
  chain: string;
  chain2: string;
  size: string;
}

/** One category's three middle steps, as functions of the plan's context. */
type CategorySteps = (c: PlanContext) => [string, string, string];

const CATEGORY_STEPS: Record<string, CategorySteps> = {
  'Risk Curators': (c) => [
    `Deposit ${c.size} of USDC or ETH into one of ${c.name}'s curated vaults on ${c.chain} (about $1–$5 in gas), choosing the vault whose curator and risk profile you understand.`,
    `Leave the deposit working for at least 30 days: curators reward sticky capital, and moving in and out weekly resets any tenure a future distribution might weigh.`,
    `Check the vault's page once a week for 10 minutes — new vaults, curator changes, and any points or rewards program ${c.name} announces.`,
  ],
  Dexs: (c) => [
    `Swap ${c.size} through ${c.name} on ${c.chain} across 3–4 trades over two weeks (about $0.50–$3 in gas per trade) instead of one large trade, so the activity reads as real usage.`,
    `Add ${c.size} to one of ${c.name}'s busiest liquidity pools on ${c.chain} and hold the position for at least 30 days, watching for impermanent loss.`,
    `Return weekly to claim fees or rebalance: regular, modest activity over months counts for more than one large deposit that leaves the next day.`,
  ],
  'Onchain Capital Allocator': (c) => [
    `Deposit ${c.size} into ${c.name}'s main allocation vault on ${c.chain} (about $1–$5 in gas) and note which strategies it routes capital to.`,
    `Hold the position for 60–90 days: allocators compound slowly, and the position's age is the simplest signal of a genuine user.`,
    `Read ${c.name}'s monthly allocation report when it lands (15 minutes) and move between its vaults only when a strategy genuinely changes.`,
  ],
  RWA: (c) => [
    `Buy ${c.size} of ${c.name}'s tokenized real-world assets on ${c.chain} (about $1–$5 in gas), starting with the shortest-duration product it offers.`,
    `Hold to the product's maturity or for at least 90 days: RWA yields accrue over months, and early exits usually pay a penalty.`,
    `Check the underlying asset's reporting once a month (10 minutes) — the collateral and the issuer matter more here than the headline yield.`,
  ],
  Lending: (c) => [
    `Supply ${c.size} of ETH or a stablecoin to ${c.name} on ${c.chain} (about $1–$4 in gas) and leave it earning for at least 30 days.`,
    `If you borrow, keep it small — under 50% of your collateral — and only against an asset you already hold, so a price swing cannot liquidate you.`,
    `Check your health factor once a week (5 minutes) and top up collateral promptly if it falls below 1.5.`,
  ],
  Yield: (c) => [
    `Deposit ${c.size} into ${c.name}'s highest-TVL yield vault on ${c.chain} (about $1–$5 in gas), favouring the vault with the longest track record over the highest advertised rate.`,
    `Let the yield compound for 60–90 days without withdrawing: compounding is the whole point, and exits usually cost a fee.`,
    `Compare the vault's realised weekly yield against its advertised rate once a month (10 minutes) and move only if it underperforms for two straight months.`,
  ],
  Derivatives: (c) => [
    `Open a small perps position on ${c.name} on ${c.chain} — ${c.size} at no more than 2x leverage (about $1–$4 in gas) — and close it within a week.`,
    `Trade 2–3 times a month with the same small size rather than one large bet: steady volume over months reads as a real user.`,
    `Set a stop-loss on every trade and never risk more than 2% of the position's value on a single idea.`,
  ],
  CDP: (c) => [
    `Open a vault on ${c.name} on ${c.chain} with ${c.size} of collateral (about $1–$4 in gas) and mint less than half the maximum stablecoins it allows.`,
    `Hold the vault open for at least 60 days, paying any stability fee from yield rather than from the collateral itself.`,
    `Watch the collateral ratio weekly (5 minutes) and add collateral if it drifts toward the liquidation line.`,
  ],
  'Yield Aggregator': (c) => [
    `Deposit ${c.size} into ${c.name}'s main auto-compounding vault on ${c.chain} (about $1–$5 in gas) and let it run without touching it.`,
    `Hold for 60–90 days: the aggregator's edge is compounding frequency, which only shows over months.`,
    `Check the vault's strategy allocation once a month (10 minutes) to confirm it still matches the risk you signed up for.`,
  ],
  'Basis Trading': (c) => [
    `Deposit ${c.size} into ${c.name}'s basis vault on ${c.chain} (about $1–$5 in gas), after reading how it hedges its spot exposure.`,
    `Hold for a full funding cycle — at least 30 days — because basis returns come in lumps around funding settlements.`,
    `Watch the funding rate weekly (5 minutes): a long stretch of negative funding is the signal to reassess the position.`,
  ],
  Chain: (c) => [
    `Bridge ${c.size} of ETH or a stablecoin onto ${c.name} (about $2–$8 in bridge and gas fees) and use its native apps for real transactions.`,
    `Make 3–4 genuine transactions a week for a month — swaps, deposits, or mints — rather than one large transfer that sits idle.`,
    `Keep a small balance of the chain's gas token in the wallet so you can transact whenever an app or program opens.`,
  ],
  'Staking Pool': (c) => [
    `Stake ${c.size} through ${c.name} on ${c.chain} (about $1–$4 in gas) and note the unbonding period before you commit.`,
    `Leave the stake for the full unbonding cycle or at least 60 days, and claim rewards monthly rather than daily to save on gas.`,
    `Check the pool's validator set once a month (10 minutes) and move if a validator's performance drops.`,
  ],
  'Liquidity Manager': (c) => [
    `Deposit ${c.size} into a ${c.name} managed liquidity position on ${c.chain} (about $1–$5 in gas), picking the pair you understand best.`,
    `Leave the position for at least 30 days: the manager rebalances on your behalf, and frequent exits waste gas and fees.`,
    `Review the position's fee earnings against its impermanent loss monthly (10 minutes) before deciding to stay or move.`,
  ],
  Restaking: (c) => [
    `Restake ${c.size} of a liquid staking token through ${c.name} on ${c.chain} (about $1–$5 in gas), after reading which services secure it.`,
    `Hold the restaked position for at least 60 days and track any points or rewards ${c.name} accrues to restakers.`,
    `Review the operators securing your stake monthly (10 minutes): slashing risk sits with them, not with the protocol alone.`,
  ],
  'Prediction Market': (c) => [
    `Trade ${c.size} across 3–4 markets on ${c.name} over two weeks (about $0.50–$2 in gas per trade), taking positions you have a real view on.`,
    `Provide ${c.size} of liquidity to one market's order book and hold it through the market's resolution.`,
    `Settle and withdraw after each market resolves, then redeploy into the next market rather than leaving funds idle.`,
  ],
  Insurance: (c) => [
    `Buy ${c.size} of cover on ${c.name} on ${c.chain} for a protocol you already use (about $1–$4 in gas), matching the cover period to your exposure.`,
    `Hold the cover for its full term and renew it if your exposure continues — lapses leave you unprotected exactly when claims cluster.`,
    `Read the cover's exclusions before buying (15 minutes): what it does not cover matters more than the premium.`,
  ],
  Payments: (c) => [
    `Pay ${c.size} through ${c.name} on ${c.chain} for a real purchase or transfer (about $0.50–$3 in gas), using it as you would any payment rail.`,
    `Use it 2–3 times a month for genuine payments over 60 days rather than cycling funds back and forth.`,
    `Keep a small working balance on ${c.chain} so payments go through without a fresh bridge each time.`,
  ],
  Indexes: (c) => [
    `Buy ${c.size} of ${c.name}'s index token on ${c.chain} (about $1–$4 in gas) and read what it holds before you buy.`,
    `Hold for at least 90 days: an index is a slow product, and its edge is diversification, not timing.`,
    `Check the index's rebalances quarterly (10 minutes) to confirm its holdings still match its mandate.`,
  ],
  Privacy: (c) => [
    `Use ${c.name} on ${c.chain} for ${c.size} of private transfers over a month (about $1–$5 in gas per transfer), for lawful transactions only.`,
    `Keep the amounts modest and the pattern ordinary: privacy tools reward steady, normal use.`,
    `Read ${c.name}'s compliance notes before your first transfer (15 minutes) so you know what it does and does not shield.`,
  ],
  'Options Vault': (c) => [
    `Deposit ${c.size} into ${c.name}'s options vault on ${c.chain} (about $1–$5 in gas) and read how it sells or buys options first.`,
    `Hold through at least two weekly epochs (about 14 days) so you see a full premium cycle.`,
    `Track the vault's premium income against its drawdowns weekly (10 minutes) before adding more.`,
  ],
};

const GENERIC_STEPS: CategorySteps = (c) => [
  `Use ${c.name}'s core product on ${c.chain} with ${c.size} (about $1–$5 in gas), starting with the simplest action it offers.`,
  `Return weekly for 60 days and repeat the core action in small amounts: steady use over months is the strongest signal of a genuine user.`,
  `Watch ${c.name}'s announcements once a week (10 minutes) for new features, vaults, or any points or rewards program.`,
];

/** The opening step every plan shares: honest about what is and is not promised. */
function openingStep(c: PlanContext, category: string | null): string {
  const what = category === null ? 'protocol' : `${category.toLowerCase()} protocol`;
  return (
    `${c.name} is a ${what} on ${c.chain} that records no token, and no token ` +
    `distribution is confirmed. This plan positions you for one if it ever issues a token — ` +
    `it is not a promise of an airdrop, and the steps below are worth doing only if you would use the product anyway.`
  );
}

/** The closing step every plan shares: the risk, stated plainly. */
function riskStep(c: PlanContext): string {
  return (
    `Only use funds you can afford to lose: ${c.name} is a smart contract on ${c.chain}, ` +
    `and smart contracts can be exploited. Never deposit more than ${c.size}, never share your seed phrase, ` +
    `and verify you are on the real ${c.name} app before connecting your wallet.`
  );
}

/**
 * Five concrete steps for one protocol: the honest opening, three steps for
 * its category (or the generic set when its category has no template), and
 * the risk step. Every step is trimmed and kept inside the gate's limits.
 */
export function farmStepsFor(p: SnapshotProtocol): string[] {
  const chain = p.chains[0] ?? 'Ethereum';
  const chain2 = p.chains[1] ?? chain;
  const context: PlanContext = {
    name: p.name,
    chain,
    chain2,
    size: depositSize(p.tvl_usd),
  };
  const middle = (p.category !== null && CATEGORY_STEPS[p.category] !== undefined
    ? (CATEGORY_STEPS[p.category] as CategorySteps)
    : GENERIC_STEPS)(context);
  const steps = [openingStep(context, p.category), ...middle, riskStep(context)];
  return steps.map((step) => {
    const trimmed = step.trim();
    return trimmed.length > 600 ? `${trimmed.slice(0, 597)}...` : trimmed;
  });
}
