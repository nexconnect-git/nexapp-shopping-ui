import { Component, computed, HostListener, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  AppCurrencyPipe,
  VendorOrderCommand,
  VendorOrderSnapshot,
} from '@shared/public-api';
import { VendorOrdersStore } from '../../services/vendor-orders.store';
import { WorkspaceDialogComponent } from '../../components/workspace-dialog.component';

@Component({
  selector: 'app-live-orders',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    FormsModule,
    AppCurrencyPipe,
    WorkspaceDialogComponent,
  ],
  templateUrl: './live-orders.component.html',
  styleUrl: './live-orders.component.scss',
})
export class LiveOrdersComponent {
  readonly store = inject(VendorOrdersStore);
  readonly lane = signal('all');
  readonly compact = signal(window.matchMedia('(max-width: 1200px)').matches);
  readonly selectedLane = computed(() => this.compact() && this.lane() === 'all' ? 'placed' : this.lane());
  readonly rejectTarget = signal<VendorOrderSnapshot | null>(null);
  reason = '';
  readonly lanes = [
    { key: 'placed', label: 'New' },
    { key: 'preparing', label: 'Preparing' },
    { key: 'ready', label: 'Ready for pickup' },
    { key: 'dispatched', label: 'On the way' },
  ];
  readonly orders = computed(() =>
    this.store
      .active()
      .map((id) => this.store.records().get(id))
      .filter(
        (order): order is VendorOrderSnapshot =>
          !!order && !['delivered', 'cancelled'].includes(order.status)
      )
  );
  readonly visible = computed(() =>
    this.orders().filter(
      (order) => this.selectedLane() === 'all' || this.laneKey(order) === this.selectedLane()
    )
  );
  readonly columns = computed(() =>
    this.lanes
      .map((lane) => ({
        ...lane,
        orders: this.visible().filter(
          (order) => this.laneKey(order) === lane.key
        ),
      }))
      .filter((lane) => this.selectedLane() === 'all' || lane.key === this.selectedLane())
  );
  readonly actions: { key: VendorOrderCommand; label: string }[] = [
    { key: 'accept', label: 'Accept' },
    { key: 'reject', label: 'Reject' },
    { key: 'start_preparing', label: 'Start preparation' },
    { key: 'mark_ready', label: 'Mark ready' },
    { key: 'start_delivery_search', label: 'Find driver' },
    { key: 'cancel_delivery_search', label: 'Cancel search' },
  ];
  @HostListener('window:resize')
  resize(): void { this.compact.set(window.matchMedia('(max-width: 1200px)').matches); }
  stateLabel(order: VendorOrderSnapshot): string {
    if (order.status === 'confirmed') return 'Accepted · not started';
    if (order.status === 'ready') return order.delivery_partner ? 'Driver assigned · awaiting pickup' : order.assignment_status === 'searching' || order.assignment_status === 'notified' ? 'Finding a driver' : 'Ready · needs a driver';
    return ({placed:'Awaiting acceptance',preparing:'Preparing',picked_up:'Picked up',on_the_way:'On the way'} as Record<string,string>)[order.status] || order.status;
  }
  count(key: string): number {
    return this.orders().filter((order) => this.laneKey(order) === key).length;
  }
  minutes(order: VendorOrderSnapshot): number {
    return Math.max(
      0,
      Math.floor((this.store.clock() - Date.parse(order.placed_at)) / 60000)
    );
  }
  command(order: VendorOrderSnapshot, action: VendorOrderCommand): void {
    if (action === 'reject') {
      this.reason = '';
      this.rejectTarget.set(order);
      return;
    }
    this.store.run(order.id, action).subscribe({ error: () => {} });
  }
  reject(): void {
    const order = this.rejectTarget();
    if (!order || !this.reason.trim()) return;
    this.store
      .run(order.id, 'reject', { reason: this.reason.trim() })
      .subscribe({ next: () => this.rejectTarget.set(null), error: () => {} });
  }
  private laneKey(order: VendorOrderSnapshot): string {
    return ['picked_up', 'on_the_way'].includes(order.status)
      ? 'dispatched'
      : order.status === 'confirmed' ? 'preparing' : order.status;
  }
}
