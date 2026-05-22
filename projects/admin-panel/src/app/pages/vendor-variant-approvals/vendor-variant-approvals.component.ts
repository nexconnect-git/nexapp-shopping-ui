import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService, Product, ToastService } from '@shared/public-api';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-vendor-variant-approvals',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './vendor-variant-approvals.component.html',
  styleUrl: './vendor-variant-approvals.component.scss',
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
  vendorCount = computed(
    () =>
      new Set(
        this.items()
          .map((item) => item.vendor?.id)
          .filter(Boolean),
      ).size,
  );
  reviewTypeCount = computed(
    () =>
      new Set(
        this.items()
          .map((item) => this.changeSummary(item))
          .filter(Boolean),
      ).size,
  );
  selectedCount = computed(() => this.selectedIds().size);
  allSelected = computed(
    () =>
      this.items().length > 0 &&
      this.selectedIds().size === this.items().length,
  );

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
      },
    });
  }

  approve(item: Product) {
    this.api.approveAdminVendorProduct(item.id).subscribe({
      next: () => {
        this.toast.show('Variant approved.', 'success');
        this.items.update((list) => list.filter((row) => row.id !== item.id));
        this.selectedIds.update((set) => {
          const next = new Set(set);
          next.delete(item.id);
          return next;
        });
      },
      error: () => this.toast.show('Failed to approve variant.', 'error'),
    });
  }

  changeSummary(item: Product): string {
    const changes = item.approval_change_summary || [];
    if (changes.includes('new_product')) return 'New product';
    if (!changes.length) return 'Review requested';
    return changes.map((value) => value.replace(/_/g, ' ')).join(', ');
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
    this.api
      .rejectAdminVendorProduct(item.id, this.rejectReason.trim())
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.toast.show('Variant rejected.', 'success');
          this.items.update((list) => list.filter((row) => row.id !== item.id));
          this.selectedIds.update((set) => {
            const next = new Set(set);
            next.delete(item.id);
            return next;
          });
          this.closeReject();
        },
        error: () => {
          this.saving.set(false);
          this.toast.show('Failed to reject variant.', 'error');
        },
      });
  }

  isSelected(id: string): boolean {
    return this.selectedIds().has(id);
  }

  toggleSelection(id: string, checked: boolean) {
    this.selectedIds.update((set) => {
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
    this.selectedIds.set(new Set(this.items().map((item) => item.id)));
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
      } catch {
        // Keep processing the rest of the selected variants.
      }
    }
    this.saving.set(false);
    this.toast.show(
      `Approved ${successCount} variants.`,
      successCount ? 'success' : 'error',
    );
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
        await firstValueFrom(
          this.api.rejectAdminVendorProduct(id, this.batchRejectReason.trim()),
        );
        successCount += 1;
      } catch {
        // Keep processing the rest of the selected variants.
      }
    }
    this.saving.set(false);
    this.closeBatchReject();
    this.toast.show(
      `Rejected ${successCount} variants.`,
      successCount ? 'success' : 'error',
    );
    this.load();
  }
}
