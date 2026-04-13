import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { Subscription, timer } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '@shared/public-api';
import { DynamicTableComponent, TableCellDirective } from '../../shared/components/dynamic-table/dynamic-table.component';

@Component({
  selector: 'app-issues',
  standalone: true,
  imports: [CommonModule, FormsModule, DynamicTableComponent, TableCellDirective],
  templateUrl: './issues.component.html',
  styleUrl: './issues.component.scss' })
export class IssuesComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);

  issues = signal<any[]>([]);
  loading = signal(true);
  totalCount = signal(0);
  page = signal(1);

  tableColumns = [
    { key: 'issue', label: 'Issue', flex: '2fr' },
    { key: 'order', label: 'Order', flex: '1.5fr' },
    { key: 'type', label: 'Type', flex: '1fr' },
    { key: 'status', label: 'Status', flex: '1fr' },
    { key: 'date', label: 'Date', flex: '1fr' }
  ];

  filterType = signal('');
  filterStatus = signal('');
  search = '';
  private timer: any;
  lastRefreshed = signal<Date | null>(null);
  autoReload = signal(true);
  private reloadSub?: Subscription;

  // Detail panel
  selectedIssue = signal<any>(null);
  loadingDetail = signal(false);
  newMessage = '';
  sending = signal(false);
  saving = signal(false);
  private ws: WebSocket | null = null;

  refundAmount = '';
  refundMethod = '';
  adminNotes = '';
  newStatus = '';

  readonly issueTypes = [
    { value: '', label: 'All Types' },
    { value: 'return',   label: 'Return' },
    { value: 'refund',   label: 'Refund' },
    { value: 'damage',   label: 'Damage' },
    { value: 'mismatch', label: 'Mismatch' },
  ];

  readonly statuses = [
    { value: '', label: 'All Statuses' },
    { value: 'open',             label: 'Open' },
    { value: 'in_review',        label: 'In Review' },
    { value: 'resolved',         label: 'Resolved' },
    { value: 'rejected',         label: 'Rejected' },
    { value: 'refund_initiated', label: 'Refund Initiated' },
  ];

  ngOnInit() {
    this.reloadSub = timer(0, 15000).subscribe(() => {
      if (this.autoReload() && !this.selectedIssue()) this.load();
    });
  }

  ngOnDestroy() { this.reloadSub?.unsubscribe(); this.closeWebSocket(); }

  manualReload() { this.page.set(1); this.load(); }
  toggleAutoReload() { this.autoReload.update(v => !v); }

  load() {
    this.loading.set(true);
    this.api.getAdminIssues({
      issue_type: this.filterType() || undefined,
      status: this.filterStatus() || undefined,
      search: this.search || undefined,
      page: this.page() }).subscribe({
      next: (res) => {
        this.issues.set(res.results || res);
        this.totalCount.set(res.count ?? (res.results ?? res).length);
        this.loading.set(false);
        this.lastRefreshed.set(new Date());
      },
      error: () => this.loading.set(false) });
  }

  onSearch() {
    clearTimeout(this.timer);
    this.page.set(1);
    this.timer = setTimeout(() => this.load(), 350);
  }

  onPageChange(newPage: number) {
    this.page.set(newPage);
    this.load();
  }

  onFilterChange() { this.page.set(1); this.load(); }

  closeWebSocket() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  connectWebSocket(issueId: string) {
    this.closeWebSocket();
    const token = localStorage.getItem('access_token') || '';
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/issues/${issueId}/?token=${token}`;
    this.ws = new WebSocket(wsUrl);

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'chat_message') {
        const msg = data.message;
        this.selectedIssue.update(iss => {
          if (!iss || !iss.messages) return iss;
          if (iss.messages.find((m: any) => m.id === msg.id)) {
            return iss; // Already present
          }
          return { ...iss, messages: [...iss.messages, msg] };
        });
      }
    };

    this.ws.onerror = (err) => console.error('WebSocket error:', err);
  }

  openIssue(issue: any) {
    this.loadingDetail.set(true);
    this.selectedIssue.set(null);
    this.api.getAdminIssue(issue.id).subscribe({
      next: (iss) => {
        this.selectedIssue.set(iss);
        this.adminNotes = iss.admin_notes || '';
        this.refundAmount = iss.refund_amount ?? '';
        this.refundMethod = iss.refund_method || '';
        this.newStatus = iss.status;
        this.loadingDetail.set(false);
        this.connectWebSocket(iss.id);
      },
      error: () => this.loadingDetail.set(false) });
  }

  closePanel() { 
    this.selectedIssue.set(null); 
    this.closeWebSocket();
  }

  sendMessage() {
    const text = this.newMessage.trim();
    if (!text || this.sending()) return;
    this.sending.set(true);
    this.api.sendAdminIssueMessage(this.selectedIssue().id, text).subscribe({
      next: (msg) => {
        this.selectedIssue.update(iss => {
            if (!iss || !iss.messages) return iss;
            if (iss.messages.find((m: any) => m.id === msg.id)) return iss;
            return { ...iss, messages: [...iss.messages, msg] };
        });
        this.newMessage = '';
        this.sending.set(false);
      },
      error: () => this.sending.set(false) });
  }

  saveResolution() {
    this.saving.set(true);
    const payload: any = {
      status: this.newStatus,
      admin_notes: this.adminNotes };
    if (this.refundAmount) payload.refund_amount = this.refundAmount;
    if (this.refundMethod) payload.refund_method = this.refundMethod;

    this.api.updateAdminIssue(this.selectedIssue().id, payload).subscribe({
      next: (iss) => {
        this.selectedIssue.set(iss);
        this.saving.set(false);
        this.load();
      },
      error: () => this.saving.set(false) });
  }

  typeLabel(type: string): string {
    const map: Record<string, string> = { return: 'Return', refund: 'Refund', damage: 'Damage', mismatch: 'Mismatch' };
    return map[type] ?? type;
  }

  typeIcon(type: string): string {
    const map: Record<string, string> = { return: 'undo', refund: 'payments', damage: 'broken_image', mismatch: 'compare_arrows' };
    return map[type] ?? 'help_outline';
  }

  statusClass(s: string): string {
    const map: Record<string, string> = {
      open: 'badge-open', in_review: 'badge-review', resolved: 'badge-resolved',
      rejected: 'badge-rejected', refund_initiated: 'badge-refund' };
    return map[s] ?? '';
  }
}


