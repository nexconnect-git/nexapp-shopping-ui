import { CommonModule, DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '@shared/public-api';

@Component({
  selector: 'app-audit-logs',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe],
  templateUrl: './audit-logs.component.html',
  styleUrl: './audit-logs.component.scss'
})
export class AuditLogsComponent implements OnInit {
  private api = inject(ApiService);

  logs = signal<any[]>([]);
  loading = signal(true);
  total = signal(0);
  page = signal(1);
  action = '';
  entityType = '';
  search = '';
  private searchTimer: any;

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading.set(true);
    const params: any = { page: this.page() };
    if (this.action) params.action = this.action;
    if (this.entityType.trim()) params.entity_type = this.entityType.trim();
    if (this.search.trim()) params.search = this.search.trim();

    this.api.getAdminAuditLogs(params).subscribe({
      next: (res) => {
        this.logs.set(res.results || res || []);
        this.total.set(res.count || (res.results || res || []).length);
        this.loading.set(false);
      },
      error: () => {
        this.logs.set([]);
        this.loading.set(false);
      }
    });
  }

  onSearch() {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.page.set(1);
      this.load();
    }, 350);
  }

  applyFilters() {
    this.page.set(1);
    this.load();
  }

  setPage(page: number) {
    if (page < 1) return;
    this.page.set(page);
    this.load();
  }

  get totalPages() {
    return Math.max(1, Math.ceil(this.total() / 20));
  }
}
