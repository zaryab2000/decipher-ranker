import { CategoryCard } from "@/dashboard/components/categories/CategoryCard";
import type { CategoryItem } from "@/dashboard/types";

export function CategoryList({ categories }: { categories: CategoryItem[] }) {
  if (categories.length === 0) {
    return (
      <p className="text-gray-500 text-sm py-12 text-center">
        No categories available
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {categories.map((category) => (
        <CategoryCard key={category.slug} category={category} />
      ))}
    </div>
  );
}
