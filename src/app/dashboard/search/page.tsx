import { SearchBar } from "@/dashboard/components/search/SearchBar";

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
        <p className="text-center text-gray-500 py-12">
          Search will be available once the data layer is connected
        </p>
      ) : (
        <p className="text-center text-gray-600 text-sm py-12">
          Enter a merchant name, origin URL, or wallet address to search
        </p>
      )}
    </div>
  );
}
