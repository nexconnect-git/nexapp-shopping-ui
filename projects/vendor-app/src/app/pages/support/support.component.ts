import { CounterStateComponent } from '../../components/counter-state.component';
import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  apiErrorMessage,
  VendorTicket,
  VendorWorkspaceApi,
} from '@shared/public-api';
import { vendorListState } from '../../services/vendor-list-state';
import { WorkspacePagerComponent } from '../../components/workspace-pager.component';
import { WorkspaceDialogComponent } from '../../components/workspace-dialog.component';
@Component({
  selector: 'app-support',
  standalone: true,
  imports: [CounterStateComponent,
    CommonModule,
    FormsModule,
    WorkspacePagerComponent,
    WorkspaceDialogComponent,
  ],
  templateUrl: './support.component.html',
  styleUrl: './support.component.scss',
})
export class SupportComponent implements OnInit {
  private readonly api = inject(VendorWorkspaceApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroy = inject(DestroyRef);
  readonly list = vendorListState<VendorTicket>((query) =>
    this.api.tickets(query)
  );
  readonly detail = signal<VendorTicket | null>(null);
  readonly detailId = signal('');
  readonly detailLoading = signal(false);
  readonly detailError = signal('');
  readonly dialogReturnFocus = signal<HTMLElement | null>(null);
  readonly creating = signal(false);
  readonly createOpen = signal(false);
  readonly formError = signal('');
  readonly created = signal('');
  search = '';
  status = '';
  category = '';
  private detailGeneration = 0;
  private lastListQuery = '';
  form = { subject: '', category: 'other', message: '', priority: 'medium' };
  readonly categories = [
    { key: 'other', label: 'General support' },
    { key: 'billing', label: 'Billing & payouts' },
    { key: 'technical', label: 'Technical issue' },
    { key: 'order', label: 'Order dispute' },
    { key: 'account', label: 'Account help' },
  ];
  ngOnInit(): void {
    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe((params) => {
        this.list.page.set(Math.max(1, Number(params.get('page')) || 1));
        this.search = params.get('search') || '';
        this.status = params.get('status') || '';
        this.category = params.get('category') || '';
        const listQuery = JSON.stringify([this.list.page(), this.search, this.status, this.category]);
        if (listQuery !== this.lastListQuery) {
          this.lastListQuery = listQuery;
          this.list.load({ search: this.search, status: this.status, category: this.category });
        }
        const ticket = params.get('ticket') || '';
        this.detailId.set(ticket);
        if (ticket) this.loadDetail(ticket);
        else {
          this.detailGeneration++;
          this.detail.set(null);
          this.detailError.set('');
        }
      });
  }
  query(page = 1): void {
    void this.router.navigate([], {
      queryParams: {
        page,
        search: this.search || null,
        status: this.status || null,
        category: this.category || null,
        ticket: null,
      },
    });
  }
  openCreate(event: Event): void {
    this.dialogReturnFocus.set(event.currentTarget as HTMLElement);
    this.createOpen.set(true);
  }
  open(ticket: VendorTicket, event: Event): void {
    this.dialogReturnFocus.set(event.currentTarget as HTMLElement);
    void this.router.navigate([], {
      queryParams: { ticket: ticket.id },
      queryParamsHandling: 'merge',
    });
  }
  close(): void {
    void this.router.navigate([], {
      queryParams: { ticket: null },
      queryParamsHandling: 'merge',
    });
  }
  loadDetail(id = this.detailId()): void {
    const generation = ++this.detailGeneration;
    this.detail.set(null);
    this.detailError.set('');
    this.detailLoading.set(true);
    this.api
      .ticket(id)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (ticket) => {
          if (generation !== this.detailGeneration) return;
          this.detail.set(ticket);
          this.detailLoading.set(false);
        },
        error: (error) => {
          if (generation === this.detailGeneration) {
            this.detailError.set(
              apiErrorMessage(error, 'Ticket detail could not be loaded.')
            );
            this.detailLoading.set(false);
          }
        },
      });
  }
  submit(): void {
    if (this.creating()) return;
    this.formError.set('');
    if (!this.form.subject.trim() || !this.form.message.trim()) {
      this.formError.set('Enter a subject and a message.');
      return;
    }
    this.creating.set(true);
    this.api
      .createTicket({
        ...this.form,
        subject: this.form.subject.trim(),
        message: this.form.message.trim(),
      })
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (ticket) => {
          this.lastListQuery = '';
          this.creating.set(false);
          this.createOpen.set(false);
          this.form = {
            subject: '',
            category: 'other',
            message: '',
            priority: 'medium',
          };
          this.created.set(
            'Support ticket created. Its status and admin response are available in ticket details.'
          );
          void this.router.navigate([], {
            queryParams: { ticket: ticket.id, page: 1 },
            queryParamsHandling: 'merge',
          });
        },
        error: (error) => {
          this.formError.set(
            apiErrorMessage(
              error,
              'Support ticket was not created. Your message remains for retry.'
            )
          );
          this.creating.set(false);
        },
      });
  }
}
