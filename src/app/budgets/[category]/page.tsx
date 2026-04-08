import { notFound } from 'next/navigation';
import BudgetCategoryDetailPage from '@/components/pages/BudgetCategoryDetailPage';
import { CATEGORIES, type Category } from '@/lib/types';

export default async function BudgetCategoryPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const resolvedParams = await params;
  const category = decodeURIComponent(resolvedParams.category);

  if (!CATEGORIES.includes(category as Category)) {
    notFound();
  }

  return <BudgetCategoryDetailPage category={category as Category} />;
}
