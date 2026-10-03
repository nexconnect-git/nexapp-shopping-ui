import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AdminLiveSocket, openAdminLiveSocket } from '../../services/admin-live-socket';
import { AdminAccessService } from '../../services/admin-access.service';
import { ActivatedRoute } from '@angular/router';
import { Component, DestroyRef, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { Subscription, timer } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminDialogDirective } from '../../shared/admin-dialog.directive';
import {
  API_BASE_URL,
  ApiService,
  AppCurrencyPipe,
  AuthService,
  ToastService,
  apiErrorMessage,
} from '@shared/public-api';
import { DynamicTableComponent, TableCellDirective } from '@shared/public-api';

@Component({
  selector: 'app-issues',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    AdminDialogDirective,
    DynamicTableComponent,
    TableCellDirective,
    AppCurrencyPipe,
  ],
  templateUrl: './issues.component.html',
  styleUrl: './issues.component.scss',
})
export class IssuesComponent implements OnInit, OnDestroy {
  access=inject(AdminAccessService);private route=inject(ActivatedRoute);
  error=signal('');assignees=signal<any[]>([]);assignee='';queue='support';priority='normal';dueAt='';resolutionType='';
  private destroy=inject(DestroyRef);private listRequest?:Subscription;private detailRequest?:Subscription;
  orderFilter='';ownerFilter='';queueFilter='';priorityFilter='';dueFilter='';
  vendorFilter='';customerFilter='';partnerFilter='';
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private auth = inject(AuthService);
  private apiBaseUrl = inject(API_BASE_URL);

  issues = signal<any[]>([]);
  loading = signal(true);
  totalCount = signal(0);
  page = signal(1);

  tableColumns = [
    { key: 'issue', label: 'Issue', flex: '2fr' },
    { key: 'order', label: 'Order', flex: '1.5fr' },
    { key: 'type', label: 'Type', flex: '1fr' },
    { key: 'status', label: 'Status', flex: '1fr' },
    { key: 'ownership', label: 'Owner / queue', flex: '1.2fr' },
    { key: 'deadline', label: 'Priority / due', flex: '1.2fr' },
    { key: 'actions', label: 'Action', flex: '.7fr', minWidth: 72 },
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
  ws: AdminLiveSocket | null = null;

  refundAmount = '';
  refundMethod = '';
  adminNotes = '';
  newStatus = '';

  readonly issueTypes = [
    { value: '', label: 'All Types' },
    { value: 'return', label: 'Return' },
    { value: 'refund', label: 'Refund' },
    { value: 'damage', label: 'Damage' },
    { value: 'mismatch', label: 'Mismatch' },
    { value: 'late', label: 'Late Delivery' },
  ];

  readonly statuses = [
    { value: '', label: 'All Statuses' },
    { value: 'open', label: 'Open' },
    { value: 'in_review', label: 'In Review' },
    { value: 'resolved', label: 'Resolved' },
    { value: 'rejected', label: 'Rejected' },
    { value: 'refund_initiated', label: 'Refund requested (legacy)' },
    ...['assigned','investigating','waiting_customer','waiting_vendor','waiting_partner','resolution_pending','closed','escalated'].map(value=>({value,label:value.replaceAll('_',' ')})),
  ];

  ngOnInit() {
    this.api.getAdminSupportAssignees().pipe(takeUntilDestroyed(this.destroy)).subscribe({next:response=>this.assignees.set(response.results),error:()=>this.error.set('Support owners could not be loaded.')});
    const issue=this.route.snapshot.queryParamMap.get('issue');if(issue)this.openIssue({id:issue});
    this.reloadSub = timer(0, 15000).subscribe(() => {
      if (this.autoReload() && !document.hidden && !this.selectedIssue()) this.load();
    });
  }

  ngOnDestroy() {
    clearTimeout(this.timer);
    this.reloadSub?.unsubscribe();
    this.closeWebSocket();
  }

  manualReload() {
    this.page.set(1);
    this.load();
  }
  toggleAutoReload() {
    this.autoReload.update((v) => !v);
  }

  load() {
    this.listRequest?.unsubscribe();
    this.error.set('');
    this.loading.set(true);
    this.listRequest=this.api
      .getAdminIssues({
        issue_type: this.filterType() || undefined,
        status: this.filterStatus() || undefined,
        search: this.search || undefined,
        assignee:this.ownerFilter || undefined, queue:this.queueFilter || undefined, priority:this.priorityFilter || undefined, due:this.dueFilter || undefined,
        order:this.orderFilter || undefined,page: this.page(),vendor:this.vendorFilter || undefined,customer:this.customerFilter || undefined,delivery_partner:this.partnerFilter || undefined,
      })
      .pipe(takeUntilDestroyed(this.destroy)).subscribe({
        next: (res) => {
          this.issues.set(res.results || res);
          this.totalCount.set(res.count ?? (res.results ?? res).length);
          this.loading.set(false);
          this.lastRefreshed.set(new Date());
        },
        error: () => {this.loading.set(false);this.error.set('Could not load support cases.');},
      });
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

  onFilterChange() {
    this.page.set(1);
    this.load();
  }
  overdue(issue:any){return issue.due_at && !['resolved','closed','rejected'].includes(issue.status) && new Date(issue.due_at).getTime()<Date.now();}

  closeWebSocket() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  connectWebSocket(issueId: string) {
    this.closeWebSocket();
    this.ws = openAdminLiveSocket(
      `/ws/issues/${issueId}/`,
      () => this.auth.getToken(),
      this.apiBaseUrl,
    );

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'chat_message') {
        const msg = data.message;
        this.selectedIssue.update((iss) => {
          if (!iss || !iss.messages) return iss;
          if (iss.messages.find((m: any) => m.id === msg.id)) {
            return iss; // Already present
          }
          return { ...iss, messages: [...iss.messages, msg] };
        });
      }
    };

  }

  openIssue(issue: any) {
    this.loadingDetail.set(true);
    this.selectedIssue.set(null);
    this.detailRequest?.unsubscribe();
    this.detailRequest=this.api.getAdminIssue(issue.id).pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: (iss) => {
        this.selectedIssue.set(iss);
        this.adminNotes = iss.admin_notes || '';
        this.refundAmount = iss.refund_amount ?? '';
        this.refundMethod = iss.refund_method || '';
        this.newStatus = iss.status;this.assignee=iss.assignee || '';this.queue=iss.queue || 'support';this.priority=iss.priority || 'normal';this.resolutionType=iss.resolution_type || '';
        this.dueAt=iss.due_at ? new Date(new Date(iss.due_at).getTime()-new Date(iss.due_at).getTimezoneOffset()*60000).toISOString().slice(0,16) : '';
        this.loadingDetail.set(false);
        this.connectWebSocket(iss.id);
      },
      error: () => {this.loadingDetail.set(false);this.error.set('This support case could not be opened. Retry from the case list.');},
    });
  }

  closePanel() {
    if (this.saving() || this.sending()) return;
    this.detailRequest?.unsubscribe();
    this.loadingDetail.set(false);
    this.selectedIssue.set(null);
    this.closeWebSocket();
  }

  sendMessage() {
    const text = this.newMessage.trim();
    if (!text || this.sending()) return;
    this.sending.set(true);
    this.api.sendAdminIssueMessage(this.selectedIssue().id, text).pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: (msg) => {
        this.selectedIssue.update((iss) => {
          if (!iss || !iss.messages) return iss;
          if (iss.messages.find((m: any) => m.id === msg.id)) return iss;
          return { ...iss, messages: [...iss.messages, msg] };
        });
        this.newMessage = '';
        this.sending.set(false);
      },
      error: error => {this.sending.set(false);this.toast.show(apiErrorMessage(error, 'The reply could not be sent. Your text has been retained.'),'error');},
    });
  }

  saveResolution() {
    if(this.saving() || !this.access.can('support.manage'))return;
    this.saving.set(true);
    const payload: any = {
      status: this.newStatus,
      admin_notes: this.adminNotes,assignee:this.assignee || null,queue:this.queue,priority:this.priority,due_at:this.dueAt ? new Date(this.dueAt).toISOString() : null,resolution_type:this.resolutionType,
    };
    payload.refund_amount = this.refundAmount === '' || this.refundAmount === null ? null : this.refundAmount;
    payload.refund_method = this.refundMethod;

    this.api.updateAdminIssue(this.selectedIssue().id, payload).pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: (iss) => {
        this.selectedIssue.set(iss);
        this.saving.set(false);
        this.toast.show('Case changes saved. Private notes remain internal.','success');
        this.load();
      },
      error: error => {this.saving.set(false);this.toast.show(apiErrorMessage(error, 'Support changes could not be saved. Check the case values.'), 'error');},
    });
  }

  typeLabel(type: string): string {
    const map: Record<string, string> = {
      return: 'Return',
      refund: 'Refund',
      damage: 'Damage',
      mismatch: 'Mismatch',
      late: 'Late delivery',
    };
    return map[type] ?? type;
  }

  typeIcon(type: string): string {
    const map: Record<string, string> = {
      return: 'undo',
      refund: 'payments',
      damage: 'broken_image',
      mismatch: 'compare_arrows',
      late: 'schedule',
    };
    return map[type] ?? 'help_outline';
  }

  statusClass(s: string): string {
    const map: Record<string, string> = {
      open: 'badge-open',
      in_review: 'badge-review',
      resolved: 'badge-resolved',
      rejected: 'badge-rejected',
      refund_initiated: 'badge-refund',
    };
    return map[s] ?? '';
  }
}
