import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService, Product, ToastService } from '@shared/public-api';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-vendor-variant-approvals',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="variant-approvals-page">
      <section class="hero">
        <div>
          <h1>Product Approvals</h1>
          <p>Review new products and vendor edits before customer visibility.</p>
        </div>
        <button class="btn-refresh" (click)="load()" [disabled]="loading()">
          <span class="material-icons-outlined" [class.spin]="loading()">refresh</span>
        </button>
      </section>

      <section class="stats">
        <article><span>Pending</span><strong>{{ pendingCount() }}</strong></article>
        <article><span>Vendors</span><strong>{{ vendorCount() }}</strong></article>
        <article><span>Review Types</span><strong>{{ reviewTypeCount() }}</strong></article>
      </section>

      @if (loading()) {
        <div class="state">Loading pending variants...</div>
      } @else if (items().length === 0) {
        <div class="state">No pending variants right now.</div>
      } @else {
        <section class="batch-toolbar">
          <div class="batch-left">
            <label class="select-all">
              <input type="checkbox" [checked]="allSelected()" (change)="toggleSelectAll($any($event.target).checked)">
              <span>Select all</span>
            </label>
            <span class="selected-count">{{ selectedCount() }} selected</span>
          </div>
          <div class="batch-actions">
            <button class="approve" (click)="approveSelected()" [disabled]="selectedCount() === 0 || saving()">Approve Selected</button>
            <button class="reject" (click)="openBatchReject()" [disabled]="selectedCount() === 0 || saving()">Reject Selected</button>
          </div>
        </section>
        <section class="table">
          <header>
            <span>Select</span>
            <span>Variant</span>
            <span>Vendor</span>
            <span>Base Catalog</span>
            <span>Changes</span>
            <span>Price / Stock</span>
            <span>Status</span>
            <span>Actions</span>
          </header>
          @for (item of items(); track item.id) {
            <div class="row">
              <div>
                <input type="checkbox" [checked]="isSelected(item.id)" (change)="toggleSelection(item.id, $any($event.target).checked)">
              </div>
              <div>
                <strong>{{ item.name }}</strong>
                <small>{{ item.brand || 'No brand' }} · {{ item.weight || '-' }} {{ item.unit || '' }}</small>
              </div>
              <div>{{ item.vendor.store_name || '-' }}</div>
              <div>{{ item.catalog_product?.name || '-' }}</div>
              <div>{{ changeSummary(item) }}</div>
              <div>{{ item.price }} / {{ item.stock }}</div>
              <div><span class="chip pending">{{ item.approval_status || 'pending_approval' }}</span></div>
              <div class="actions">
                <button class="approve" (click)="approve(item)">Approve</button>
                <button class="reject" (click)="openReject(item)">Reject</button>
              </div>
            </div>
          }
        </section>
      }
    </div>

    @if (rejectingItem()) {
      <div class="overlay" (click)="closeReject()">
        <div class="modal" (click)="$event.stopPropagation()">
          <h3>Reject Variant</h3>
          <p>{{ rejectingItem()?.name }}</p>
          <textarea [(ngModel)]="rejectReason" placeholder="Enter rejection reason"></textarea>
          <div class="modal-actions">
            <button class="ghost" (click)="closeReject()">Cancel</button>
            <button class="reject" (click)="confirmReject()" [disabled]="saving()">{{ saving() ? 'Saving...' : 'Reject' }}</button>
          </div>
        </div>
      </div>
    }

    @if (batchRejectOpen()) {
      <div class="overlay" (click)="closeBatchReject()">
        <div class="modal" (click)="$event.stopPropagation()">
          <h3>Reject Selected Variants</h3>
          <p>{{ selectedCount() }} variants selected</p>
          <textarea [(ngModel)]="batchRejectReason" placeholder="Enter rejection reason"></textarea>
          <div class="modal-actions">
            <button class="ghost" (click)="closeBatchReject()">Cancel</button>
            <button class="reject" (click)="confirmBatchReject()" [disabled]="saving()">{{ saving() ? 'Saving...' : 'Reject Selected' }}</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .variant-approvals-page { display:flex; flex-direction:column; gap:1rem; }
    .hero { display:flex; justify-content:space-between; align-items:center; padding:1rem; border:1px solid var(--border-color); border-radius:8px; background:#fff; }
    .hero h1 { margin:0; font-size:1.4rem; font-weight:900; }
    .hero p { margin:.25rem 0 0; color:var(--text-muted); font-weight:700; }
    .btn-refresh { width:40px; height:40px; border:1px solid var(--border-color); border-radius:8px; background:#fff; cursor:pointer; }
    .stats { display:grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap:.75rem; }
    .stats article { border:1px solid var(--border-color); border-radius:8px; background:#fff; padding:.9rem; display:flex; flex-direction:column; gap:.2rem; }
    .stats span { color:var(--text-muted); font-size:.76rem; font-weight:800; }
    .stats strong { font-size:1.35rem; font-weight:950; }
    .state { border:1px dashed var(--border-color); border-radius:8px; background:#fff; padding:1.25rem; text-align:center; color:var(--text-muted); font-weight:700; }
    .table { border:1px solid var(--border-color); border-radius:8px; overflow:hidden; background:#fff; }
    .batch-toolbar { display:flex; justify-content:space-between; align-items:center; gap:.75rem; border:1px solid var(--border-color); border-radius:8px; background:#fff; padding:.7rem .9rem; }
    .batch-left, .batch-actions { display:flex; align-items:center; gap:.75rem; }
    .select-all { display:inline-flex; align-items:center; gap:.45rem; font-weight:800; color:var(--text-secondary); }
    .selected-count { color:var(--text-muted); font-size:.82rem; font-weight:800; }
    .table header, .row { display:grid; grid-template-columns: .45fr 1.6fr 1fr 1.1fr 1.2fr .85fr .9fr 1.1fr; gap:.75rem; padding:.8rem 1rem; align-items:center; }
    .table header { background:#f8fafc; font-size:.76rem; font-weight:900; color:var(--text-muted); border-bottom:1px solid var(--border-light); text-transform:uppercase; }
    .row { border-top:1px solid var(--border-light); }
    .row strong { display:block; font-size:.92rem; font-weight:900; }
    .row small { color:var(--text-muted); font-weight:700; }
    .chip { border-radius:999px; padding:.2rem .55rem; font-size:.72rem; font-weight:900; text-transform:uppercase; }
    .chip.pending { background:#fff7ed; color:#c2410c; }
    .actions { display:flex; gap:.45rem; }
    .approve,.reject,.ghost { border:1px solid var(--border-color); border-radius:8px; padding:.45rem .7rem; font-weight:800; cursor:pointer; background:#fff; }
    .approve { color:#166534; border-color:#bbf7d0; background:#f0fdf4; }
    .reject { color:#b91c1c; border-color:#fecaca; background:#fff1f2; }
    .overlay { position:fixed; inset:0; background:rgba(2,6,23,.45); display:flex; align-items:center; justify-content:center; z-index:1000; padding:1rem; }
    .modal { width:min(460px,100%); background:#fff; border-radius:8px; border:1px solid var(--border-color); padding:1rem; }
    .modal h3 { margin:.1rem 0; }
    .modal p { margin:.2rem 0 .6rem; color:var(--text-muted); font-weight:700; }
    .modal textarea { width:100%; min-height:120px; border:1px solid var(--border-color); border-radius:8px; padding:.7rem; font:inherit; }
    .modal-actions { margin-top:.75rem; display:flex; justify-content:flex-end; gap:.55rem; }
    .spin { animation:spin .9s linear infinite; }
    @keyframes spin { to { transform:rotate(360deg); } }
    @media (max-width: 980px) {
      .table header, .row { grid-template-columns: .45fr 1.5fr 1fr 1fr 1.1fr .85fr .9fr 1.1fr; }
    }
  `]
})
export class VendorVariantApprovalsComponent implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);

  items = signal<Product[]>([]);
  selectedIds = signal<Set<string>>(new Set<string>());
  loading = signal(false);
  saving = signal(false);
  rejectingItem = signal<Product | null>(null);
  batchRejectOpen = signal(false);
  rejectReason = '';
  batchRejectReason = '';

  pendingCount = computed(() => this.items().length);
  vendorCount = computed(() => new Set(this.items().map(item => item.vendor?.id).filter(Boolean)).size);
  reviewTypeCount = computed(() => new Set(this.items().map(item => this.changeSummary(item)).filter(Boolean)).size);
  selectedCount = computed(() => this.selectedIds().size);
  allSelected = computed(() => this.items().length > 0 && this.selectedIds().size === this.items().length);

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.api.getAdminPendingVendorProducts({ page_size: 200 }).subscribe({
      next: (res) => {
        const rows = res.results || res;
        this.items.set(rows || []);
        this.selectedIds.set(new Set<string>());
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.toast.show('Failed to load pending variants.', 'error');
      }
    });
  }

  approve(item: Product) {
    this.api.approveAdminVendorProduct(item.id).subscribe({
      next: () => {
        this.toast.show('Variant approved.', 'success');
        this.items.update(list => list.filter(row => row.id !== item.id));
        this.selectedIds.update(set => {
          const next = new Set(set);
          next.delete(item.id);
          return next;
        });
      },
      error: () => this.toast.show('Failed to approve variant.', 'error')
    });
  }

  changeSummary(item: Product): string {
    const changes = item.approval_change_summary || [];
    if (changes.includes('new_product')) return 'New product';
    if (!changes.length) return 'Review requested';
    return changes.map(value => value.replace(/_/g, ' ')).join(', ');
  }

  openReject(item: Product) {
    this.rejectingItem.set(item);
    this.rejectReason = '';
  }

  closeReject() {
    this.rejectingItem.set(null);
    this.rejectReason = '';
  }

  confirmReject() {
    const item = this.rejectingItem();
    if (!item) return;
    if (!this.rejectReason.trim()) {
      this.toast.show('Rejection reason is required.', 'error');
      return;
    }
    this.saving.set(true);
    this.api.rejectAdminVendorProduct(item.id, this.rejectReason.trim()).subscribe({
      next: () => {
      this.saving.set(false);
      this.toast.show('Variant rejected.', 'success');
      this.items.update(list => list.filter(row => row.id !== item.id));
      this.selectedIds.update(set => {
        const next = new Set(set);
        next.delete(item.id);
        return next;
      });
      this.closeReject();
      },
      error: () => {
        this.saving.set(false);
        this.toast.show('Failed to reject variant.', 'error');
      }
    });
  }

  isSelected(id: string): boolean {
    return this.selectedIds().has(id);
  }

  toggleSelection(id: string, checked: boolean) {
    this.selectedIds.update(set => {
      const next = new Set(set);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  toggleSelectAll(checked: boolean) {
    if (!checked) {
      this.selectedIds.set(new Set<string>());
      return;
    }
    this.selectedIds.set(new Set(this.items().map(item => item.id)));
  }

  async approveSelected() {
    const ids = Array.from(this.selectedIds());
    if (ids.length === 0) return;
    this.saving.set(true);
    let successCount = 0;
    for (const id of ids) {
      try {
        await firstValueFrom(this.api.approveAdminVendorProduct(id));
        successCount += 1;
      } catch {}
    }
    this.saving.set(false);
    this.toast.show(`Approved ${successCount} variants.`, successCount ? 'success' : 'error');
    this.load();
  }

  openBatchReject() {
    this.batchRejectReason = '';
    this.batchRejectOpen.set(true);
  }

  closeBatchReject() {
    this.batchRejectOpen.set(false);
    this.batchRejectReason = '';
  }

  async confirmBatchReject() {
    const ids = Array.from(this.selectedIds());
    if (!this.batchRejectReason.trim()) {
      this.toast.show('Rejection reason is required.', 'error');
      return;
    }
    this.saving.set(true);
    let successCount = 0;
    for (const id of ids) {
      try {
        await firstValueFrom(this.api.rejectAdminVendorProduct(id, this.batchRejectReason.trim()));
        successCount += 1;
      } catch {}
    }
    this.saving.set(false);
    this.closeBatchReject();
    this.toast.show(`Rejected ${successCount} variants.`, successCount ? 'success' : 'error');
    this.load();
  }
}
