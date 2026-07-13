import { getEcosystemStats, getTopMerchants, getRecentlyUpdated } from "@/dashboard/lib/api";
import { HeroStats } from "@/dashboard/components/homepage/HeroStats";
import { TopGainersTable } from "@/dashboard/components/homepage/TopGainersTable";
import { RecentUpdates } from "@/dashboard/components/homepage/RecentUpdates";

export default async function DashboardHomePage() {
  const [stats, topMerchants, recentUpdates] = await Promise.all([
    getEcosystemStats(),
    getTopMerchants(10),
    getRecentlyUpdated(5),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-50">x402 Ecosystem Overview</h1>
        <p className="text-gray-400 mt-1">Live analytics from the x402 merchant network</p>
      </div>
      <HeroStats stats={stats} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <TopGainersTable merchants={topMerchants} />
        </div>
        <div>
          <RecentUpdates merchants={recentUpdates} />
        </div>
      </div>
    </div>
  );
}
