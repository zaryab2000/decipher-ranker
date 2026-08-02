import { searchMerchants } from "@/dashboard/lib/api";
import { SearchBar } from "@/dashboard/components/search/SearchBar";
import { SearchResults } from "@/dashboard/components/search/SearchResults";

export const metadata = { title: "Search" };

export const dynamic = "force-dynamic";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const query = params.q ?? "";

  return (
    // Constrained so a single result does not float in a 1280px field.
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold tracking-tight text-gray-900 mb-6">Search merchants</h1>
      <div className="mb-8">
        <SearchBar initialQuery={query} />
      </div>

      {query ? (
        <SearchResultsWithData query={query} />
      ) : (
        <div className="py-8">
          <p className="text-sm text-gray-600">
            Search by merchant name, origin URL, or wallet address, then press Enter.
          </p>
          <p className="text-xs text-gray-500 mt-2">
            Try &quot;bitrefill&quot;, &quot;base&quot;, or &quot;0x…&quot;
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
