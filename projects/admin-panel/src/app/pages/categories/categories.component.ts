import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { Subscription, timer } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, Category } from '@shared/public-api';

@Component({
  selector: 'app-categories',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './categories.component.html',
  styleUrl: './categories.component.scss'
})
export class CategoriesComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
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

  form = { name: '', slug: '', description: '', is_active: true, parent: null as string | null };

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
    this.form = { name: '', slug: '', description: '', is_active: true, parent: parentId };
    this.error.set('');
    this.showModal.set(true);
  }

  openEdit(cat: Category) {
    this.editTarget.set(cat);
    this.form = { name: cat.name, slug: cat.slug, description: cat.description, is_active: cat.is_active, parent: cat.parent ?? null };
    this.error.set('');
    this.showModal.set(true);
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
}
