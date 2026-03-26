import { Component, signal, inject, OnInit, HostListener, DestroyRef } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { timer } from 'rxjs';
import { AuthService, ApiService } from '@shared/public-api';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit {
  auth = inject(AuthService);
  api = inject(ApiService);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

  sidebarCollapsed = signal(false);
  mobileMenuOpen = signal(false);
  profileOpen = signal(false);
  notifOpen = signal(false);
  notifications = signal<any[]>([]);
  notifLoading = signal(false);
  unreadCount = signal(0);

  get navItems() {
    const items = [
      { route: '/', icon: 'dashboard', label: 'Dashboard' },
      { route: '/vendors', icon: 'storefront', label: 'Vendors' },
      { route: '/customers', icon: 'people', label: 'Customers' },
      { route: '/delivery-partners', icon: 'local_shipping', label: 'Delivery Partners' },
      { route: '/categories', icon: 'category', label: 'Categories' },
      { route: '/assets', icon: 'handyman', label: 'Assets' },
      { route: '/sales-report', icon: 'trending_up', label: 'Sales Report' },
      { route: '/payouts', icon: 'payments', label: 'Payouts' },
      { route: '/notifications', icon: 'notifications', label: 'Notifications' },
    ];
    
    if (this.auth.isSuperUser()) {
      items.push({ route: '/admin-users', icon: 'admin_panel_settings', label: 'Admin Management' });
    }
    
    return items;
  }

  ngOnInit() {
    if (this.auth.isLoggedIn()) {
      timer(0, 30000).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.loadUnreadCount());
    }
  }

  loadUnreadCount() {
    this.api.getUnreadCount().subscribe({
      next: (r) => this.unreadCount.set(r.count ?? 0),
      error: () => {}
    });
  }

  toggleProfile(event: Event) {
    event.stopPropagation();
    const opening = !this.profileOpen();
    this.profileOpen.set(opening);
    this.notifOpen.set(false);
  }

  toggleNotif(event: Event) {
    event.stopPropagation();
    const opening = !this.notifOpen();
    this.notifOpen.set(opening);
    this.profileOpen.set(false);
    if (opening && this.notifications().length === 0) {
      this.fetchNotifications();
    }
  }

  fetchNotifications() {
    this.notifLoading.set(true);
    this.api.getNotifications().subscribe({
      next: (r) => {
        const items = (r.results || r).slice(0, 8);
        this.notifications.set(items);
        this.notifLoading.set(false);
      },
      error: () => this.notifLoading.set(false)
    });
  }

  markAllRead() {
    this.api.markAllNotificationsRead().subscribe({
      next: () => {
        this.unreadCount.set(0);
        this.notifications.update(list => list.map((n: any) => ({ ...n, is_read: true })));
      },
      error: () => {}
    });
  }

  @HostListener('document:click')
  closeDropdowns() {
    this.profileOpen.set(false);
    this.notifOpen.set(false);
  }

  toggleSidebar() {
    this.sidebarCollapsed.update(v => !v);
  }

  getInitials(): string {
    const user = this.auth.user();
    if (!user) return 'A';
    if (user.first_name && user.last_name) {
      return user.first_name[0] + user.last_name[0];
    }
    return (user.username?.[0] || 'A').toUpperCase();
  }

  logout() {
    this.profileOpen.set(false);
    this.auth.logout();
  }

  notifIcon(type: string): string {
    const map: Record<string, string> = {
      order: 'receipt_long',
      delivery: 'local_shipping',
      promo: 'local_offer',
      system: 'info',
    };
    return map[type] || 'notifications';
  }

  goToNotifications() {
    this.notifOpen.set(false);
    this.router.navigate(['/notifications']);
  }
}
