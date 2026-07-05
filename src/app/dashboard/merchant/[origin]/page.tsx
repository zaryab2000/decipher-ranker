import { notFound } from "next/navigation";
import { Trophy, DollarSign, BarChart3, Users } from "lucide-react";
import { getMerchantByOrigin } from "@/dashboard/lib/api";
import { MerchantHeader } from "@/dashboard/components/merchant/MerchantHeader";
import { MetricCard } from "@/dashboard/components/merchant/MetricCard";
import { ScoreBreakdownChart } from "@/dashboard/components/merchant/ScoreBreakdownChart";
import { CompetitorList } from "@/dashboard/components/merchant/CompetitorList";
import { Badge } from "@/dashboard/components/shared/Badge";
import { Card } from "@/dashboard/components/shared/Card";
import { formatNumber, formatPrice } from "@/dashboard/lib/formatters";

export default async function MerchantProfilePage({
  params,
}: {
  params: Promise<{ origin: string }>;
}) {
  const { origin } = await params;
  const decodedOrigin = decodeURIComponent(origin);
  const merchant = await getMerchantByOrigin(decodedOrigin);

  if (!merchant) {
    notFound();
  }

  const priorityVariant = {
    high: "bg-red-500/20 text-red-400",
    medium: "bg-amber-500/20 text-amber-400",
    low: "bg-emerald-500/20 text-emerald-400",
  } as const;

  return (
    <div className="space-y-8">
      <MerchantHeader merchant={merchant} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Rank"
          value={merchant.rankPosition ?? "—"}
          icon={<Trophy className="w-5 h-5" />}
        />
        <MetricCard
          label="Price"
          value={merchant.priceUsd != null ? formatPrice(merchant.priceUsd) : "N/A"}
          icon={<DollarSign className="w-5 h-5" />}
        />
        <MetricCard
          label="Volume 30d"
          value={formatNumber(merchant.txCount30d)}
          icon={<BarChart3 className="w-5 h-5" />}
        />
        <MetricCard
          label="Unique Buyers"
          value={formatNumber(merchant.uniqueBuyers)}
          icon={<Users className="w-5 h-5" />}
        />
      </div>

      <div>
        <h2 className="text-lg font-semibold text-gray-50 mb-3">Score Breakdown</h2>
        <Card>
          <ScoreBreakdownChart breakdown={merchant.scoreBreakdown} />
        </Card>
      </div>

      {merchant.competitors.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-50 mb-3">
            Competitors{merchant.category ? ` in ${merchant.category}` : ""}
          </h2>
          <CompetitorList
            competitors={merchant.competitors}
            currentScore={merchant.rankerScore}
          />
        </div>
      )}

      {merchant.improvements.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-50 mb-3">Improvement Suggestions</h2>
          <Card>
            <ul className="space-y-3">
              {merchant.improvements.map((item, i) => (
                <li key={i} className="flex items-start gap-3">
                  <Badge
                    className={priorityVariant[item.priority]}
                  >
                    {item.priority}
                  </Badge>
                  <span className="text-sm text-gray-300">{item.message}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}
    </div>
  );
}
