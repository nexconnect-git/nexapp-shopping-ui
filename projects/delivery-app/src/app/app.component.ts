import {
  Component,
  DestroyRef,
  effect,
  HostListener,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Location } from '@angular/common';
import {
  NavigationEnd,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import {
  AlertHostComponent,
  AlertService,
  ApiService,
  AuthService,
  GlobalLoadingComponent,
  NativePlatformService,
  Notification,
  NotificationPollingService,
  PageFeatureAccessService,
  PageFeatureLoadingComponent,
  ToastComponent,
} from '@shared/public-api';
import { filter } from 'rxjs';

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    CommonModule,
    AlertHostComponent,
    ToastComponent,
    GlobalLoadingComponent,
    PageFeatureLoadingComponent,
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit {
  auth = inject(AuthService);
  api = inject(ApiService);
  private alerts = inject(AlertService);
  private router = inject(Router);
  private location = inject(Location);
  private notifPolling = inject(NotificationPollingService);
  private featureAccess = inject(PageFeatureAccessService);
  private nativePlatform = inject(NativePlatformService);
  private destroyRef = inject(DestroyRef);
  private splashHidden = false;

  profileOpen = signal(false);
  notifOpen = signal(false);
  notifications = signal<Notification[]>([]);
  notifLoading = signal(false);
  unreadCount = signal(0);
  currentUrl = signal('/');
  private readonly authPollingEffect = effect(
    () => {
      const loggedIn = this.auth.isLoggedIn();
      if (!loggedIn) {
        this.notifPolling.stop();
        this.unreadCount.set(0);
        this.notifications.set([]);
        return;
      }
      this.notifPolling.start();
    },
    { allowSignalWrites: true }
  );

  ngOnInit() {
    this.currentUrl.set(this.router.url || '/');
    this.router.events
      .pipe(
        filter(
          (event): event is NavigationEnd => event instanceof NavigationEnd
        )
      )
      .subscribe((event) =>
        this.currentUrl.set(event.urlAfterRedirects || event.url || '/')
      );
    this.featureAccess.loadConfig(!this.featureAccess.hasResolved()).subscribe({
      complete: () => this.hideInitialSplash(),
    });
    this.featureAccess.startPolling('delivery-app');
    window.setTimeout(() => this.hideInitialSplash(), 8000);

    this.notifPolling.onUnreadChange((count) => this.unreadCount.set(count));
    this.destroyRef.onDestroy(() => this.notifPolling.stop());
  }

  private hideInitialSplash(): void {
    if (this.splashHidden) return;
    this.splashHidden = true;
    window.setTimeout(() => void this.nativePlatform.hideSplashScreen(), 700);
  }

  toggleProfile(event?: Event) {
    event?.stopPropagation();
    this.profileOpen.update((v) => !v);
    this.notifOpen.set(false);
  }

  toggleNotif(event: Event) {
    event.stopPropagation();
    const opening = !this.notifOpen();
    this.notifOpen.set(opening);
    this.profileOpen.set(false);
    if (opening && this.notifications().length === 0) this.fetchNotifications();
  }

  fetchNotifications() {
    this.notifLoading.set(true);
    this.api.getNotifications().subscribe({
      next: (r) => {
        this.notifications.set(
          ((r.results || r) as Notification[]).slice(0, 8)
        );
        this.notifLoading.set(false);
      },
      error: () => {
        this.notifLoading.set(false);
        this.alerts.error('Could not load notifications. Please retry.');
      },
    });
  }

  markAllRead() {
    this.api.markAllNotificationsRead().subscribe({
      next: () => {
        this.unreadCount.set(0);
        this.notifications.update((list) =>
          list.map((n) => ({ ...n, is_read: true }))
        );
        this.alerts.success('All notifications marked as read.');
      },
      error: () => this.alerts.error('Failed to mark notifications as read.'),
    });
  }

  @HostListener('document:click', ['$event'])
  closeDropdowns(event: MouseEvent) {
    const target = event.target as HTMLElement | null;
    if (
      target?.closest('.notif-wrapper') ||
      target?.closest('.profile-menu-wrapper')
    ) {
      return;
    }
    this.profileOpen.set(false);
    this.notifOpen.set(false);
  }

  @HostListener('document:keydown.escape')
  closeOnEscape() {
    this.profileOpen.set(false);
    this.notifOpen.set(false);
  }

  closeProfile() {
    this.profileOpen.set(false);
  }

  private routeForNotification(n: Notification): string {
    const targetRoute = n.data?.target_route;
    if (targetRoute && typeof targetRoute === 'string') return targetRoute;

    if (n.notification_type === 'delivery') {
      return n.data?.type === 'assignment_request' ? '/available' : '/active';
    }
    if (n.notification_type === 'order') return '/active';
    if (n.notification_type === 'payout') return '/earnings';
    return '/';
  }

  handleNotificationClick(n: Notification) {
    if (!n.is_read) {
      this.api.markNotificationRead(n.id).subscribe({
        next: () => {
          this.unreadCount.update((c) => Math.max(0, c - 1));
          this.notifications.update((list) =>
            list.map((item) =>
              item.id === n.id ? { ...item, is_read: true } : item
            )
          );
        },
      });
    }

    this.notifOpen.set(false);
    this.router.navigateByUrl(this.routeForNotification(n));
  }

  isAuthRoute(): boolean {
    const url = this.router.url;
    return (
      url.includes('/login') ||
      url.includes('/change-password') ||
      url.includes('/pending-approval')
    );
  }

  canUseRoute(route: string): boolean {
    return this.featureAccess.isRouteEnabled('delivery-app', route);
  }

  showBackButton(): boolean {
    const path = this.currentUrl().split('?')[0].split('#')[0];
    return !this.isAuthRoute() && path !== '/' && path !== '';
  }

  goBack(): void {
    if (!this.showBackButton()) return;
    if (typeof window !== 'undefined' && window.history.length > 1) {
      this.location.back();
      return;
    }
    this.router.navigate(['/']);
  }
}
