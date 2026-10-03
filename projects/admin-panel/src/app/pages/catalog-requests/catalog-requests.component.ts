import { AdminCanDirective } from '../../shared/admin-can.directive';
import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService, CatalogProposal, ToastService } from '@shared/public-api';
import { AdminDialogDirective } from '../../shared/admin-dialog.directive';

@Component({
  selector: 'app-admin-catalog-requests',
  standalone: true,
  imports: [AdminCanDirective, CommonModule, FormsModule, AdminDialogDirective],
  templateUrl: './catalog-requests.component.html',
  styleUrl: './catalog-requests.component.scss',
})
export class CatalogRequestsComponent implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  proposals = signal<CatalogProposal[]>([]);
  loading = signal(false);
  loadError = signal(false);
  total = signal(0);
  statusFilter = 'pending';
  rejection = signal<{ proposalId: string; itemId: string } | null>(null);
  rejectionReason = '';
  submitting = signal(false);

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.loadError.set(false);
    const params: any = { page_size: 100 };
    if (this.statusFilter) params.status = this.statusFilter;
    this.api.getAdminCatalogProposals(params).subscribe({
      next: (r) => {
        const rows = r.results || r;
        this.proposals.set(rows);
        this.total.set(r.count || rows.length);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.loadError.set(true);
      },
    });
  }

  approve(proposalId: string, itemId: string) {
    this.api.approveAdminCatalogProposalItem(proposalId, itemId).subscribe({
      next: () => {
        this.toast.show('Item approved and granted to vendor.', 'success');
        this.load();
      },
      error: () => this.toast.show('Failed to approve item.', 'error'),
    });
  }

  reject(proposalId: string, itemId: string) {
    this.rejectionReason = '';
    this.rejection.set({ proposalId, itemId });
  }

  closeRejection() {
    if (!this.submitting()) this.rejection.set(null);
  }

  submitRejection() {
    const target = this.rejection();
    if (!target || this.submitting() || !this.rejectionReason.trim()) return;
    this.submitting.set(true);
    this.api
      .rejectAdminCatalogProposalItem(target.proposalId, target.itemId, {
        rejection_reason: this.rejectionReason.trim(),
      })
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.rejection.set(null);
          this.toast.show('Item rejected.', 'success');
          this.load();
        },
        error: () => {
          this.submitting.set(false);
          this.toast.show('Failed to reject item.', 'error');
        },
      });
  }
}
