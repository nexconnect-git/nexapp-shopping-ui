import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { Subscription, timer } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, Category } from '@shared/public-api';

type CategoryIconOption = {
  key: string;
  label: string;
  url: string;
};

const CATEGORY_ICON_OPTIONS: CategoryIconOption[] = [
  { key: 'groceries', label: 'Groceries', url: 'https://img.icons8.com/3d-fluency/94/shopping-basket.png' },
  { key: 'fruits', label: 'Fruits', url: 'https://img.icons8.com/3d-fluency/94/vegetarian-food.png' },
  { key: 'dairy', label: 'Dairy', url: 'https://img.icons8.com/3d-fluency/94/milk-bottle.png' },
  { key: 'snacks', label: 'Snacks', url: 'https://img.icons8.com/3d-fluency/94/nachos.png' },
  { key: 'beverages', label: 'Beverages', url: 'https://img.icons8.com/3d-fluency/94/cola.png' },
  { key: 'restaurant', label: 'Restaurant', url: 'https://img.icons8.com/3d-fluency/94/restaurant.png' },
  { key: 'meal', label: 'Meal', url: 'https://img.icons8.com/3d-fluency/94/meal.png' },
  { key: 'electronics', label: 'Electronics', url: 'https://img.icons8.com/3d-fluency/94/smartphone-tablet.png' },
  { key: 'fashion', label: 'Fashion', url: 'https://img.icons8.com/3d-fluency/94/clothes.png' },
  { key: 'personalCare', label: 'Personal care', url: 'https://img.icons8.com/3d-fluency/94/lipstick.png' },
  { key: 'homeCare', label: 'Home care', url: 'https://img.icons8.com/3d-fluency/94/spray.png' },
  { key: 'pharmacy', label: 'Pharmacy', url: 'https://img.icons8.com/3d-fluency/94/medical-bag.png' },
  { key: 'babyCare', label: 'Baby care', url: 'https://img.icons8.com/3d-fluency/94/pacifier.png' },
  { key: 'petCare', label: 'Pet care', url: 'https://img.icons8.com/3d-fluency/94/dog.png' },
  { key: 'bakery', label: 'Bakery', url: 'https://img.icons8.com/3d-fluency/94/baguette.png' },
  { key: 'protein', label: 'Protein', url: 'https://img.icons8.com/3d-fluency/94/steak.png' }
];

@Component({
  selector: 'app-categories',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './categories.component.html',
  styleUrl: './categories.component.scss'
})
export class CategoriesComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  readonly categoryIconOptions = CATEGORY_ICON_OPTIONS;
  categories = signal<Category[]>([]);
  totalItems = signal(0);
  page = signal(1);
  loading = signal(true);
  saving = signal(false);
  error = signal('');
  Math = Math;

  // Subcategory expand state: parentId -> subcategory[]
  expanded = signal<Set<string>>(new Set());
  subcategories = signal<Record<string, Category[]>>({});
  subcategoriesLoading = signal<Record<string, boolean>>({});

  lastRefreshed = signal<Date | null>(null);
  autoReload = signal(true);
  private reloadSub?: Subscription;

  showModal = signal(false);
  editTarget = signal<Category | null>(null);

  form = { name: '', slug: '', description: '', icon_name: '', is_active: true, show_in_customer_ui: true, parent: null as string | null };

  ngOnInit() {
    this.reloadSub = timer(0, 15000).subscribe(() => {
      if (this.autoReload() && !this.showModal()) this.load();
    });
  }

  ngOnDestroy() { this.reloadSub?.unsubscribe(); }

  manualReload() { this.load(); }
  toggleAutoReload() { this.autoReload.update(v => !v); }

  load() {
    this.loading.set(true);
    this.api.getAdminCategories({ parent: 'root', page: this.page() }).subscribe({
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
    this.subcategoriesLoading.update(s => ({ ...s, [parentId]: true }));
    this.api.getAdminCategories({ parent: parentId }).subscribe({
      next: (r) => {
        this.subcategories.update(s => ({ ...s, [parentId]: r.results || r }));
        this.subcategoriesLoading.update(s => ({ ...s, [parentId]: false }));
      },
      error: () => this.subcategoriesLoading.update(s => ({ ...s, [parentId]: false }))
    });
  }

  isExpanded(id: string) { return this.expanded().has(id); }

  openCreate(parentId: string | null = null) {
    this.editTarget.set(null);
    this.form = { name: '', slug: '', description: '', icon_name: '', is_active: true, show_in_customer_ui: true, parent: parentId };
    this.error.set('');
    this.showModal.set(true);
  }

  openEdit(cat: Category) {
    this.editTarget.set(cat);
    this.form = { name: cat.name, slug: cat.slug, description: cat.description, icon_name: cat.icon_name || '', is_active: cat.is_active, show_in_customer_ui: cat.show_in_customer_ui, parent: cat.parent ?? null };
    this.error.set('');
    this.showModal.set(true);
  }

  toggleCustomerUi(cat: Category) {
    const updated = !cat.show_in_customer_ui;
    this.api.updateAdminCategory(cat.id, { show_in_customer_ui: updated }).subscribe({
      next: () => {
        // Refresh the right level
        if (cat.parent) {
          this.subcategories.update(s => ({
            ...s,
            [cat.parent!]: (s[cat.parent!] || []).map(c => c.id === cat.id ? { ...c, show_in_customer_ui: updated } : c)
          }));
        } else {
          this.categories.update(cats => cats.map(c => c.id === cat.id ? { ...c, show_in_customer_ui: updated } : c));
        }
      }
    });
  }

  closeModal() { this.showModal.set(false); }

  save() {
    if (!this.form.name.trim()) { this.error.set('Name is required.'); return; }
    this.saving.set(true);
    this.error.set('');
    const data: any = { ...this.form };
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
          this.subcategories.update(s => { const n = { ...s }; delete n[this.form.parent!]; return n; });
          this.loadSubcategories(this.form.parent);
        } else {
          this.load();
        }
      },
      error: (err: any) => { this.saving.set(false); this.error.set(err.error?.detail || err.error?.name?.[0] || 'Save failed.'); }
    });
  }

  delete(cat: Category) {
    if (!confirm(`Delete category "${cat.name}"? This cannot be undone.`)) return;
    this.api.deleteAdminCategory(cat.id).subscribe({
      next: () => {
        if (cat.parent) {
          this.subcategories.update(s => ({ ...s, [cat.parent!]: (s[cat.parent!] || []).filter(c => c.id !== cat.id) }));
        } else {
          this.load();
        }
      }
    });
  }

  autoSlug() {
    if (!this.editTarget()) {
      this.form.slug = this.form.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    }
  }

  selectIcon(option: CategoryIconOption) {
    this.form.icon_name = option.key;
  }

  iconArtwork(iconName?: string | null) {
    if (!iconName) return '';
    return this.categoryIconOptions.find(option => option.key === iconName)?.url || '';
  }

  iconLabel(iconName?: string | null) {
    if (!iconName) return '';
    return this.categoryIconOptions.find(option => option.key === iconName)?.label || iconName;
  }

  displayIcon(cat: Category) {
    return cat.icon_name || (cat.parent ? 'folder_open' : 'folder');
  }
}
