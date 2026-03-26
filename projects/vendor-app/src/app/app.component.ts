import { Component, inject, signal, HostListener, OnInit, DestroyRef } from '@angular/core';
import { Router, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
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
  sidebarCollapsed = signal(true);
  profileOpen = signal(false);
  notifOpen = signal(false);
  notifications = signal<any[]>([]);
  notifLoading = signal(false);
  unreadCount = signal(0);

  ngOnInit() {
    if (this.auth.isLoggedIn()) {
      timer(0, 30000).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.loadUnreadCount());
    }
  }

  loadUnreadCount() {
    this.api.getUnreadCount().subscribe({ next: (r) => this.unreadCount.set(r.count ?? 0), error: () => {} });
  }

  toggleProfile(event?: Event) {
    event?.stopPropagation();
    this.profileOpen.update(v => !v);
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
      next: (r) => { this.notifications.set((r.results || r).slice(0, 8)); this.notifLoading.set(false); },
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
  closeDropdowns() { this.profileOpen.set(false); this.notifOpen.set(false); }

  closeProfile() { this.profileOpen.set(false); }

  isAuthRoute(): boolean {
    const url = this.router.url;
    return url.includes('/login') || url.includes('/register');
  }

  isPendingRoute(): boolean {
    return this.router.url.includes('/pending-approval');
  }

  toggleSidebar() {
    this.sidebarCollapsed.update(v => !v);
  }

  closeMobileSidebar() {
    this.sidebarCollapsed.set(true);
  }

  logout() {
    this.auth.logout();
  }
}
