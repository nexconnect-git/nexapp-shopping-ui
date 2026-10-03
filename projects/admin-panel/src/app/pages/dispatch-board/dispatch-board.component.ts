import {
  Component,
  DestroyRef,
  inject,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DialogModule } from 'primeng/dialog';
import { TableModule } from 'primeng/table';
import { Subscription } from 'rxjs';
import {
  ApiService,
  DispatchOrder,
  DispatchPartner,
  ToastService,
} from '@shared/public-api';
import { AdminAccessService } from '../../services/admin-access.service';
@Component({
  selector: 'app-dispatch-board',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, DialogModule, TableModule],
  templateUrl: './dispatch-board.component.html',
  styleUrl: './dispatch-board.component.scss',
})
export class DispatchBoardComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private destroy = inject(DestroyRef);
  access = inject(AdminAccessService);
  loading = signal(false);
  orders = signal<DispatchOrder[]>([]);
  partners = signal<DispatchPartner[]>([]);
  error = signal('');
  total = signal(0);
  updated = signal<string | null>(null);
  sla = signal(20);
  saving = signal(false);
  page = 0;
  state = '';
  autoReload = true;
  selected: DispatchOrder | null = null;
  command = 'assign';
  partnerId = '';
  reason = '';
  notes = '';
  priority = 'normal';
  dialogOpen = false;
  orderFilter = '';
  private timer?: ReturnType<typeof setTimeout>;
  private failures = 0;
  private loadRequest?: Subscription;
  ngOnInit() {
    this.load();
  }
  ngOnDestroy() {
    clearTimeout(this.timer);
    this.loadRequest?.unsubscribe();
  }
  load() {
    clearTimeout(this.timer);
    this.loadRequest?.unsubscribe();
    this.loading.set(true);
    this.error.set('');
    this.loadRequest = this.api
      .getAdminDispatch({
        page: this.page + 1,
        state: this.state,
        ...(this.orderFilter ? { order: this.orderFilter } : {}),
      })
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (response) => {
          this.orders.set(response.results);
          this.partners.set(response.partners);
          this.total.set(response.count);
          this.updated.set(response.generated_at);
          this.sla.set(response.pickup_sla_minutes);
          this.loading.set(false);
          this.failures = 0;
          this.schedule();
        },
        error: () => {
          this.error.set(
            'Dispatch data could not be loaded. Retry to refresh authoritative availability.'
          );
          this.loading.set(false);
          this.failures++;
          this.schedule();
        },
      });
  }
  private schedule() {
    this.timer = setTimeout(() => {
      if (this.autoReload && !document.hidden && !this.dialogOpen) this.load();
      else this.schedule();
    }, Math.min(120000, 15000 * 2 ** this.failures));
  }
  filter() {
    this.page = 0;
    this.load();
  }
  open(order: DispatchOrder, command: string) {
    this.selected = order;
    this.command = command;
    this.partnerId = '';
    this.reason = '';
    this.priority = order.priority;
    this.notes = order.notes;
    this.dialogOpen = true;
    if (command === 'assign')
      this.api
        .getAdminDispatch({ order: order.id })
        .pipe(takeUntilDestroyed(this.destroy))
        .subscribe({
          next: (response) => this.partners.set(response.partners),
          error: () =>
            this.toast.show(
              'Could not refresh partner availability. Retry before assigning.',
              'error'
            ),
        });
  }
  submit() {
    if (!this.selected || this.saving() || this.reason.trim().length < 3)
      return;
    this.saving.set(true);
    this.api
      .updateAdminDispatch(this.selected.id, {
        command: this.command,
        reason: this.reason,
        ...(this.command === 'assign' ? { partner_id: this.partnerId } : {}),
        ...(this.command === 'update'
          ? { priority: this.priority, notes: this.notes }
          : {}),
      })
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.dialogOpen = false;
          this.toast.show('Dispatch change recorded.', 'success');
          this.load();
        },
        error: (error) => {
          this.saving.set(false);
          this.toast.show(
            error.error?.detail ||
              error.error?.error ||
              'Dispatch change was rejected. Refresh availability and try again.',
            'error'
          );
        },
      });
  }
  title() {
    return (
      {
        assign: 'Assign delivery partner',
        unassign: 'Unassign delivery partner',
        escalate: 'Escalate order',
        clear_escalation: 'Clear escalation',
        update: 'Update dispatch details',
      } as Record<string, string>
    )[this.command];
  }
}
