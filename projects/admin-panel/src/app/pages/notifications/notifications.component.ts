import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '@shared/public-api';

interface Notification {
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
  
  notifications = signal<Notification[]>([]);
  loading = signal(true);
  total = signal(0);
  page = signal(1);
  totalPages = signal(1);
  itemsPerPage = 20;

  typeFilter = '';
  search = '';
  
  showModal = signal(false);
  sending = signal(false);
  
  newNotification = signal({
    title: '',
    message: '',
    notification_type: 'info',
    user_id: '' as number | string
  });

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
    if (p >= 1 && p <= this.totalPages()) {
      this.page.set(p);
      this.load();
    }
  }

  openSendModal() {
    this.newNotification.set({ title: '', message: '', notification_type: 'info', user_id: '' });
    this.showModal.set(true);
  }

  closeModal() {
    this.showModal.set(false);
  }

  sendNotification() {
    if (!this.newNotification().title || !this.newNotification().message) return;
    this.sending.set(true);
    const payload: any = { ...this.newNotification() };
    if (!payload.user_id) delete payload.user_id; // Broadcast if empty
    
    this.api.sendAdminNotification(payload).subscribe({
      next: () => {
        this.sending.set(false);
        this.closeModal();
        this.page.set(1);
        this.load();
      },
      error: () => this.sending.set(false)
    });
  }

  deleteNotification(id: string) {
    if (!confirm('Are you sure you want to delete this notification?')) return;
    this.api.deleteAdminNotification(id).subscribe({
      next: () => this.load()
    });
  }
}
