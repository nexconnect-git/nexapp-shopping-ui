import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AlertService,
  apiErrorMessage,
  AppCurrencyPipe,
  DeliveryAssignment,
} from '@shared/public-api';
import { Subscription, timer } from 'rxjs';
import { DeliveryWorkflowFacade } from '../../services/delivery-workflow.facade';

@Component({
  selector: 'app-available-orders',
  standalone: true,
  imports: [CommonModule, AppCurrencyPipe],
  templateUrl: './available-orders.component.html',
  styleUrls: ['./available-orders.component.scss'],
})
export class AvailableOrdersComponent implements OnInit, OnDestroy {
  private workflow = inject(DeliveryWorkflowFacade);
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
    this.workflow.getRequests().subscribe({
      next: (r) => {
        this.requests.set(r.results || r);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.alerts.error(
          apiErrorMessage(err, 'Could not load delivery requests.')
        );
      },
    });
  }

  accept(req: DeliveryAssignment) {
    this.actionId.set(req.id);
    this.workflow.acceptRequest(req.id).subscribe({
      next: () => {
        this.actionId.set(null);
        this.alerts.success(`Accepted order #${req.order_number}.`);
        this.load();
      },
      error: (err) => {
        this.actionId.set(null);
        this.alerts.error(apiErrorMessage(err, 'Could not accept request.'));
      },
    });
  }

  reject(req: DeliveryAssignment) {
    this.actionId.set(req.id);
    this.workflow.rejectRequest(req.id).subscribe({
      next: () => {
        this.actionId.set(null);
        this.alerts.info(`Rejected order #${req.order_number}.`);
        this.load();
      },
      error: (err) => {
        this.actionId.set(null);
        this.alerts.error(apiErrorMessage(err, 'Could not reject request.'));
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
