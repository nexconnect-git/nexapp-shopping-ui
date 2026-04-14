import { Component, inject, signal, OnInit, HostListener, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { AuthService, ApiService, ToastService, ToastComponent, NotificationPollingService } from '@shared/public-api';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { switchMap, filter, debounceTime } from 'rxjs/operators';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { App } from '@capacitor/app';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterModule, ToastComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit {
  auth = inject(AuthService);
  api = inject(ApiService);
  toastService = inject(ToastService);
  router = inject(Router);
  private destroyRef = inject(DestroyRef);
  private notifPolling = inject(NotificationPollingService);

  mobileMenuOpen = signal(false);
  userMenuOpen = signal(false);
  notifMenuOpen = signal(false);
  notifications = signal<any[]>([]);

  userInitials = () => {
    const u = this.auth.user();
    if (!u) return '?';
    return ((u.first_name?.[0] || '') + (u.last_name?.[0] || '')).toUpperCase() || u.username[0].toUpperCase();
  };

  ngOnInit() {
    this.initNative();

    if (this.auth.isLoggedIn()) {
      this.notifPolling.start((n) => {
        if (n.notification_type === 'order' && n.related_entity_id) {
          return { label: 'View', url: `/order/${n.related_entity_id}` };
        }
        if (n.notification_type === 'order' && n.data?.order_id) {
          return { label: 'View', url: `/order/${n.data.order_id}` };
        }
        return null;
      });
      // Initial load
      this.api.refreshCartCount();
      this.checkActiveIssue();
    }

    // On navigation: debounce rapid route changes, cancel previous in-flight requests via switchMap
    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd),
      debounceTime(200),
      filter(() => this.auth.isLoggedIn()),
      switchMap(() => this.api.getCart()),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (cart) => this.api.cartCount.set((cart.items || []).length),
      error: () => {}
    });
  }

  private async initNative() {
    if (!Capacitor.isNativePlatform()) return;

    await StatusBar.setStyle({ style: Style.Light });
    await StatusBar.setBackgroundColor({ color: '#6b33ee' });
    await SplashScreen.hide();

    // Handle Android hardware back button
    App.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) {
        window.history.back();
      } else {
        App.exitApp();
      }
    });
  }

  checkActiveIssue() {
    this.api.getMyIssues().subscribe({
      next: (res) => {
        const issues = res.results || res;
        const open = issues.find((i: any) => ['open', 'in_review'].includes(i.status));
        this.api.activeIssue.set(open || null);
      },
      error: () => {}
    });
  }

  clearNotifBadge() {
    // Mark all read on opening notifications/orders page
    this.api.markAllNotificationsRead().subscribe({ next: () => this.api.unreadNotifications.set(0) });
  }

  toggleUserMenu(event?: Event) {
    event?.stopPropagation();
    this.userMenuOpen.update(v => !v);
    this.notifMenuOpen.set(false);
  }

  toggleNotifMenu(event?: Event) {
    event?.stopPropagation();
    this.notifMenuOpen.update(v => !v);
    this.userMenuOpen.set(false);
    if (this.notifMenuOpen()) {
      this.api.getNotifications().subscribe({
        next: (r: any) => this.notifications.set(r.results || r)
      });
      // automatically clear badge when opening
      this.clearNotifBadge();
    }
  }

  @HostListener('document:click')
  closeDropdowns() { 
    this.userMenuOpen.set(false); 
    this.notifMenuOpen.set(false);
  }

  closeMobile() {
    this.mobileMenuOpen.set(false);
  }

  logout() {
    this.userMenuOpen.set(false);
    this.auth.logout();
    this.api.cartCount.set(0);
    this.api.unreadNotifications.set(0);
  }
}
