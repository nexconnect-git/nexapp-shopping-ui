import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '@shared/public-api';

interface AdminNotification {
  id: string;
  user: string | null;
  username: string;
  title: string;
  message: string;
  notification_type: string;
  is_read: boolean;
  created_at: string;
}

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './notifications.component.html',
  styleUrl: './notifications.component.scss'
})
export class NotificationsComponent implements OnInit {
  private api = inject(ApiService);

  notifications = signal<AdminNotification[]>([]);
  loading = signal(true);
  total = signal(0);
  page = signal(1);
  totalPages = signal(1);
  itemsPerPage = 20;

  typeFilter = '';
  search = '';

  showModal = signal(false);
  sending = signal(false);
  sendSuccess = signal('');
  sendError = signal('');

  // Plain object — two-way binding works
  form = {
    title: '',
    message: '',
    notification_type: 'info',
    audience: 'all',   // 'all' | 'customer' | 'vendor' | 'delivery' | 'user'
    user_id: '',
  };

  private timer: any;

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    const params: any = { page: this.page() };
    if (this.typeFilter) params.notification_type = this.typeFilter;
    if (this.search) params.search = this.search;
    this.api.getAdminNotifications(params).subscribe({
      next: (r: any) => {
        this.notifications.set(r.results || r);
        this.total.set(r.count || (r.results || r).length);
        this.totalPages.set(Math.ceil((r.count || 0) / this.itemsPerPage) || 1);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  onSearch() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => { this.page.set(1); this.load(); }, 400);
  }

  setPage(p: number) {
    if (p >= 1 && p <= this.totalPages()) { this.page.set(p); this.load(); }
  }

  openSendModal() {
    this.form = { title: '', message: '', notification_type: 'info', audience: 'all', user_id: '' };
    this.sendSuccess.set('');
    this.sendError.set('');
    this.showModal.set(true);
  }

  closeModal() { this.showModal.set(false); }

  sendNotification() {
    if (!this.form.title.trim() || !this.form.message.trim()) return;
    this.sending.set(true);
    this.sendError.set('');
    this.sendSuccess.set('');

    const payload: any = {
      title: this.form.title.trim(),
      message: this.form.message.trim(),
      notification_type: this.form.notification_type,
    };
    if (this.form.audience === 'user') {
      if (!this.form.user_id) {
        this.sendError.set('Please enter a User ID.');
        this.sending.set(false);
        return;
      }
      payload.user_id = parseInt(this.form.user_id, 10);
    } else if (this.form.audience !== 'all') {
      payload.role = this.form.audience;
    }

    this.api.sendAdminNotification(payload).subscribe({
      next: (res: any) => {
        this.sending.set(false);
        this.sendSuccess.set(res.status || 'Notification sent!');
        this.page.set(1);
        this.load();
        setTimeout(() => this.closeModal(), 1800);
      },
      error: (err: any) => {
        this.sendError.set(err.error?.error || 'Failed to send notification.');
        this.sending.set(false);
      }
    });
  }

  deleteNotification(id: string) {
    if (!confirm('Delete this notification?')) return;
    this.api.deleteAdminNotification(id).subscribe({ next: () => this.load() });
  }

  audienceLabel(): string {
    const map: Record<string, string> = {
      all: 'All Users', customer: 'All Customers',
      vendor: 'All Vendors', delivery: 'All Delivery Partners', user: 'Specific User'
    };
    return map[this.form.audience] || this.form.audience;
  }
}
