import { Component, inject, signal, OnInit, HostListener, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { AuthService, ApiService } from '@shared/public-api';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { timer } from 'rxjs';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit {
  auth = inject(AuthService);
  api = inject(ApiService);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

  mobileMenuOpen = signal(false);
  userMenuOpen = signal(false);

  userInitials = () => {
    const u = this.auth.user();
    if (!u) return '?';
    return ((u.first_name?.[0] || '') + (u.last_name?.[0] || '')).toUpperCase() || u.username[0].toUpperCase();
  };

  ngOnInit() {
    if (this.auth.isLoggedIn()) {
      this.api.refreshCartCount();
      // Poll unread notification count every 30s
      timer(0, 30000).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.api.refreshUnreadCount());
    }
    // Refresh counts on every navigation
    this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe(() => {
      if (this.auth.isLoggedIn()) {
        this.api.refreshCartCount();
        this.api.refreshUnreadCount();
      }
    });
  }

  clearNotifBadge() {
    // Mark all read on opening notifications/orders page
    this.api.markAllNotificationsRead().subscribe({ next: () => this.api.unreadNotifications.set(0) });
  }

  toggleUserMenu(event?: Event) {
    event?.stopPropagation();
    this.userMenuOpen.update(v => !v);
  }

  @HostListener('document:click')
  closeDropdowns() { this.userMenuOpen.set(false); }

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
