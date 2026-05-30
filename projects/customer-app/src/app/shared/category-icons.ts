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

  if (key === 'all' || key.includes('store')) return '\u{1F6CD}\u{FE0F}';
  if (key.includes('fruit') || key.includes('vegetable')) return '\u{1F966}';
  if (
    key.includes('dairy') ||
    key.includes('breakfast') ||
    key.includes('milk')
  )
    return '\u{1F95B}';
  if (key.includes('snack') || key.includes('munch')) return '\u{1F36A}';
  if (key.includes('beverage') || key.includes('drink')) return '\u{1F943}';
  if (key.includes('bakery') || key.includes('bread')) return '\u{1F950}';
  if (key.includes('pantry') || key.includes('staple')) return '\u{1F35A}';
  if (key.includes('personal') || key.includes('care')) return '\u{1F9F4}';
  if (key.includes('home') || key.includes('clean')) return '\u{1F9FC}';
  if (key.includes('medicine') || key.includes('health')) return '\u{1F48A}';
  if (key.includes('baby')) return '\u{1F37C}';
  return '\u{2728}';
}
