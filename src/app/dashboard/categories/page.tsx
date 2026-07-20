import { getAllCategories } from "@/dashboard/lib/api";
import { CategoryList } from "@/dashboard/components/categories/CategoryList";

// Data changes at most once/day via the refresh pipeline; regenerate hourly
// instead of per-request to keep Neon egress off the hot path.
export const revalidate = 3600;

export default async function CategoriesPage() {
  const categories = await getAllCategories();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-50">Categories</h1>
        <p className="text-gray-400 mt-1">Browse merchants by category</p>
      </div>
      <CategoryList categories={categories} />
    </div>
  );
}
