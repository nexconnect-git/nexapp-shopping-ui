type CategoryLike = {
  id?: string;
  label?: string;
  icon?: string;
  raw?: {
    slug?: string | null;
    name?: string | null;
  };
};

export function categoryIconFor(category: CategoryLike | string): string {
  const label =
    typeof category === 'string'
      ? category
      : [category.id, category.label, category.raw?.slug, category.raw?.name]
          .filter(Boolean)
          .join(' ');
  const key = String(label || '').toLowerCase();

  if (
    typeof category !== 'string' &&
    category.icon &&
    /\p{Extended_Pictographic}/u.test(category.icon)
  ) {
    return category.icon;
  }

  if (key === 'all' || key.includes('store')) return '🛍️';
  if (key.includes('fruit') || key.includes('vegetable')) return '🥦';
  if (
    key.includes('dairy') ||
    key.includes('breakfast') ||
    key.includes('milk')
  )
    return '🥛';
  if (key.includes('snack') || key.includes('munch')) return '🍪';
  if (key.includes('beverage') || key.includes('drink')) return '🧃';
  if (key.includes('bakery') || key.includes('bread')) return '🥐';
  if (key.includes('pantry') || key.includes('staple')) return '🍚';
  if (key.includes('personal') || key.includes('care')) return '🧴';
  if (key.includes('home') || key.includes('clean')) return '🧼';
  if (key.includes('medicine') || key.includes('health')) return '💊';
  if (key.includes('baby')) return '🍼';
  return '✨';
}
