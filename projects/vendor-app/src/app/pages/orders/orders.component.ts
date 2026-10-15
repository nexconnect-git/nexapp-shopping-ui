import {
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  AppCurrencyPipe,
  VendorOrderCommand,
  VendorOrderSnapshot,
  VendorWorkspaceApi,
} from '@shared/public-api';
import { timer } from 'rxjs';
import { VendorOrdersStore } from '../../services/vendor-orders.store';
import { vendorListState } from '../../services/vendor-list-state';
import { WorkspacePagerComponent } from '../../components/workspace-pager.component';
import { WorkspaceDialogComponent } from '../../components/workspace-dialog.component';
import { CounterStateComponent } from '../../components/counter-state.component';
@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [
    WorkspaceDialogComponent,
    CounterStateComponent,
    CommonModule,
    FormsModule,
    RouterLink,
    AppCurrencyPipe,
    WorkspacePagerComponent,
  ],
  templateUrl: './orders.component.html',
  styleUrl: './orders.component.scss',
})
export class OrdersComponent implements OnInit {
  readonly filtersOpen = signal(false);
  private readonly api = inject(VendorWorkspaceApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroy = inject(DestroyRef);
  readonly store = inject(VendorOrdersStore);
  readonly list = vendorListState<VendorOrderSnapshot>((query) =>
    this.api.orders(query)
  );
  readonly search = signal('');
  readonly status = signal('');
  readonly from = signal('');
  readonly to = signal('');
  readonly filterError = signal('');
  readonly auto = signal(true);
  readonly updated = signal<Date | null>(null);
  readonly statuses = [
    'placed',
    'confirmed',
    'preparing',
    'ready',
    'picked_up',
    'on_the_way',
    'delivered',
    'cancelled',
  ];
  readonly rows = computed(() =>
    this.list.rows().map((order) => this.store.records().get(order.id) || order)
  );
  ngOnInit(): void {
    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe((params) => {
        this.list.page.set(Math.max(1, Number(params.get('page')) || 1));
        this.search.set(params.get('search') || '');
        this.status.set(params.get('status') || '');
        this.from.set(params.get('from') || '');
        this.to.set(params.get('to') || '');
        this.load();
      });
    timer(30000, 30000)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe(() => {
        if (this.auto() && !document.hidden && !this.list.loading())
          this.load();
      });
  }
  query(page = 1): void {
    if (this.from() && this.to() && this.from() > this.to()) {
      this.filterError.set('Start date must be on or before the end date.');
      return;
    }
    this.filterError.set('');
    this.filtersOpen.set(false);
    void this.router.navigate([], {
      queryParams: {
        page,
        search: this.search() || null,
        status: this.status() || null,
        from: this.from() || null,
        to: this.to() || null,
      },
    });
  }
  load(): void {
    this.list.load({
      search: this.search(),
      status: this.status(),
      from: this.from(),
      to: this.to(),
    });
  }
  command(order: VendorOrderSnapshot, action: VendorOrderCommand): void {
    this.store
      .run(order.id, action)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: () => {
          this.updated.set(new Date());
          this.load();
        },
        error: () => {
          /* Row errors are held by the shared order store. */
        },
      });
  }
}
