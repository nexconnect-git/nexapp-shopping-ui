import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService, DeliveryAssignment } from '@shared/public-api';
import { timer, Subscription } from 'rxjs';

@Component({
  selector: 'app-available-orders',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './available-orders.component.html',
  styleUrls: ['./available-orders.component.scss']
})
export class AvailableOrdersComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);

  requests = signal<DeliveryAssignment[]>([]);
  loading = signal(true);
  actionId = signal<string | null>(null);
  private sub?: Subscription;

  ngOnInit() {
    this.sub = timer(0, 10000).subscribe(() => this.load());
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }

  load() {
    this.loading.set(true);
    this.api.getDeliveryRequests().subscribe({
      next: (r) => { this.requests.set(r.results || r); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  accept(req: DeliveryAssignment) {
    this.actionId.set(req.id);
    this.api.acceptDeliveryRequest(req.id).subscribe({
      next: () => { this.actionId.set(null); this.load(); },
      error: () => this.actionId.set(null)
    });
  }

  reject(req: DeliveryAssignment) {
    this.actionId.set(req.id);
    this.api.rejectDeliveryRequest(req.id).subscribe({
      next: () => { this.actionId.set(null); this.load(); },
      error: () => this.actionId.set(null)
    });
  }

  openVendorMap(req: DeliveryAssignment) {
    const lat = req.vendor_lat;
    const lng = req.vendor_lng;
    if (lat && lng) {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
    }
  }
}
