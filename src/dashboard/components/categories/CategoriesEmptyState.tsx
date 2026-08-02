/**
 * Rendered when getAllCategories() returns []. Practically unreachable in
 * production — the pipeline seeds the taxonomy — but the page must not render a
 * bare heading over nothing on a fresh database.
 */
export function CategoriesEmptyState() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
      <p className="text-sm text-gray-600">No categories indexed yet.</p>
      <p className="mt-1 text-xs text-gray-500">
        Categories appear after the first catalog refresh completes.
      </p>
    </div>
  );
}
