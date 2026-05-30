import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  ApiService,
  AppCurrencyPipe,
  DynamicTableColumn,
  DynamicTableComponent,
  Product,
  TableCellDirective,
  ToastService,
} from '@shared/public-api';
import { Subscription, timer } from 'rxjs';

@Component({
  selector: 'app-products',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    FormsModule,
    AppCurrencyPipe,
    DynamicTableComponent,
    TableCellDirective,
  ],
  templateUrl: './products.component.html',
  styleUrl: './products.component.scss',
})
export class ProductsComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private toast = inject(ToastService);

  readonly columns: DynamicTableColumn[] = [
    { key: 'product', label: 'Product', flex: 'minmax(260px, 2fr)' },
    { key: 'category', label: 'Category', flex: 'minmax(140px, 1fr)' },
    { key: 'price', label: 'Price', flex: 'minmax(120px, .8fr)' },
    { key: 'stock', label: 'Stock', flex: 'minmax(120px, .8fr)' },
    { key: 'growth', label: 'Growth', flex: 'minmax(170px, 1.2fr)' },
    { key: 'status', label: 'Status', flex: '120px' },
    { key: 'actions', label: 'Actions', flex: '100px', align: 'right' },
  ];

  products = signal<Product[]>([]);
  loading = signal(true);
  lastRefreshed = signal<Date | null>(null);
  autoReload = signal(true);
  deleteTarget = signal<Product | null>(null);
  fixesTarget = signal<Product | null>(null);
  deleting = signal(false);
  submittingApproval = signal<string | null>(null);
  readonly productPlaceholderImage = '/assets/placeholders/product.svg';

  // Pagination
  page = signal(1);
  total = signal(0);
  totalPages = signal(1);
  readonly pageSize = 20;
  Math = Math;

  search = '';
  private searchTimer: any;
  private reloadSub?: Subscription;

  ngOnInit() {
    this.reloadSub = timer(0, 15000).subscribe(() => {
      if (this.autoReload() && !this.deleteTarget()) this.load();
    });
  }

  ngOnDestroy() {
    this.reloadSub?.unsubscribe();
  }

  manualReload() {
    this.page.set(1);
    this.load();
  }
  toggleAutoReload() {
    this.autoReload.update((v) => !v);
  }

  load() {
    this.loading.set(true);
    const params: any = { page: this.page() };
    if (this.search) params.search = this.search;
    this.api.getVendorProducts(params).subscribe({
      next: (r) => {
        this.products.set(r.results || r);
        this.total.set(r.count || (r.results || r).length);
        this.totalPages.set(
          Math.ceil((r.count || (r.results || r).length) / this.pageSize) || 1,
        );
        this.loading.set(false);
        this.lastRefreshed.set(new Date());
      },
      error: () => {
        this.loading.set(false);
        this.toast.show('Failed to load products.', 'error');
      },
    });
  }

  onSearch() {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.page.set(1);
      this.load();
    }, 400);
  }

  setPage(p: number) {
    if (p >= 1 && p <= this.totalPages()) {
      this.page.set(p);
      this.load();
    }
  }

  pageNumbers(): number[] {
    const total = this.totalPages();
    const cur = this.page();
    const range: number[] = [];
    for (let i = Math.max(1, cur - 2); i <= Math.min(total, cur + 2); i++)
      range.push(i);
    return range;
  }

  isLowStock(product: Product): boolean {
    return (
      product.low_stock_threshold > 0 &&
      product.stock <= product.low_stock_threshold
    );
  }

  productImage(product: Product): string {
    return product.primary_image || this.productPlaceholderImage;
  }

  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement | null;
    if (!img || img.src.includes(this.productPlaceholderImage)) return;
    img.src = this.productPlaceholderImage;
  }

  needsAttention(product: Product): boolean {
    return (
      product.visibility_status === 'needs_attention' ||
      !!product.visibility_blockers?.length
    );
  }

  productHealthLabel(product: Product): string {
    if (!this.needsAttention(product)) return 'Ready to sell';
    return `${product.visibility_blockers?.length || 1} fix${(product.visibility_blockers?.length || 1) > 1 ? 'es' : ''} needed`;
  }

  openFixes(product: Product) {
    const blockers = product.visibility_blockers || [];
    if (!blockers.length) {
      this.toast.show('This product is ready to sell.', 'success');
      return;
    }
    this.fixesTarget.set(product);
  }

  closeFixes() {
    this.fixesTarget.set(null);
  }

  categoryVisibilityLabel(product: Product): string {
    if (product.category_visibility === 'customer_visible')
      return 'Customer visible';
    if (product.category_visibility === 'pending_review')
      return 'Category pending';
    return 'No category';
  }

  approvalClass(product: Product): string {
    return `approval-chip ${product.approval_status || 'draft'}`;
  }

  approvalText(product: Product): string {
    return (
      product.approval_status_label ||
      (product.approval_status || 'Draft').replace('_', ' ')
    );
  }

  approvalReason(product: Product): string {
    if (product.approval_status === 'pending_approval')
      return 'Hidden until admin approval.';
    if (product.approval_status === 'rejected')
      return product.rejection_reason || 'Rejected by admin.';
    if (product.approval_status === 'draft')
      return 'Draft products are not customer visible.';
    return product.is_available && product.status === 'active'
      ? 'Customer visible'
      : 'Approved but offline.';
  }

  canSubmitForApproval(product: Product | null): boolean {
    if (!product) return false;
    return (
      product.approval_status === 'draft' ||
      product.approval_status === 'rejected'
    );
  }

  submitForApproval(product: Product | null) {
    if (!product || !this.canSubmitForApproval(product)) return;
    this.submittingApproval.set(product.id);
    this.api.submitInheritedProducts([product.id]).subscribe({
      next: (res) => {
        const submitted = (res?.variants || []).find(
          (item: Product) => item.id === product.id,
        );
        this.products.update((items) =>
          items.map((item) =>
            item.id === product.id
              ? {
                  ...item,
                  ...(submitted || {}),
                  approval_status:
                    submitted?.approval_status || 'pending_approval',
                  approval_status_label:
                    submitted?.approval_status_label || 'Pending Approval',
                  rejection_reason: submitted?.rejection_reason || '',
                }
              : item,
          ),
        );
        if (this.fixesTarget()?.id === product.id) {
          this.fixesTarget.update((current) =>
            current
              ? {
                  ...current,
                  ...(submitted || {}),
                  approval_status:
                    submitted?.approval_status || 'pending_approval',
                  approval_status_label:
                    submitted?.approval_status_label || 'Pending Approval',
                  rejection_reason: submitted?.rejection_reason || '',
                }
              : current,
          );
        }
        this.submittingApproval.set(null);
        this.toast.show('Product submitted for admin approval.', 'success');
      },
      error: (err) => {
        this.submittingApproval.set(null);
        const raw = err?.error?.error;
        const message =
          typeof raw === 'string'
            ? raw
            : 'Fix product validation errors before submitting for approval.';
        this.toast.show(message, 'error');
      },
    });
  }

  confirmDelete(product: Product) {
    this.deleteTarget.set(product);
  }
  cancelDelete() {
    this.deleteTarget.set(null);
  }

  doDelete() {
    const p = this.deleteTarget();
    if (!p) return;
    this.deleting.set(true);
    this.api.deleteProduct(p.id).subscribe({
      next: () => {
        this.deleting.set(false);
        this.deleteTarget.set(null);
        this.toast.show(`"${p.name}" deleted.`, 'success');
        this.load();
      },
      error: () => {
        this.deleting.set(false);
        this.toast.show('Failed to delete product.', 'error');
      },
    });
  }
}
