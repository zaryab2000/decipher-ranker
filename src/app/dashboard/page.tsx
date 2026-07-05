export default function DashboardHome() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-50 mb-2">
        x402 Ecosystem Overview
      </h1>
      <p className="text-gray-400 mb-8">
        Browse the x402 merchant landscape — rankings, categories, and insights.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {[
          { label: "Total Merchants", value: "—" },
          { label: "Total Categories", value: "—" },
          { label: "Total Transactions", value: "—" },
          { label: "Top Category", value: "—" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-lg bg-gray-900 border border-gray-800 p-4"
          >
            <p className="text-xs text-gray-500 uppercase tracking-wider">
              {stat.label}
            </p>
            <p className="text-2xl font-semibold text-gray-50 mt-1">
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      <p className="text-center text-gray-600 text-sm py-8">
        Dashboard data will appear once the backend data layer is connected.
      </p>
    </div>
  );
}
