import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService, CatalogProposal, ToastService } from '@shared/public-api';

@Component({
  selector: 'app-admin-catalog-requests',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="catalog-requests-page">
      <div class="page-header">
        <div>
          <h1 class="page-title">Catalog Requests</h1>
          <p class="page-subtitle">{{ total() }} vendor catalog submissions</p>
        </div>
      </div>
      <div class="toolbar">
        <select class="filter-select" [(ngModel)]="statusFilter" (change)="load()">
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="partially_approved">Partially Approved</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>
      @if (loading()) {
        <div class="loading-state"><div class="spinner"></div><span>Loading requests...</span></div>
      } @else if (proposals().length === 0) {
        <div class="empty-state"><span class="material-icons-outlined">playlist_add_check</span><p>No requests found</p></div>
      } @else {
        @for (proposal of proposals(); track proposal.id) {
          <div class="vendor-group">
            <div class="vendor-header">
              <div class="vendor-meta"><div class="vendor-avatar">{{ proposal.vendor_name[0] }}</div><div><span class="vendor-name">{{ proposal.vendor_name }}</span><span class="vendor-city">{{ proposal.submitted_at | date:'medium' }}</span></div></div>
              <span class="status-chip">{{ proposal.status.replace('_', ' ') }}</span>
            </div>
            <div class="product-table">
              @for (item of proposal.items; track item.id) {
                <div class="table-row">
                  <div class="col-product product-cell"><div class="product-avatar">{{ item.name[0] }}</div><span class="product-name">{{ item.name }}</span></div>
                  <div class="col-category"><span class="text-muted">{{ item.category?.name || 'No category' }}</span></div>
                  <div class="col-status"><span class="status-chip">{{ item.status }}</span></div>
                  <div class="col-actions actions">
                    @if (item.status === 'pending') {
                      <button class="action-btn approve" (click)="approve(proposal.id, item.id)" title="Approve"><span class="material-icons-outlined">check</span></button>
                      <button class="action-btn danger" (click)="reject(proposal.id, item.id)" title="Reject"><span class="material-icons-outlined">close</span></button>
                    }
                  </div>
                </div>
              }
            </div>
          </div>
        }
      }
    </div>
  `,
  styleUrl: '../products/products.component.scss'
})
export class CatalogRequestsComponent implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  proposals = signal<CatalogProposal[]>([]);
  loading = signal(false);
  total = signal(0);
  statusFilter = 'pending';

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    const params: any = { page_size: 100 };
    if (this.statusFilter) params.status = this.statusFilter;
    this.api.getAdminCatalogProposals(params).subscribe({
      next: (r) => {
        const rows = r.results || r;
        this.proposals.set(rows);
        this.total.set(r.count || rows.length);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  approve(proposalId: string, itemId: string) {
    this.api.approveAdminCatalogProposalItem(proposalId, itemId).subscribe({
      next: () => { this.toast.show('Item approved and granted to vendor.', 'success'); this.load(); },
      error: () => this.toast.show('Failed to approve item.', 'error'),
    });
  }

  reject(proposalId: string, itemId: string) {
    const rejection_reason = prompt('Reason for rejection?') || '';
    this.api.rejectAdminCatalogProposalItem(proposalId, itemId, { rejection_reason }).subscribe({
      next: () => { this.toast.show('Item rejected.', 'success'); this.load(); },
      error: () => this.toast.show('Failed to reject item.', 'error'),
    });
  }
}
