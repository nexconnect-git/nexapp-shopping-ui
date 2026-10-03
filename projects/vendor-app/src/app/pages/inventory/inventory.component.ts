import {
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  apiErrorMessage,
  Product,
  VendorApi,
  VendorWorkspaceApi,
} from '@shared/public-api';
import { WorkspacePagerComponent } from '../../components/workspace-pager.component';
import { VendorContextService } from '../../services/vendor-context.service';

@Component({
  selector: 'app-inventory',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    WorkspacePagerComponent,
  ],
  templateUrl: './inventory.component.html',
  styleUrl: './inventory.component.scss',
})
export class InventoryComponent implements OnInit {
  private readonly api = inject(VendorWorkspaceApi);
  private readonly legacy = inject(VendorApi);
  private readonly destroy = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly store = inject(VendorContextService);
  readonly products = signal<Product[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly count = signal(0);
  readonly page = signal(1);
  readonly filter = signal('all');
  readonly summary = signal<Partial<Record<string, string | number>>>({});
  readonly drafts = signal<Record<string, string>>({});
  readonly rowErrors = signal<Record<string, string>>({});
  readonly pending = signal<ReadonlySet<string>>(new Set());
  readonly editedProducts = signal<ReadonlyMap<string, Product>>(new Map());
  readonly conflicts = signal<ReadonlySet<string>>(new Set());
  readonly success = signal('');
  search = '';
  private generation = 0;
  readonly filters = [
    { key: 'all', label: 'All' },
    { key: 'low', label: 'Low stock' },
    { key: 'out', label: 'Out of stock' },
    { key: 'paused', label: 'Unavailable' },
    { key: 'missing_photo', label: 'Missing photos' },
    { key: 'category_pending', label: 'Category pending' },
    { key: 'ready', label: 'Ready to sell' },
  ];
  readonly changed = computed(() =>
    [...this.editedProducts().values()].filter(
      (product) =>
        this.drafts()[product.id] !== undefined &&
        this.drafts()[product.id] !== String(product.stock)
    )
  );
  hasUnsavedChanges(): boolean {
    return Object.keys(this.drafts()).length > 0;
  }
  isSaving(): boolean {
    return this.pending().size > 0;
  }
  ngOnInit(): void {
    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe((params) => {
        this.page.set(Math.max(1, Number(params.get('page')) || 1));
        this.filter.set(params.get('health') || 'all');
        this.search = params.get('search') || '';
        this.load();
      });
  }
  query(page = 1): void {
    void this.router.navigate([], {
      queryParams: {
        page,
        health: this.filter() === 'all' ? null : this.filter(),
        search: this.search || null,
      },
    });
  }
  setFilter(value: string): void {
    this.filter.set(value);
    this.query();
  }
  load(): void {
    const generation = ++this.generation;
    this.loading.set(true);
    this.error.set('');
    this.api
      .products({
        page: this.page(),
        health: this.filter(),
        search: this.search,
      })
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (result) => {
          if (generation !== this.generation) return;
          this.products.set(result.results);
          this.count.set(result.count);
          this.summary.set(result.summary || {});
          this.loading.set(false);
        },
        error: (error) => {
          if (generation === this.generation) {
            this.error.set(
              apiErrorMessage(error, 'Inventory could not be loaded.')
            );
            this.loading.set(false);
          }
        },
      });
  }
  stockText(product: Product): string {
    return String(product.stock);
  }
  draft(product: Product): string {
    return this.drafts()[product.id] ?? String(product.stock);
  }
  edit(id: string, value: string | number | null): void {
    const text = value === null ? '' : String(value);
    const product = this.products().find(row => row.id === id) || this.editedProducts().get(id);
    if (!product) return;
    this.success.set('');
    this.editedProducts.update(current => { const next = new Map(current); if (!next.has(id)) next.set(id, product); return next; });
    this.drafts.update((current) => {
      const next = { ...current };
      if (
        text ===
        String(this.editedProducts().get(id)?.stock)
      )
        delete next[id];
      else next[id] = text;
      return next;
    });
    this.rowErrors.update((current) => ({
      ...current,
      [id]: this.valid(text) ? '' : 'Enter a non-negative whole number.',
    }));
  }
  save(product: Product): void {
    this.saveRows([product]);
  }
  saveRows(rows = this.changed()): void {
    if (!rows.length || this.pending().has('bulk')) return;
    if (rows.some(product => this.conflicts().has(product.id))) { this.error.set('Review the stock changed elsewhere before saving.'); return; }
    const invalid = rows.filter((product) => !this.valid(this.draft(product)));
    if (invalid.length) {
      this.rowErrors.update((current) => ({
        ...current,
        ...Object.fromEntries(
          invalid.map((product) => [
            product.id,
            'Enter a non-negative whole number.',
          ])
        ),
      }));
      return;
    }
    const submitted = rows.map((product) => ({
      id: product.id,
      stock: Number(this.draft(product)),
      expected_stock: this.editedProducts().get(product.id)?.stock ?? product.stock,
    }));
    submitted.forEach((row) => this.setPending(row.id, true));
    this.setPending('bulk', true);
    this.api
      .stock(submitted)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (result) => {
          this.products.update((list) =>
            list.map((product) =>
              result.updated.includes(product.id)
                ? {
                    ...product,
                    stock:
                      submitted.find((row) => row.id === product.id)?.stock ??
                      product.stock,
                  }
                : product
            )
          );
          this.drafts.update((current) => {
            const next = { ...current };
            for (const id of result.updated) {
              if (
                Number(next[id]) ===
                submitted.find((row) => row.id === id)?.stock
              )
                delete next[id];
            }
            return next;
          });
          this.rowErrors.update((current) => ({
            ...current,
            ...Object.fromEntries(result.updated.map(id => [id, ''])),
            ...Object.fromEntries(
              result.errors
                .filter((row) => row.id)
                .map((row) => [row.id, row.message])
            ),
          }));
          this.editedProducts.update(current => {
            const next = new Map(current);
            for (const id of result.updated) {
              if (this.drafts()[id] === undefined) next.delete(id);
              else if (next.has(id)) next.set(id, {...next.get(id)!,stock:submitted.find(row=>row.id===id)!.stock});
            }
            return next;
          });
          for (const failure of result.errors) {
            if (failure.id && failure.current_stock !== undefined) {
              const id=failure.id;
              this.products.update(list => list.map(product => product.id===id ? {...product,stock:failure.current_stock!} : product));
              this.conflicts.update(current => new Set([...current,id]));
            }
          }
          this.success.set(result.updated.length ? `${result.updated.length} stock change${result.updated.length===1?'':'s'} saved.` : '');
          this.error.set(
            result.errors.length
              ? result.updated.length +
                  ' rows saved; ' +
                  result.errors.length +
                  ' failed. Failed quantities remain for correction.'
              : ''
          );
          submitted.forEach((row) => this.setPending(row.id, false));
          this.setPending('bulk', false);
          this.store.refresh();
          this.refreshRows();
        },
        error: (error) => {
          this.error.set(
            apiErrorMessage(
              error,
              'Stock was not saved. Your quantities remain for retry.'
            )
          );
          submitted.forEach((row) => this.setPending(row.id, false));
          this.setPending('bulk', false);
        },
      });
  }
  discard(): void {
    if (this.isSaving()) return;
    this.drafts.set({}); this.editedProducts.set(new Map()); this.rowErrors.set({}); this.conflicts.set(new Set()); this.error.set('');
  }
  resolveConflict(product: Product, keepEdit: boolean): void {
    const latest = this.products().find(row => row.id === product.id);
    if (!latest) { this.error.set('Return to this product’s page and refresh its current stock before resolving this change.'); return; }
    if (keepEdit) this.editedProducts.update(current => { const next=new Map(current); next.set(product.id,latest); return next; });
    else this.drafts.update(current => { const next={...current}; delete next[product.id]; return next; });
    this.conflicts.update(current => { const next=new Set(current); next.delete(product.id); return next; });
    this.rowErrors.update(current => ({...current,[product.id]:''})); this.error.set('');
  }
  toggle(product: Product): void {
    if (this.pending().has(product.id)) return;
    this.setPending(product.id, true);
    this.legacy
      .patchProduct(product.id, { is_available: !product.is_available })
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: () => {
          this.setPending(product.id, false);
          this.load();
          this.store.refresh();
        },
        error: (error) => {
          this.rowErrors.update((current) => ({
            ...current,
            [product.id]: apiErrorMessage(
              error,
              'Availability was not changed.'
            ),
          }));
          this.setPending(product.id, false);
        },
      });
  }
  categoryName(product: Product): string {
    return product.category?.name || 'No category';
  }
  image(product: Product): string {
    return (
      product.images?.[0]?.image ||
      product.primary_image ||
      '/assets/placeholders/product.svg'
    );
  }
  imageError(event: Event): void {
    const element = event.target as HTMLImageElement;
    if (!element.src.endsWith('/assets/placeholders/product.svg'))
      element.src = '/assets/placeholders/product.svg';
  }
  private valid(value: string): boolean {
    return (
      /^\d+$/.test(value) &&
      Number.isSafeInteger(Number(value)) &&
      Number(value) <= 2147483647
    );
  }
  private setPending(id: string, value: boolean): void {
    this.pending.update((current) => {
      const next = new Set(current);
      if (value) next.add(id);
      else next.delete(id);
      return next;
    });
  }
  private refreshRows(): void {
    this.api
      .products({
        page: this.page(),
        health: this.filter(),
        search: this.search,
      })
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (result) => {
          this.products.set(result.results);
          this.count.set(result.count);
          this.summary.set(result.summary || {});
        },
        error: () =>
          this.error.update(
            (message) =>
              message +
              ' Saved quantities could not be refreshed. Retry refresh.'
          ),
      });
  }
}
