import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { ApiService, Order, OrderTracking } from '@shared/public-api';
import { timer, Subscription } from 'rxjs';

@Component({
  selector: 'app-order-detail',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './order-detail.component.html',
  styleUrl: './order-detail.component.scss'
})
export class OrderDetailComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);

  order = signal<Order | null>(null);
  tracking = signal<OrderTracking[]>([]);
  loading = signal(true);
  cancelling = signal(false);
  private sub?: Subscription;

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.sub = timer(0, 5000).subscribe(() => {
      this.api.getOrder(id).subscribe({
        next: (o) => {
          this.order.set(o);
          this.tracking.set(o.tracking || []);
          this.loading.set(false);
          // refresh tracking
          this.api.getOrderTracking(id).subscribe({ next: (t) => this.tracking.set(t.results || t) });
        },
        error: () => this.loading.set(false)
      });
    });
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }

  readonly orderSteps = ['placed', 'confirmed', 'preparing', 'picked_up', 'on_the_way', 'delivered'];

  isStepCompleted(step: string): boolean {
    const status = this.order()?.status;
    if (!status) return false;
    const currentIdx = this.orderSteps.indexOf(status);
    const stepIdx = this.orderSteps.indexOf(step);
    return stepIdx < currentIdx;
  }

  isStepPending(step: string): boolean {
    const status = this.order()?.status;
    if (!status) return true;
    const currentIdx = this.orderSteps.indexOf(status);
    const stepIdx = this.orderSteps.indexOf(step);
    return stepIdx > currentIdx;
  }

  isLastStep(step: string): boolean {
    return step === 'delivered';
  }

  canCancel() { return this.order()?.status === 'placed'; }

  cancelOrder() {
    this.cancelling.set(true);
    this.api.cancelOrder(this.order()!.id).subscribe({
      next: (o) => { this.order.set(o); this.cancelling.set(false); },
      error: () => this.cancelling.set(false)
    });
  }
}
