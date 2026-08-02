import Link from "next/link";
import { AlertCircle, Gauge, Trophy, Activity, Users } from "lucide-react";
import {
  getMerchantByOrigin,
  getAllCategories,
  getEcosystemStats,
} from "@/dashboard/lib/api";
import { ClaimForm } from "@/dashboard/components/cockpit/ClaimForm";
import { RememberedMerchant } from "@/dashboard/components/cockpit/RememberedMerchant";
import { IdentityBand } from "@/dashboard/components/cockpit/IdentityBand";
import { ComponentBreakdown } from "@/dashboard/components/cockpit/ComponentBreakdown";
import { FixList } from "@/dashboard/components/cockpit/FixList";
import { RankHistoryChart } from "@/dashboard/components/cockpit/RankHistoryChart";
import { CompetitorTable } from "@/dashboard/components/cockpit/CompetitorTable";
import { TopByCategory } from "@/dashboard/components/cockpit/TopByCategory";
import { HeroStats } from "@/dashboard/components/homepage/HeroStats";
import { MetricCard } from "@/dashboard/components/merchant/MetricCard";
import {
  biggestLever,
  formatNumber,
  isMeaningfulCategory,
  toDisplayScore,
} from "@/dashboard/lib/formatters";
import type { EcosystemStats, MerchantProfile, RankHistoryPoint } from "@/dashboard/types";

// No `revalidate` here: reading searchParams makes this route dynamic, so an
// ISR directive would be dead. Caching still happens underneath — every query
// goes through cached(key, DASH_TTL_SECONDS, ...) against KV.

export const metadata = {
  title: "My merchant — Decipher Ranker",
  description: "Your x402 rank, your score breakdown, and what to fix.",
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ origin?: string }>;
}) {
  const { origin } = await searchParams;
  const trimmed = origin?.trim() ?? "";

  const merchant = trimmed ? await getMerchantByOrigin(trimmed) : null;

  if (!merchant) {
    // Whitespace-only input is treated as absent, so we never say
    // "we couldn't find ''".
    return <ClaimPanel notFoundOrigin={trimmed || null} />;
  }

  return <Cockpit merchant={merchant} />;
}

async function ClaimPanel({ notFoundOrigin }: { notFoundOrigin: string | null }) {
  // Both are already cached; neither adds a query on the hot path.
  const [stats, categories] = await Promise.all([
    getEcosystemStats(),
    getAllCategories(),
  ]);

  return (
    <div className="max-w-5xl mx-auto pb-8">
      <ClaimBlock notFoundOrigin={notFoundOrigin} stats={stats} />

      <div className="mt-10">
        <HeroStats stats={stats} />
      </div>

      <TopByCategory categories={categories} />
    </div>
  );
}

function ClaimBlock({
  notFoundOrigin,
  stats,
}: {
  notFoundOrigin: string | null;
  stats: EcosystemStats;
}) {
  return (
    // Left-aligned rather than centred: the category columns below are
    // full-width, so centring this block over them left the two halves of the
    // page visibly out of line. max-w-xl keeps the measure readable.
    <div className="max-w-xl pt-10 sm:pt-14">
      {notFoundOrigin && (
        <div className="mb-6 rounded-lg border border-gray-200 border-l-4 border-l-amber-400 bg-white p-4 text-sm text-gray-600">
          <AlertCircle className="inline w-4 h-4 text-amber-500 mr-1.5 -mt-0.5" />
          We couldn&apos;t find {notFoundOrigin} in the x402 catalog. It can take up to 24
          hours after a Coinbase Bazaar listing to appear here.{" "}
          <a
            href="https://bazaar.coinbase.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-emerald-600 hover:text-emerald-700 underline decoration-emerald-600/30"
          >
            Register on Coinbase Bazaar
          </a>
        </div>
      )}

      {/* Live figures rather than static copy — the same "state the fact"
          move the identity band makes, applied before anyone has claimed. */}
      <p className="text-xs uppercase tracking-wide text-emerald-600 font-medium">
        {stats.totalMerchants.toLocaleString()} merchants · {stats.totalCategories} categories
      </p>

      <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-900">
        Find your merchant
      </h1>
      <p className="mt-2 text-base text-gray-600">
        Enter the domain you serve x402 requests from. We&apos;ll show your rank, your score
        breakdown, and what&apos;s holding you back.
      </p>

      <div className="mt-6">
        <ClaimForm defaultValue={notFoundOrigin ?? ""} />
      </div>

      <div className="mt-3">
        <RememberedMerchant />
      </div>

      <div className="my-6 text-xs uppercase tracking-wide text-gray-500">or</div>

      <Link
        href="/dashboard/leaderboard"
        className="text-sm text-emerald-600 hover:text-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 rounded"
      >
        Browse the full leaderboard →
      </Link>
    </div>
  );
}

/** Plain-language equivalent of the rank chart, for screen readers. */
function buildRankSummary(merchant: MerchantProfile): string {
  const ranked = merchant.rankHistory.filter(
    (p): p is RankHistoryPoint & { rankPosition: number } => p.rankPosition != null,
  );
  if (ranked.length < 2) return "Not enough rank history to describe a trend yet.";

  const first = ranked[0]!.rankPosition;
  const last = ranked[ranked.length - 1]!.rankPosition;

  // Derived from the same rankDelta the identity band uses, so the chart
  // summary and the subline can never disagree.
  const direction =
    merchant.rankDelta.direction === "up"
      ? `Improved by ${merchant.rankDelta.places} places`
      : merchant.rankDelta.direction === "down"
        ? `Fell by ${merchant.rankDelta.places} places`
        : "Unchanged";

  const gaps = merchant.rankHistory.length - ranked.length;
  const gapNote = gaps > 0 ? ` Data is missing for ${gaps} day${gaps === 1 ? "" : "s"}.` : "";

  return `Rank over the last ${ranked.length} days: started at #${first}, currently #${last}. ${direction}.${gapNote}`;
}

async function Cockpit({ merchant }: { merchant: MerchantProfile }) {
  // The headline compares against the merchant's own scope: their category when
  // they have one, the whole catalog when they do not.
  const positioned = isMeaningfulCategory(merchant.category);

  const [categories, stats] = await Promise.all([
    positioned ? getAllCategories() : Promise.resolve([]),
    positioned ? Promise.resolve(null) : getEcosystemStats(),
  ]);

  const totalInScope = positioned
    ? (categories.find((c) => c.name === merchant.category)?.merchantCount ?? 0)
    : (stats?.totalMerchants ?? 0);

  const rankLabel = positioned ? "Category rank" : "Overall rank";
  const noBuyers = merchant.buyers30d === 0;

  // Claim "largest gap" only when buyer diversity genuinely is it. A merchant
  // with zero volume as well has a 40-point hole, not a 25-point one, and the
  // component breakdown directly below would contradict the card.
  const lever = biggestLever(merchant.scoreBreakdown);
  const buyersAreTheBiggestGap = lever?.key === "buyerDiversity";

  return (
    <div className="space-y-6">
      <IdentityBand merchant={merchant} totalInScope={totalInScope} positioned={positioned} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label={rankLabel}
          value={merchant.rankPosition != null ? `#${merchant.rankPosition}` : "—"}
          icon={<Trophy className="w-5 h-5" />}
        />
        <MetricCard
          label="Decipher score"
          value={toDisplayScore(merchant.rankerScore)}
          icon={<Gauge className="w-5 h-5" />}
        />
        <MetricCard
          label="Calls · 30d"
          value={formatNumber(merchant.txCount30d)}
          icon={<Activity className="w-5 h-5" />}
        />
        <MetricCard
          label="Unique buyers · 30d"
          value={formatNumber(merchant.buyers30d)}
          icon={<Users className="w-5 h-5" />}
          valueClassName={noBuyers ? "text-amber-600" : undefined}
          subtitle={
            noBuyers
              ? buyersAreTheBiggestGap
                ? "Worth 25 pts — your largest gap"
                : "Worth 25 pts"
              : undefined
          }
          subtitleClassName={noBuyers ? "text-amber-600" : undefined}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-4">
        <ComponentBreakdown
          breakdown={merchant.scoreBreakdown}
          fixCount={merchant.improvements.length}
          nextRank={
            merchant.rankPosition != null && merchant.rankPosition > 1
              ? merchant.rankPosition - 1
              : null
          }
        />
        <RankHistoryChart points={merchant.rankHistory} summary={buildRankSummary(merchant)} />
      </div>

      <FixList improvements={merchant.improvements} />

      <CompetitorTable merchant={merchant} />
    </div>
  );
}
