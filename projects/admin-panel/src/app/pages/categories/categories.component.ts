import { Component, inject, signal, OnInit } from '@angular/core';
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
export class CategoriesComponent implements OnInit {
  private api = inject(ApiService);
  categories = signal<Category[]>([]);
  loading = signal(true);
  saving = signal(false);
  error = signal('');

  // Subcategory expand state: parentId -> subcategory[]
  expanded = signal<Set<string>>(new Set());
  subcategories = signal<Record<string, Category[]>>({});
  subcategoriesLoading = signal<Record<string, boolean>>({});

  showModal = signal(false);
  editTarget = signal<Category | null>(null);

  form = { name: '', slug: '', description: '', is_active: true, parent: null as string | null };

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    // Load root categories only
    this.api.getAdminCategories({ parent: 'root' }).subscribe({
      next: (r) => { this.categories.set(r.results || r); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
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
