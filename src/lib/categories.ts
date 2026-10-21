import { prisma } from '@/lib/prisma';
import { Category, defaultCategories } from '@/lib/platform-data';

export const ACTIVE_CTF_ID = 'kctf-2026';

function toCategory(category: {
  id: string;
  name: string;
  slug: string;
  shortName: string;
  description: string;
  accentColor: string;
  sortOrder: number;
  isVisible: boolean;
}): Category {
  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    shortName: category.shortName,
    description: category.description,
    color: category.accentColor,
    order: category.sortOrder,
    visible: category.isVisible,
  };
}

export async function getCategories(options: { fallback?: boolean } = {}): Promise<Category[]> {
  try {
    const categories = await prisma.category.findMany({
      where: { ctfId: ACTIVE_CTF_ID },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });

    if (categories.length > 0) return categories.map(toCategory);
    return options.fallback === false ? [] : defaultCategories;
  } catch (error) {
    if (options.fallback === false) throw error;
    console.error('Unable to load categories from PostgreSQL; using defaults.', error);
    return defaultCategories;
  }
}

