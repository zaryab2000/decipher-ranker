import { searchMerchants } from "@/dashboard/lib/api";
import { SearchBar } from "@/dashboard/components/search/SearchBar";
import { SearchResults } from "@/dashboard/components/search/SearchResults";

export const dynamic = "force-dynamic";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const query = params.q ?? "";

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-50 mb-6">Search Merchants</h1>
      <div className="mb-8">
        <SearchBar initialQuery={query} />
      </div>

      {query ? (
        <SearchResultsWithData query={query} />
      ) : (
        <div className="text-center py-12">
          <p className="text-gray-500 text-sm">
            Enter a merchant name, origin URL, or wallet address then press Enter to search
          </p>
          <p className="text-xs text-gray-600 mt-2">
            Try &quot;bitrefill&quot;, &quot;base&quot;, or &quot;0x...&quot;
          </p>
        </div>
      )}
    </div>
  );
}

async function SearchResultsWithData({ query }: { query: string }) {
  const result = await searchMerchants(query);

  return (
    <SearchResults
      results={result.merchants}
      query={result.query}
      total={result.total}
    />
  );
}
