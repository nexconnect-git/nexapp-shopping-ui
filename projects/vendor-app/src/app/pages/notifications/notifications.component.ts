import {
  Component,
  DestroyRef,
  effect,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  apiErrorMessage,
  Notification,
  VendorWorkspaceApi,
} from '@shared/public-api';
import { VendorInboxService } from '../../services/vendor-inbox.service';
import { WorkspacePagerComponent } from '../../components/workspace-pager.component';
@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, WorkspacePagerComponent],
  templateUrl: './notifications.component.html',
  styleUrl: './notifications.component.scss',
})
export class NotificationsComponent implements OnInit {
  readonly inbox = inject(VendorInboxService);
  private readonly api = inject(VendorWorkspaceApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroy = inject(DestroyRef);
  readonly notifications = signal<Notification[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly page = signal(1);
  readonly count = signal(0);
  readonly filter = signal('all');
  readonly unreadOnly = signal(false);
  search = '';
  private generation = 0;
  private initialized = false;
  readonly filters = ['all', 'order', 'delivery', 'payout', 'promo', 'system'];
  constructor() {
    effect(() => {
      this.inbox.revision();
      if (this.initialized) this.load();
    });
  }
  ngOnInit(): void {
    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe((params) => {
        this.page.set(Math.max(1, Number(params.get('page')) || 1));
        this.filter.set(params.get('type') || 'all');
        this.unreadOnly.set(params.get('unread') === 'true');
        this.search = params.get('search') || '';
        this.initialized = true;
        this.load();
      });
  }
  query(page = 1): void {
    void this.router.navigate([], {
      queryParams: {
        page,
        type: this.filter() === 'all' ? null : this.filter(),
        unread: this.unreadOnly() || null,
        search: this.search || null,
      },
    });
  }
  setFilter(value: string): void {
    this.filter.set(value);
    this.query();
  }
  load(): void {
    const generation = ++this.generation;
    this.loading.set(true);
    this.api
      .notifications({
        page: this.page(),
        notification_type: this.filter() === 'all' ? null : this.filter(),
        unread: this.unreadOnly() || null,
        search: this.search,
      })
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (response) => {
          if (generation !== this.generation) return;
          this.notifications.set(response.results);
          this.count.set(response.count);
          this.inbox.unread.set(response.unread_count ?? this.inbox.unread());
          this.loading.set(false);
          this.error.set('');
        },
        error: (error) => {
          if (generation === this.generation) {
            this.loading.set(false);
            this.error.set(
              apiErrorMessage(error, 'Notifications could not be loaded.')
            );
          }
        },
      });
  }
}
