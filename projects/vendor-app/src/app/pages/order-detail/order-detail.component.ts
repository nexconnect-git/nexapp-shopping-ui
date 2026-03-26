import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { ApiService, Order } from '@shared/public-api';

@Component({
  selector: 'app-order-detail',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './order-detail.component.html',
  styleUrl: './order-detail.component.scss'
})
export class OrderDetailComponent implements OnInit {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);

  order = signal<Order | null>(null);
  loading = signal(true);

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.api.getOrder(id).subscribe({
      next: (o) => { this.order.set(o); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  canUpdateStatus() {
    return ['placed', 'confirmed', 'preparing'].includes(this.order()?.status || '') && this.order()?.status !== 'cancelled';
  }

  updateStatus(status: string) {
    this.api.updateOrderStatus(this.order()!.id, status).subscribe({
      next: (o) => this.order.set(o)
    });
  }

  downloadInvoice() {
    const o = this.order();
    if (!o) return;
    
    const payload = {
      invoice_type: 'customer_receipt',
      order: o.id,
      amount: o.total,
      notes: `Receipt for Order #${o.order_number}`
    };
    
    this.api.generateInvoice(payload).subscribe({
      next: (inv) => {
        const url = this.api.downloadInvoiceUrl(inv.id);
        window.open(url, '_blank');
      },
      error: () => alert('Failed to generate invoice.')
    });
  }
}
