import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService, CatalogProposal, ToastService } from '@shared/public-api';

@Component({
  selector: 'app-admin-catalog-requests',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './catalog-requests.component.html',
  styleUrl: '../products/products.component.scss',
})
export class CatalogRequestsComponent implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  proposals = signal<CatalogProposal[]>([]);
  loading = signal(false);
  total = signal(0);
  statusFilter = 'pending';

  ngOnInit() {
    this.load();
  }

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
      next: () => {
        this.toast.show('Item approved and granted to vendor.', 'success');
        this.load();
      },
      error: () => this.toast.show('Failed to approve item.', 'error'),
    });
  }

  reject(proposalId: string, itemId: string) {
    const rejection_reason = prompt('Reason for rejection?') || '';
    this.api
      .rejectAdminCatalogProposalItem(proposalId, itemId, { rejection_reason })
      .subscribe({
        next: () => {
          this.toast.show('Item rejected.', 'success');
          this.load();
        },
        error: () => this.toast.show('Failed to reject item.', 'error'),
      });
  }
}
