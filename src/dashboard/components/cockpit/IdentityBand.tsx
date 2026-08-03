import { RankSparkline } from "@/dashboard/components/cockpit/RankSparkline";
import { displayName, toDisplayScore } from "@/dashboard/lib/formatters";
import type { MerchantProfile } from "@/dashboard/types";

/**
 * States the merchant's position in one sentence, in their own terms.
 * This is the only brand-tinted surface on the page — it marks "this is you".
 */
export function IdentityBand({
  merchant,
  totalInScope,
  /** False when the category does not actually position the merchant — see isMeaningfulCategory. */
  positioned = true,
}: {
  merchant: MerchantProfile;
  totalInScope: number;
  positioned?: boolean;
}) {
  const score = toDisplayScore(merchant.rankerScore);
  const name = displayName(merchant);
  const { rankDelta, rankGap, rankPosition, category } = merchant;

  const headline =
    rankPosition == null
      ? `${name} is indexed but not yet ranked`
      : positioned && category
        ? `${name} ranks #${rankPosition} of ${totalInScope} in ${category}`
        : `${name} ranks #${rankPosition} of ${totalInScope} overall`;

  // Segments are omitted rather than faked when their data is unavailable.
  const segments: string[] = [];

  if (rankDelta.known) {
    if (rankDelta.direction === "flat") {
      segments.push("Holding steady this week");
    } else {
      const verb = rankDelta.direction === "up" ? "Up" : "Down";
      const arrow = rankDelta.direction === "up" ? "▲" : "▼";
      segments.push(
        `${arrow} ${verb} ${rankDelta.places} place${rankDelta.places === 1 ? "" : "s"} this week`,
      );
    }
  }

  segments.push(`score ${score}`);

  if (rankPosition != null) {
    if (rankGap.toNextRank != null && rankPosition > 1) {
      // A 0-point gap means the scores are equal and the ordering is a
      // tie-break. "0 pts from #3" reads as a bug and invites the reader to ask
      // why they are not #3; say what is actually true instead.
      segments.push(
        rankGap.toNextRank === 0
          ? `Tied with #${rankPosition - 1} on score`
          : `${rankGap.toNextRank} pts from #${rankPosition - 1}`,
      );
    } else if (rankPosition === 1) {
      segments.push(positioned ? "Leading the category" : "Leading overall");
    }
  }

  return (
    <div className="rounded-xl border border-brand-200 bg-brand-50 p-5 flex items-center gap-6">
      <div className="shrink-0">
        <div className="text-[10px] uppercase tracking-wider font-bold text-brand-600 mb-1">
          Your grade
        </div>
        <div className="text-4xl font-bold tracking-tight leading-none text-brand-700">
          {merchant.grade}
        </div>
      </div>

      <div className="min-w-0">
        <h1 className="text-base font-bold text-brand-900">{headline}</h1>
        <p className="text-sm text-brand-700 mt-0.5">{segments.join(" · ")}</p>
      </div>

      <div className="ml-auto hidden sm:block">
        <RankSparkline points={merchant.rankHistory} />
      </div>
    </div>
  );
}
