import { Component, inject, signal, OnInit, HostListener, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { AuthService, ApiService, LocationService, ToastService, ToastComponent, NotificationPollingService } from '@shared/public-api';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { switchMap, filter, debounceTime } from 'rxjs/operators';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { App } from '@capacitor/app';
import { ThemeService } from './core/services/theme.service';
import { environment } from '../environments/environment';

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
  locationService = inject(LocationService);
  toastService = inject(ToastService);
  router = inject(Router);
  private destroyRef = inject(DestroyRef);
  private notifPolling = inject(NotificationPollingService);
  readonly theme = inject(ThemeService);

  showSplash = signal(true);
  /** Routes that have their own sticky topbar — hide the mobile header */
  hideMobHeader = signal(false);
  hideMobTabs = signal(false);

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
    this.loadGoogleMaps();
    this.initNative();

    // Start fetching location eagerly on boot
    this.locationService.initializeLocation();

    // Fade out splash screen slightly after location loads, or timeout at 2s max for fallback
    Promise.all([
      new Promise(res => setTimeout(res, 800)), // Artificial minimum paint time for elegance
      new Promise(res => {
        // Wait until location is no longer loading, OR timeout after 2 seconds
        let checks = 0;
        const intv = setInterval(() => {
          checks++;
          if (!this.locationService.loading() || checks > 10) {
            clearInterval(intv);
            res(true);
          }
        }, 200);
      })
    ]).then(() => this.showSplash.set(false));

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

    // Track current route — certain pages have their own sticky topbar
    const FULL_SCREEN_ROUTES = ['/search', '/shop/', '/product/', '/order/', '/cart', '/checkout'];
    const TAB_HIDDEN_ROUTES = ['/product/', '/order/', '/checkout'];
    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((e: any) => {
      const url = e.urlAfterRedirects || '';
      this.hideMobHeader.set(FULL_SCREEN_ROUTES.some(r => url.startsWith(r)));
      this.hideMobTabs.set(TAB_HIDDEN_ROUTES.some(r => url.startsWith(r)));
    });

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

  private loadGoogleMaps() {
    if (document.querySelector('script[data-gmaps]')) return;
    const s = document.createElement('script');
    s.src = `https://maps.googleapis.com/maps/api/js?key=${environment.googleMapsApiKey}`;
    s.setAttribute('data-gmaps', '');
    s.async = true;
    document.head.appendChild(s);
  }

  private async initNative() {
    if (!Capacitor.isNativePlatform()) return;

    await StatusBar.setStyle({ style: Style.Light });
    await StatusBar.setBackgroundColor({ color: '#F97316' });
    await SplashScreen.hide();

    // Handle Android hardware back button
    App.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) {
        window.history.back();
      } else {
        App.exitApp();
      }
    });

    // Register FCM push notification token
    this.registerPushToken();
  }

  private async registerPushToken() {
    if (!this.auth.isLoggedIn()) return;
    try {
      // @ts-ignore — @capacitor/push-notifications is a native-only plugin not declared in web build
      const { PushNotifications } = await import('@capacitor/push-notifications');
      await PushNotifications.requestPermissions();
      await PushNotifications.register();
      PushNotifications.addListener('registration', (token: { value: string }) => {
        const platform = Capacitor.getPlatform();
        this.api.registerDeviceToken({ token: token.value, platform }).subscribe({
          error: (e) => console.warn('Device token registration failed', e)
        });
      });
    } catch {
      // Plugin not installed or permissions denied — skip silently
    }
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

  openLocationPicker() {
    this.router.navigate(['/addresses']);
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
