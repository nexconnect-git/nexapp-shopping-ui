import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { Subscription, timer } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, Category } from '@shared/public-api';

type CategoryIconOption = {
  key: string;
  label: string;
  url: string;
};

type IconSuggestion = {
  key: string;
  label: string;
  source: 'curated' | 'material';
  aliases: string[];
  url?: string;
};

const CATEGORY_ICON_OPTIONS: CategoryIconOption[] = [
  {
    key: 'freshVegetables',
    label: 'Fresh Vegetables',
    url: 'https://img.icons8.com/3d-fluency/94/vegetarian-food.png',
  },
  {
    key: 'freshFruits',
    label: 'Fresh Fruits',
    url: 'https://img.icons8.com/3d-fluency/94/vegetarian-food.png',
  },
  {
    key: 'groceries',
    label: 'Groceries',
    url: 'https://img.icons8.com/3d-fluency/94/shopping-basket.png',
  },
  {
    key: 'attaRiceDal',
    label: 'Atta, Rice and Dal',
    url: 'https://img.icons8.com/3d-fluency/94/shopping-basket.png',
  },
  {
    key: 'masalas',
    label: 'Masalas',
    url: 'https://img.icons8.com/3d-fluency/94/meal.png',
  },
  {
    key: 'oilsGhee',
    label: 'Oils and Ghee',
    url: 'https://img.icons8.com/3d-fluency/94/shopping-basket.png',
  },
  {
    key: 'fruits',
    label: 'Fruits',
    url: 'https://img.icons8.com/3d-fluency/94/vegetarian-food.png',
  },
  {
    key: 'dairy',
    label: 'Dairy',
    url: 'https://img.icons8.com/3d-fluency/94/milk-bottle.png',
  },
  {
    key: 'dairyBreadEggs',
    label: 'Dairy, Bread and Eggs',
    url: 'https://img.icons8.com/3d-fluency/94/milk-bottle.png',
  },
  {
    key: 'meatSeafood',
    label: 'Meat and Seafood',
    url: 'https://img.icons8.com/3d-fluency/94/steak.png',
  },
  {
    key: 'snacks',
    label: 'Snacks',
    url: 'https://img.icons8.com/3d-fluency/94/nachos.png',
  },
  {
    key: 'chipsNamkeens',
    label: 'Chips and Namkeens',
    url: 'https://img.icons8.com/3d-fluency/94/nachos.png',
  },
  {
    key: 'chocolates',
    label: 'Chocolates',
    url: 'https://img.icons8.com/3d-fluency/94/chocolate-bar.png',
  },
  {
    key: 'biscuitsCakes',
    label: 'Biscuits and Cakes',
    url: 'https://img.icons8.com/3d-fluency/94/cookies.png',
  },
  {
    key: 'teaCoffee',
    label: 'Tea, Coffee and Milk Drinks',
    url: 'https://img.icons8.com/3d-fluency/94/coffee-to-go.png',
  },
  {
    key: 'saucesSpreads',
    label: 'Sauces and Spreads',
    url: 'https://img.icons8.com/3d-fluency/94/restaurant.png',
  },
  {
    key: 'sweetCorner',
    label: 'Sweet Corner',
    url: 'https://img.icons8.com/3d-fluency/94/cookies.png',
  },
  {
    key: 'beverages',
    label: 'Beverages',
    url: 'https://img.icons8.com/3d-fluency/94/cola.png',
  },
  {
    key: 'restaurant',
    label: 'Restaurant',
    url: 'https://img.icons8.com/3d-fluency/94/restaurant.png',
  },
  {
    key: 'meal',
    label: 'Meal',
    url: 'https://img.icons8.com/3d-fluency/94/meal.png',
  },
  {
    key: 'electronics',
    label: 'Electronics',
    url: 'https://img.icons8.com/3d-fluency/94/smartphone-tablet.png',
  },
  {
    key: 'accessories',
    label: 'Accessories',
    url: 'https://img.icons8.com/3d-fluency/94/smartphone-tablet.png',
  },
  {
    key: 'fashion',
    label: 'Fashion',
    url: 'https://img.icons8.com/3d-fluency/94/clothes.png',
  },
  {
    key: 'personalCare',
    label: 'Personal care',
    url: 'https://img.icons8.com/3d-fluency/94/lipstick.png',
  },
  {
    key: 'homeCare',
    label: 'Home care',
    url: 'https://img.icons8.com/3d-fluency/94/spray.png',
  },
  {
    key: 'pharmacy',
    label: 'Pharmacy',
    url: 'https://img.icons8.com/3d-fluency/94/medical-bag.png',
  },
  {
    key: 'babyCare',
    label: 'Baby care',
    url: 'https://img.icons8.com/3d-fluency/94/pacifier.png',
  },
  {
    key: 'petCare',
    label: 'Pet care',
    url: 'https://img.icons8.com/3d-fluency/94/dog.png',
  },
  {
    key: 'bakery',
    label: 'Bakery',
    url: 'https://img.icons8.com/3d-fluency/94/baguette.png',
  },
  {
    key: 'protein',
    label: 'Protein',
    url: 'https://img.icons8.com/3d-fluency/94/steak.png',
  },
];

const CATEGORY_EMOJI_OPTIONS: CategoryIconOption[] = [
  { key: 'all', label: 'General grocery', url: '🛍️' },
  { key: 'fruitsVegetables', label: 'Fruits and vegetables', url: '🥦' },
  { key: 'dairyBreakfast', label: 'Dairy and breakfast', url: '🥛' },
  { key: 'snacksMunchies', label: 'Snacks and munchies', url: '🍿' },
  { key: 'beverages', label: 'Beverages', url: '🥤' },
  { key: 'bakery', label: 'Bakery', url: '🥐' },
  { key: 'pantry', label: 'Pantry staples', url: '🧺' },
  { key: 'personalCare', label: 'Personal care', url: '🧴' },
  { key: 'homeCare', label: 'Home care', url: '🧽' },
  { key: 'health', label: 'Health and pharmacy', url: '💊' },
  { key: 'babyCare', label: 'Baby care', url: '🍼' },
  { key: 'restaurant', label: 'Meals and restaurants', url: '🍽️' },
  { key: 'electronics', label: 'Electronics', url: '📱' },
  { key: 'fashion', label: 'Fashion', url: '👕' },
  { key: 'offers', label: 'Offers', url: '🏷️' },
];

const MATERIAL_ICON_SUGGESTIONS: IconSuggestion[] = [
  {
    key: 'local_grocery_store',
    label: 'Grocery store',
    source: 'material',
    aliases: ['grocery', 'groceries', 'shopping', 'store', 'basket'],
  },
  {
    key: 'shopping_basket',
    label: 'Shopping basket',
    source: 'material',
    aliases: ['grocery', 'groceries', 'shopping', 'basket', 'cart'],
  },
  {
    key: 'storefront',
    label: 'Storefront',
    source: 'material',
    aliases: ['store', 'shop', 'market', 'vendor'],
  },
  {
    key: 'restaurant',
    label: 'Restaurant',
    source: 'material',
    aliases: ['food', 'meal', 'dining', 'restaurant'],
  },
  {
    key: 'lunch_dining',
    label: 'Lunch dining',
    source: 'material',
    aliases: ['food', 'meal', 'burger', 'restaurant', 'dining'],
  },
  {
    key: 'bakery_dining',
    label: 'Bakery dining',
    source: 'material',
    aliases: ['bakery', 'bread', 'food', 'snacks'],
  },
  {
    key: 'local_cafe',
    label: 'Cafe',
    source: 'material',
    aliases: ['beverage', 'beverages', 'coffee', 'tea', 'drink'],
  },
  {
    key: 'local_bar',
    label: 'Beverages',
    source: 'material',
    aliases: ['beverage', 'beverages', 'drink', 'juice', 'cola'],
  },
  {
    key: 'local_pharmacy',
    label: 'Pharmacy',
    source: 'material',
    aliases: ['pharmacy', 'medicine', 'medical', 'health'],
  },
  {
    key: 'medical_services',
    label: 'Medical services',
    source: 'material',
    aliases: ['pharmacy', 'medicine', 'medical', 'health'],
  },
  {
    key: 'checkroom',
    label: 'Fashion',
    source: 'material',
    aliases: ['fashion', 'clothes', 'apparel', 'style'],
  },
  {
    key: 'styler',
    label: 'Style',
    source: 'material',
    aliases: ['fashion', 'beauty', 'personal care', 'style'],
  },
  {
    key: 'devices',
    label: 'Devices',
    source: 'material',
    aliases: ['electronics', 'device', 'phone', 'gadgets'],
  },
  {
    key: 'smartphone',
    label: 'Smartphone',
    source: 'material',
    aliases: ['electronics', 'mobile', 'phone', 'device'],
  },
  {
    key: 'cleaning_services',
    label: 'Home care',
    source: 'material',
    aliases: ['home care', 'cleaning', 'spray', 'home'],
  },
  {
    key: 'child_care',
    label: 'Baby care',
    source: 'material',
    aliases: ['baby', 'baby care', 'child', 'kids'],
  },
  {
    key: 'pets',
    label: 'Pet care',
    source: 'material',
    aliases: ['pet', 'pet care', 'dog', 'cat'],
  },
  {
    key: 'egg_alt',
    label: 'Protein',
    source: 'material',
    aliases: ['protein', 'egg', 'meat', 'food'],
  },
  {
    key: 'nutrition',
    label: 'Nutrition',
    source: 'material',
    aliases: ['fruits', 'vegetables', 'healthy', 'food'],
  },
];

@Component({
  selector: 'app-categories',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './categories.component.html',
  styleUrl: './categories.component.scss',
})
export class CategoriesComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  readonly categoryEmojiOptions = CATEGORY_EMOJI_OPTIONS;
  readonly categoryIconOptions = CATEGORY_ICON_OPTIONS;
  readonly materialIconSuggestions = MATERIAL_ICON_SUGGESTIONS;
  categories = signal<Category[]>([]);
  totalItems = signal(0);
  page = signal(1);
  loading = signal(true);
  saving = signal(false);
  error = signal('');
  Math = Math;
  failedIconUrls = signal<Set<string>>(new Set());

  // Subcategory expand state: parentId -> subcategory[]
  expanded = signal<Set<string>>(new Set());
  subcategories = signal<Record<string, Category[]>>({});
  subcategoriesLoading = signal<Record<string, boolean>>({});

  lastRefreshed = signal<Date | null>(null);
  autoReload = signal(true);
  private reloadSub?: Subscription;

  showModal = signal(false);
  editTarget = signal<Category | null>(null);

  form = {
    name: '',
    slug: '',
    description: '',
    icon_name: '',
    is_active: true,
    show_in_customer_ui: true,
    parent: null as string | null,
  };

  ngOnInit() {
    this.reloadSub = timer(0, 15000).subscribe(() => {
      if (this.autoReload() && !this.showModal()) this.load();
    });
  }

  ngOnDestroy() {
    this.reloadSub?.unsubscribe();
  }

  manualReload() {
    this.load();
  }
  toggleAutoReload() {
    this.autoReload.update((v) => !v);
  }

  load() {
    this.loading.set(true);
    this.api
      .getAdminCategories({ parent: 'root', page: this.page() })
      .subscribe({
        next: (r) => {
          this.categories.set(r.results || r);
          this.totalItems.set(r.count ?? (r.results || r).length);
          this.loading.set(false);
          this.lastRefreshed.set(new Date());
        },
        error: () => this.loading.set(false),
      });
  }

  onPageChange(newPage: number) {
    if (newPage >= 1 && newPage <= Math.ceil(this.totalItems() / 20)) {
      this.page.set(newPage);
      this.load();
    }
  }

  toggleExpand(cat: Category) {
    const set = new Set(this.expanded());
    if (set.has(cat.id)) {
      set.delete(cat.id);
      this.expanded.set(set);
    } else {
      set.add(cat.id);
      this.expanded.set(set);
      if (!this.subcategories()[cat.id]) {
        this.loadSubcategories(cat.id);
      }
    }
  }

  loadSubcategories(parentId: string) {
    this.subcategoriesLoading.update((s) => ({ ...s, [parentId]: true }));
    this.api.getAdminCategories({ parent: parentId }).subscribe({
      next: (r) => {
        this.subcategories.update((s) => ({
          ...s,
          [parentId]: r.results || r,
        }));
        this.subcategoriesLoading.update((s) => ({ ...s, [parentId]: false }));
      },
      error: () =>
        this.subcategoriesLoading.update((s) => ({ ...s, [parentId]: false })),
    });
  }

  isExpanded(id: string) {
    return this.expanded().has(id);
  }

  openCreate(parentId: string | null = null) {
    this.editTarget.set(null);
    this.form = {
      name: '',
      slug: '',
      description: '',
      icon_name: '',
      is_active: true,
      show_in_customer_ui: true,
      parent: parentId,
    };
    this.error.set('');
    this.showModal.set(true);
  }

  openEdit(cat: Category) {
    this.editTarget.set(cat);
    this.form = {
      name: cat.name,
      slug: cat.slug,
      description: cat.description,
      icon_name: cat.icon_name || '',
      is_active: cat.is_active,
      show_in_customer_ui: cat.show_in_customer_ui,
      parent: cat.parent ?? null,
    };
    this.error.set('');
    this.showModal.set(true);
  }

  toggleCustomerUi(cat: Category) {
    const updated = !cat.show_in_customer_ui;
    this.api
      .updateAdminCategory(cat.id, { show_in_customer_ui: updated })
      .subscribe({
        next: () => {
          // Refresh the right level
          if (cat.parent) {
            this.subcategories.update((s) => ({
              ...s,
              [cat.parent!]: (s[cat.parent!] || []).map((c) =>
                c.id === cat.id ? { ...c, show_in_customer_ui: updated } : c,
              ),
            }));
          } else {
            this.categories.update((cats) =>
              cats.map((c) =>
                c.id === cat.id ? { ...c, show_in_customer_ui: updated } : c,
              ),
            );
          }
        },
      });
  }

  closeModal() {
    this.showModal.set(false);
  }

  save() {
    if (!this.form.name.trim()) {
      this.error.set('Name is required.');
      return;
    }
    this.saving.set(true);
    this.error.set('');
    const data: any = {
      ...this.form,
      icon_name: this.renderableIconValue(this.form.icon_name),
    };
    if (!data.parent) data.parent = null;
    const target = this.editTarget();
    const req = target
      ? this.api.updateAdminCategory(target.id, data)
      : this.api.createAdminCategory(data);
    req.subscribe({
      next: () => {
        this.saving.set(false);
        this.showModal.set(false);
        // If was editing a subcategory, reload that parent's subs; else reload root
        if (this.form.parent) {
          this.subcategories.update((s) => {
            const n = { ...s };
            delete n[this.form.parent!];
            return n;
          });
          this.loadSubcategories(this.form.parent);
        } else {
          this.load();
        }
      },
      error: (err: any) => {
        this.saving.set(false);
        this.error.set(
          err.error?.detail || err.error?.name?.[0] || 'Save failed.',
        );
      },
    });
  }

  delete(cat: Category) {
    if (!confirm(`Delete category "${cat.name}"? This cannot be undone.`))
      return;
    this.api.deleteAdminCategory(cat.id).subscribe({
      next: () => {
        if (cat.parent) {
          this.subcategories.update((s) => ({
            ...s,
            [cat.parent!]: (s[cat.parent!] || []).filter(
              (c) => c.id !== cat.id,
            ),
          }));
        } else {
          this.load();
        }
      },
    });
  }

  autoSlug() {
    if (!this.editTarget()) {
      this.form.slug = this.form.name
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');
    }
  }

  selectIcon(option: CategoryIconOption) {
    this.form.icon_name = option.url;
  }

  selectEmoji(option: CategoryIconOption) {
    this.form.icon_name = option.url;
  }

  selectIconSuggestion(option: IconSuggestion) {
    this.form.icon_name =
      option.source === 'curated' && option.url ? option.url : option.key;
  }

  iconSuggestions(): IconSuggestion[] {
    const query = this.normalizeIconText(this.form.icon_name);
    if (query.length < 2) return [];

    const curated: IconSuggestion[] = this.categoryIconOptions.map(
      (option) => ({
        ...option,
        source: 'curated',
        aliases: this.iconAliases(option.key, option.label),
      }),
    );

    return [...curated, ...this.materialIconSuggestions]
      .map((option) => ({ option, score: this.iconMatchScore(option, query) }))
      .filter((item) => item.score < 99)
      .sort(
        (a, b) =>
          a.score - b.score || a.option.label.localeCompare(b.option.label),
      )
      .slice(0, 8)
      .map((item) => item.option);
  }

  iconArtwork(iconName?: string | null) {
    if (!iconName) return '';
    if (this.isEmojiIcon(iconName)) return '';
    if (this.isImageLike(iconName)) return iconName;
    return (
      this.categoryIconOptions.find((option) => option.key === iconName)?.url ||
      ''
    );
  }

  iconLabel(iconName?: string | null) {
    if (!iconName) return '';
    return (
      this.categoryIconOptions.find(
        (option) => option.key === iconName || option.url === iconName,
      )?.label || iconName
    );
  }

  iconSelected(option: CategoryIconOption) {
    return (
      this.form.icon_name === option.url || this.form.icon_name === option.key
    );
  }

  emojiSelected(option: CategoryIconOption) {
    return this.form.icon_name === option.url;
  }

  isEmojiIcon(value?: string | null) {
    const text = String(value || '').trim();
    if (!text) return false;
    if (/^(https?:|data:image\/|\/|\.\/|\.\.\/)/i.test(text)) return false;
    if (/\.(png|jpe?g|webp|gif|svg)(\?.*)?$/i.test(text)) return false;
    if (/^[a-z0-9_ -]+$/i.test(text)) return false;
    return /\p{Extended_Pictographic}/u.test(text);
  }

  fallbackEmoji(cat: Category) {
    const key = `${cat.slug || ''} ${cat.name || ''}`.toLowerCase();
    if (key.includes('fruit') || key.includes('vegetable')) return '🥦';
    if (key.includes('dairy') || key.includes('breakfast')) return '🥛';
    if (key.includes('snack') || key.includes('munch')) return '🍿';
    if (key.includes('beverage') || key.includes('drink')) return '🥤';
    if (key.includes('bakery') || key.includes('bread')) return '🥐';
    if (key.includes('pantry') || key.includes('staple')) return '🧺';
    if (key.includes('personal')) return '🧴';
    if (key.includes('home')) return '🧽';
    if (key.includes('health') || key.includes('pharmacy')) return '💊';
    return '🛍️';
  }

  suggestionSelected(option: IconSuggestion) {
    return (
      this.form.icon_name ===
        (option.source === 'curated' && option.url ? option.url : option.key) ||
      this.form.icon_name === option.key
    );
  }

  iconImageFailed(url?: string | null) {
    return !!url && this.failedIconUrls().has(url);
  }

  markIconImageFailed(url?: string | null) {
    if (!url) return;
    this.failedIconUrls.update((values) => {
      const next = new Set(values);
      next.add(url);
      return next;
    });
  }

  displayIcon(cat: Category) {
    return cat.icon_name || (cat.parent ? 'folder_open' : 'folder');
  }

  private iconAliases(key: string, label: string): string[] {
    const normalizedKey = this.normalizeIconText(key);
    const normalizedLabel = this.normalizeIconText(label);
    const aliasMap: Record<string, string[]> = {
      groceries: ['grocery', 'shopping', 'basket', 'store'],
      fruits: ['fruit', 'vegetable', 'healthy', 'produce', 'food'],
      dairy: ['milk', 'cheese', 'yogurt', 'food'],
      snacks: ['snack', 'chips', 'food'],
      beverages: ['beverage', 'drink', 'juice', 'coffee', 'tea'],
      restaurant: ['food', 'meal', 'dining'],
      meal: ['food', 'lunch', 'dinner', 'restaurant'],
      electronics: ['device', 'phone', 'mobile', 'gadget'],
      fashion: ['clothes', 'apparel', 'style'],
      personalcare: ['personal care', 'beauty', 'cosmetics', 'skincare'],
      homecare: ['home care', 'cleaning', 'spray'],
      pharmacy: ['medicine', 'medical', 'health'],
      babycare: ['baby care', 'baby', 'child'],
      petcare: ['pet care', 'pet', 'dog', 'cat'],
      bakery: ['bread', 'cake', 'food'],
      protein: ['meat', 'egg', 'food'],
    };
    return [normalizedKey, normalizedLabel, ...(aliasMap[normalizedKey] || [])];
  }

  private iconMatchScore(option: IconSuggestion, query: string): number {
    const haystack = [option.key, option.label, ...option.aliases].map(
      (value) => this.normalizeIconText(value),
    );

    if (haystack.some((value) => value === query)) return 0;
    if (haystack.some((value) => value.startsWith(query))) return 1;
    if (
      haystack.some((value) => value.includes(query) || query.includes(value))
    )
      return 2;
    return 99;
  }

  private normalizeIconText(value: string) {
    return value
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/[_-]/g, ' ')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
  }

  private renderableIconValue(value: string) {
    const raw = value.trim();
    if (!raw) return '';
    return (
      this.categoryIconOptions.find((option) => option.key === raw)?.url || raw
    );
  }

  private isImageLike(value: string) {
    return (
      /^(https?:|data:image\/|\/|\.\/|\.\.\/)/i.test(value) ||
      /\.(png|jpe?g|webp|gif|svg)(\?.*)?$/i.test(value)
    );
  }
}
