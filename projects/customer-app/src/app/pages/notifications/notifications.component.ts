import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BreadcrumbsComponent } from '../../shared/breadcrumbs/breadcrumbs.component';
import { CustomerIconComponent } from '../../shared/customer-icon/customer-icon.component';
import { Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { NotificationApi } from '@shared/lib/api/notification-api.service';
import { NotificationStateService } from '@shared/lib/services/notification-state.service';
import { AuthService as SharedAuthService } from '@shared/lib/services/auth.service';
import { AuthService } from '../../services/auth.service';
import { CustomerLockedStateComponent } from '../../shared/customer-locked-state/customer-locked-state.component';
import { CustomerPageHeaderComponent } from '../../shared/customer-page-header/customer-page-header.component';
import { CustomerStateComponent } from '../../shared/customer-state/customer-state.component';
type NotificationItem = {
  id: string;
  title: string;
  message: string;
  type: string;
  timestamp: string;
  read: boolean;
  orderId: string;
};
@Component({
  standalone: true,
  imports: [
    CustomerLockedStateComponent,
    BreadcrumbsComponent,
    CustomerIconComponent,
    CustomerPageHeaderComponent,
    CustomerStateComponent,
  ],
  templateUrl: './notifications.component.html',
  styleUrls: ['./notifications.component.scss'],
})
export class NotificationsComponent {
  loading = signal(false);
  error = signal('');
  writeError=signal('');
  total=signal(0);
  readonly allRead=computed(()=>this.notifications().length>0 && this.notificationState.unreadNotifications()===0);
  readonly pageEnd=computed(()=>Math.min(this.page()*20,this.total()));
  readonly pageStart=computed(()=>this.total()?(this.page()-1)*20+1:0);
  private readonly destroyRef=inject(DestroyRef);
  notifications = signal<NotificationItem[]>([]);
  pending = signal('');
  page = signal(1);
  hasMore = signal(false);
  tab = signal('All');
  readonly tabs = ['All', 'Unread', 'Orders', 'Offers'];
  visible = computed(() =>
    this.notifications().filter(
      (item) =>
        this.tab() === 'All' ||
        (this.tab() === 'Unread' && !item.read) ||
        (this.tab() === 'Orders' &&
          ['order', 'delivery'].includes(item.type)) ||
        (this.tab() === 'Offers' && item.type === 'promo')
    )
  );
  private request = 0;
  constructor(
    private sharedAuth: SharedAuthService,
    public auth: AuthService,
    private api: NotificationApi,
    private notificationState: NotificationStateService,
    private router: Router
  ) {
    effect(() => {
      this.sharedAuth.user();
      untracked(()=>{
        this.request++;
        this.pending.set('');this.notifications.set([]);this.error.set('');this.writeError.set('');this.loading.set(false);this.total.set(0);this.page.set(1);this.hasMore.set(false);
        if(this.auth.isLoggedIn())this.loadNotifications();
      });
    });
  }

  loadNotifications(page = 1): void {
    const request = ++this.request;
    this.loading.set(true);
    this.error.set('');
    if(!this.auth.isLoggedIn())return;
    const session=this.sharedAuth.sessionVersion;
    this.api.getNotifications({ page }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (response) => {
        if (request !== this.request || session!==this.sharedAuth.sessionVersion) return;
        const entries = (
          Array.isArray(response) ? response : response.results || []
        ).map((item: any) => this.map(item));
        this.notifications.set(entries);
        this.total.set(Number(response.count ?? entries.length));
        this.page.set(page);
        this.hasMore.set(!!response.next);
        this.loading.set(false);
      },
      error: () => {
        if (request !== this.request || session!==this.sharedAuth.sessionVersion) return;
        this.loading.set(false);
        this.error.set(
          'This is a read error, not an empty notification feed. Retry with your current session.'
        );
      },
    });
  }
  markAllRead(): void {
    if (this.pending()) return;
    const session = this.sharedAuth.sessionVersion;
    this.pending.set('all');
    this.writeError.set('');
    this.api.markAllNotificationsRead().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        if (session !== this.sharedAuth.sessionVersion) return;
        this.pending.set('');
        this.notifications.update((items) =>
          items.map((item) => ({ ...item, read: true }))
        );
        this.refreshUnreadCount();
      },
      error: () => {
        if (session !== this.sharedAuth.sessionVersion) return;
        this.pending.set('');
        this.writeError.set(
          'Messages could not be marked as read. Their status is unchanged.'
        );
      },
    });
  }
  open(item: NotificationItem): void {
    if (this.pending()) return;
    if (item.read) {
      this.navigate(item);
      return;
    }
    const session = this.sharedAuth.sessionVersion;
    this.pending.set(item.id);
    this.writeError.set('');
    this.api.markNotificationRead(item.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        if (session !== this.sharedAuth.sessionVersion) return;
        this.pending.set('');
        this.notifications.update((items) =>
          items.map((entry) =>
            entry.id === item.id ? { ...entry, read: true } : entry
          )
        );
        this.refreshUnreadCount();
        this.navigate(item);
      },
      error: () => {
        if (session !== this.sharedAuth.sessionVersion) return;
        this.pending.set('');
        this.writeError.set(
          'This message could not be marked as read. Please retry.'
        );
      },
    });
  }
  explore():void {this.router.navigate(['/']);}
  private navigate(item: NotificationItem): void {
    if (item.orderId) this.router.navigate(['/tracking', item.orderId]);
    else if (item.type === 'promo')
      this.router.navigate(['/explore'], { queryParams: { offers: true } });
  }
  private refreshUnreadCount(): void {
    const session = this.sharedAuth.sessionVersion;
    this.api.getUnreadCount().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (response) => {
        if (session === this.sharedAuth.sessionVersion)
          this.notificationState.unreadNotifications.set(
            response.unread_count ?? response.count ?? 0
          );
      },
      error: () => undefined,
    });
  }
  private map(item: any): NotificationItem {
    return {
      id: String(item.id),
      title: String(item.title || 'Notification'),
      message: String(item.message || ''),
      type: String(item.notification_type || 'system'),
      timestamp: item.created_at
        ? new Date(item.created_at).toLocaleString()
        : '',
      read: !!item.is_read,
      orderId: String(
        item.data?.order_id ||
          item.related_order ||
          item.order ||
          item.order_id ||
          ''
      ),
    };
  }
}
