const ENDPOINTS = [
  {
    method: "GET",
    path: "/api/preview",
    description:
      "Quick merchant lookup by domain. Returns score, grade, rank, and category.",
    price: "Free, no auth",
  },
  {
    method: "GET",
    path: "/api/leaderboard",
    description: "Top merchants ranked by Decipher score. Filterable by category.",
    price: "Free, no auth",
  },
  {
    method: "GET",
    path: "/api/categories",
    description: "All x402 categories with merchant counts and top performers.",
    price: "Free, no auth",
  },
  {
    method: "POST",
    path: "/api/report/origin",
    description:
      "Full ranking report with improvement tips and listing completeness analysis.",
    price: "Free + SIWX wallet proof",
  },
  {
    method: "POST",
    path: "/api/report/competitive",
    description:
      "Competitive analysis: top 10 rivals, gap analysis, pricing benchmarks, AI insights.",
    price: "$0.03 USDC",
  },
  {
    method: "POST",
    path: "/api/report/merchant",
    description:
      "Deep merchant profile by wallet address: volume trends, buyer diversity, concentration metrics.",
    price: "$0.03 USDC",
  },
];

function methodBadgeColor(method: string): string {
  return method === "GET" ? "bg-brand-50 text-brand-700" : "bg-blue-50 text-blue-700";
}

export function ApiReference() {
  return (
    <section className="py-16 sm:py-24 px-4 sm:px-6 bg-gray-50">
      <div className="max-w-6xl mx-auto">
        <p className="text-sm font-medium text-brand-600 uppercase tracking-wide mb-2">
          API reference
        </p>
        <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900 mb-2">
          Six endpoints, two payment rails
        </h2>
        <p className="text-base sm:text-lg text-gray-600 leading-relaxed mb-8 max-w-2xl">
          x402 (USDC on Base) and MPP (USDC on Tempo). Free endpoints need no payment. Full
          OpenAPI spec at{" "}
          <a
            href="/openapi.json"
            className="text-brand-600 hover:text-brand-700 underline decoration-brand-600/30"
          >
            /openapi.json
          </a>
          .
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {ENDPOINTS.map((ep) => (
            <div
              key={ep.path}
              className="bg-white border border-gray-200 rounded-xl p-6"
            >
              <div className="flex items-center gap-2 mb-2">
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded font-mono ${methodBadgeColor(ep.method)}`}
                >
                  {ep.method}
                </span>
                <code className="text-sm font-mono text-gray-900">{ep.path}</code>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed mb-2">{ep.description}</p>
              <p className="text-xs text-gray-400">{ep.price}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
