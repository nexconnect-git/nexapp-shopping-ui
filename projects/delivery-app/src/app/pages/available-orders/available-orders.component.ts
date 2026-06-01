import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AlertService,
  ApiService,
  AppCurrencyPipe,
  DeliveryAssignment,
} from '@shared/public-api';
import { Subscription, timer } from 'rxjs';

@Component({
  selector: 'app-available-orders',
  standalone: true,
  imports: [CommonModule, AppCurrencyPipe],
  templateUrl: './available-orders.component.html',
  styleUrls: ['./available-orders.component.scss'],
})
export class AvailableOrdersComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private alerts = inject(AlertService);

  requests = signal<DeliveryAssignment[]>([]);
  loading = signal(true);
  actionId = signal<string | null>(null);
  private sub?: Subscription;

  ngOnInit() {
    this.sub = timer(0, 10000).subscribe(() => {
      if (document.hidden) return;
      this.load();
    });
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }

  load() {
    this.loading.set(true);
    this.api.getDeliveryRequests().subscribe({
      next: (r) => {
        this.requests.set(r.results || r);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        const message = err?.error?.error || 'Could not load delivery requests.';
        this.alerts.error(message);
      },
    });
  }

  accept(req: DeliveryAssignment) {
    this.actionId.set(req.id);
    this.api.acceptDeliveryRequest(req.id).subscribe({
      next: () => {
        this.actionId.set(null);
        this.alerts.success(`Accepted order #${req.order_number}.`);
        this.load();
      },
      error: (err) => {
        this.actionId.set(null);
        const message = err?.error?.error || 'Could not accept request.';
        this.alerts.error(message);
      },
    });
  }

  reject(req: DeliveryAssignment) {
    this.actionId.set(req.id);
    this.api.rejectDeliveryRequest(req.id).subscribe({
      next: () => {
        this.actionId.set(null);
        this.alerts.info(`Rejected order #${req.order_number}.`);
        this.load();
      },
      error: (err) => {
        this.actionId.set(null);
        const message = err?.error?.error || 'Could not reject request.';
        this.alerts.error(message);
      },
    });
  }

  openVendorMap(req: DeliveryAssignment) {
    const lat = req.vendor_lat;
    const lng = req.vendor_lng;
    if (lat && lng) {
      window.open(
        `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
        '_blank',
      );
    }
  }
}
