import { cache } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Trophy, DollarSign, BarChart3, Users } from "lucide-react";
import { getMerchantByOrigin } from "@/dashboard/lib/api";
import { MerchantHeader } from "@/dashboard/components/merchant/MerchantHeader";
import { MetricCard } from "@/dashboard/components/merchant/MetricCard";
import { ComponentBreakdown } from "@/dashboard/components/cockpit/ComponentBreakdown";
import { CompetitorList } from "@/dashboard/components/merchant/CompetitorList";
import { Badge } from "@/dashboard/components/shared/Badge";
import { Card } from "@/dashboard/components/shared/Card";
import { formatNumber, formatPrice, toDisplayScore } from "@/dashboard/lib/formatters";

// Data changes at most once/day via the refresh pipeline; regenerate hourly
// instead of per-request to keep Neon egress off the hot path.
export const revalidate = 3600;

const getCachedMerchant = cache(getMerchantByOrigin);

export async function generateMetadata(
  props: { params: Promise<{ origin: string }> },
): Promise<Metadata> {
  const { origin } = await props.params;
  const decoded = decodeURIComponent(origin);
  const merchant = await getCachedMerchant(decoded);
  if (!merchant) return { title: "Merchant not found" };
  const name = merchant.serviceName ?? merchant.payeeAddress;
  return {
    title: name,
    description: `Score: ${toDisplayScore(merchant.rankerScore)}. Volume: ${merchant.txCount30d} tx${merchant.uniqueBuyers != null ? `, ${merchant.uniqueBuyers} buyers` : ""}.`.replace(/\s+/g, " ").trim(),
    openGraph: {
      title: name,
      description: `x402 merchant profile and competitive analysis.`,
    },
  };
}

export default async function MerchantProfilePage({
  params,
}: {
  params: Promise<{ origin: string }>;
}) {
  const { origin } = await params;
  const decodedOrigin = decodeURIComponent(origin);
  const merchant = await getCachedMerchant(decodedOrigin);

  if (!merchant) {
    notFound();
  }

  // No red: an improvement suggestion is an opportunity, not an error. Matches
  // the cockpit's FixList so the same fact reads the same on both surfaces.
  const priorityVariant = {
    high: "bg-amber-50 text-amber-700",
    medium: "bg-gray-100 text-gray-600",
    low: "bg-gray-100 text-gray-400",
  } as const;

  return (
    <div className="space-y-8">
      <MerchantHeader merchant={merchant} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label={merchant.category ? "Category rank" : "Overall rank"}
          value={merchant.rankPosition != null ? `#${merchant.rankPosition}` : "—"}
          icon={<Trophy className="w-5 h-5" />}
        />
        <MetricCard
          label="Price"
          value={merchant.priceUsd != null ? formatPrice(merchant.priceUsd) : "—"}
          icon={<DollarSign className="w-5 h-5" />}
        />
        <MetricCard
          label="Calls · 30d"
          value={formatNumber(merchant.txCount30d)}
          icon={<BarChart3 className="w-5 h-5" />}
        />
        <MetricCard
          label="Unique buyers · 30d"
          value={merchant.uniqueBuyers != null ? formatNumber(merchant.uniqueBuyers) : "—"}
          icon={<Users className="w-5 h-5" />}
        />
      </div>

      <ComponentBreakdown breakdown={merchant.scoreBreakdown} />

      {merchant.competitors.length > 0 && (
        <CompetitorList
          competitors={merchant.competitors}
          currentScore={merchant.rankerScore}
          categoryName={merchant.category}
        />
      )}

      {merchant.improvements.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">What to fix</h2>
          <Card>
            <ul className="space-y-3">
              {merchant.improvements.map((item, i) => (
                <li key={i} className="flex items-start gap-3">
                  <Badge
                    className={priorityVariant[item.priority]}
                  >
                    {item.priority}
                  </Badge>
                  <span className="text-sm text-gray-600">{item.message}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}
    </div>
  );
}
