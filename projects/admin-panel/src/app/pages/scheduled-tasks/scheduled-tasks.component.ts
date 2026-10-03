import { AdminAccessService } from '../../services/admin-access.service';
import { readAllAdminPages } from '../../shared/admin-pagination';
import { AdminConfirmService } from '../../services/admin-confirm.service';
import { DialogModule } from 'primeng/dialog';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DestroyRef } from '@angular/core';
import { AdminCanDirective } from '../../shared/admin-can.directive';
import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  apiErrorMessage,
  ApiService,
  AppCurrencyPipe,
  ToastService,
} from '@shared/public-api';
import { DynamicTableComponent, TableCellDirective } from '@shared/public-api';

interface TaskDef {
  key: string;
  label: string;
  description: string;
  icon: string;
  category: string;
  params: string[];
}

interface ScheduledJob {
  id: string;
  task_key: string;
  label: string;
  icon: string;
  category: string;
  args: any[];
  kwargs: Record<string, any>;
  scheduled_at: string | null;
  enqueued_at: string | null;
  status: string;
  description: string;
}

@Component({
  selector: 'app-scheduled-tasks',
  standalone: true,
  imports: [DialogModule, AdminCanDirective,
    CommonModule,
    FormsModule,
    DynamicTableComponent,
    TableCellDirective,
    AppCurrencyPipe,
  ],
  templateUrl: './scheduled-tasks.component.html',
  styleUrl: './scheduled-tasks.component.scss',
})
export class ScheduledTasksComponent implements OnInit, OnDestroy {
  readonly access = inject(AdminAccessService);
  private confirmService = inject(AdminConfirmService);
  private destroy = inject(DestroyRef);
  error = signal('');
  queueStatus = signal('Not checked');
  selectorError = signal('');
  detail: any = null;
  detailVisible = false;
  private api = inject(ApiService);
  private toast = inject(ToastService);

  loading = signal(true);
  submitting = signal(false);

  taskDefs = signal<TaskDef[]>([]);
  jobs = signal<ScheduledJob[]>([]);
  cancellingId = signal<string | null>(null);

  tableColumns = [
    { key: 'task', label: 'Task', flex: '2fr', minWidth: 260 },
    { key: 'category', label: 'Category', flex: '1fr' },
    { key: 'parameters', label: 'Parameters', flex: '2fr', minWidth: 180 },
    { key: 'time', label: 'Time', flex: '1.5fr', minWidth: 140 },
    { key: 'status', label: 'Status', flex: '1fr' },
    { key: 'actions', label: 'Action', flex: '1fr', minWidth: 140 },
  ];

  // Vendor/partner lists for param selects
  vendors = signal<any[]>([]);
  partners = signal<any[]>([]);
  pendingVendorPayouts = signal<any[]>([]);
  pendingDeliveryPayouts = signal<any[]>([]);

  // Form state
  selectedTask = signal<TaskDef | null>(null);
  form = {
    task_key: '',
    schedule_mode: 'now' as 'now' | 'later',
    scheduled_time: '',
    repeat_mode: 'once' as 'once' | 'daily' | 'weekly',
    kwargs: {} as Record<string, any>,
  };

  private refreshInterval: any;

  ngOnInit() {
    this.load();
    // Auto-refresh jobs every 15 seconds
    this.refreshInterval = setInterval(() => {if(!document.hidden&&!this.error())this.loadJobs();}, 15000);
  }

  ngOnDestroy() {
    clearInterval(this.refreshInterval);
  }

  load() {
    this.loading.set(true);
    this.error.set('');
    this.api.getScheduledTasks().pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: (res) => {
        this.queueStatus.set(res.queue?.scope || 'Queue connected');
        this.taskDefs.set(res.task_definitions || []);
        const sortedJobs = (res.jobs || []).sort((a: any, b: any) => {
          const ta = new Date(a.scheduled_at || a.enqueued_at || 0).getTime();
          const tb = new Date(b.scheduled_at || b.enqueued_at || 0).getTime();
          return tb - ta;
        });
        this.jobs.set(sortedJobs);
        this.loading.set(false);
      },
      error: () => {
        this.queueStatus.set('Queue unavailable');
        this.error.set('Background jobs are unavailable. Check Redis and the scheduler, then retry.');
        this.loading.set(false);
      },
    });
  }

  loadJobs() {
    this.api.getScheduledTasks().pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: (res) => {
        this.error.set('');
        this.queueStatus.set(res.queue?.scope || 'Queue connected');
        this.taskDefs.set(res.task_definitions || []);
        const sortedJobs = (res.jobs || []).sort((a: any, b: any) => {
          const ta = new Date(a.scheduled_at || a.enqueued_at || 0).getTime();
          const tb = new Date(b.scheduled_at || b.enqueued_at || 0).getTime();
          return tb - ta;
        });
        this.jobs.set(sortedJobs);
      },
      error: () => {this.queueStatus.set('Queue unavailable');this.error.set('Could not refresh jobs. Retry to reconnect.');},
    });
  }

  loadVendors() {
    this.api.getAdminVendors({ page_size: 200 }).pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: (res) => this.vendors.set(res.results || res),
      error: () => {},
    });
  }

  loadPartners() {
    this.api.getAdminDeliveryPartners({ page_size: 200 }).pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: (res) => this.partners.set(res.results || res),
      error: () => {},
    });
  }

  loadPendingPayouts() {
    // Vendor payouts: show 'approved' ones (vendor has approved, admin needs to schedule/send)
    this.selectorError.set('');
    readAllAdminPages<any>(page => this.api.getAdminVendorPayouts({page})).pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: (res) => {
        const payouts = res.filter(
          (p: any) =>
            p.status === 'approved' || p.status === 'scheduled',
        );
        this.pendingVendorPayouts.set(payouts);
      },
      error: () => this.selectorError.set('Vendor payouts could not be loaded. Retry before scheduling a payment record.'),
    });

    // Delivery payouts: show 'scheduled' ones (no approval step, ready to send payment)
    readAllAdminPages<any>(page => this.api.getAdminDeliveryPayouts({page})).pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: (res) => {
        const payouts = res.filter(
          (p: any) => p.status === 'approved' || p.status === 'scheduled',
        );
        this.pendingDeliveryPayouts.set(payouts);
      },
      error: () => this.selectorError.set('Delivery payouts could not be loaded. Retry before scheduling a payment record.'),
    });
  }

  extraParams(task:TaskDef){return task.params.filter(key=>!['vendor_id','partner_id','payout_id','title','message','target'].includes(key));}

  selectTask(def: TaskDef) {
    if (this.submitting()) return;
    this.selectedTask.set(def);
    this.form.task_key = def.key;
    this.form.kwargs = Object.fromEntries(def.params.map(param => [param, '']));
    // Set defaults for known params
    if (def.params.includes('target')) this.form.kwargs['target'] = 'all';
    if (def.category === 'payouts' && this.access.can('finance.view')) this.loadPendingPayouts();
  }

  clearSelection() {
    this.selectedTask.set(null);
    this.form.task_key = '';
    this.form.kwargs = {};
  }

  get repeatSeconds(): number | undefined {
    const m = this.form.repeat_mode;
    if (m === 'daily') return 86400;
    if (m === 'weekly') return 604800;
    return undefined;
  }

  submit() {
    if (this.submitting()) return;
    const task = this.selectedTask();
    if (!task) {
      this.toast.show('Select a task type first.', 'error');
      return;
    }

    // Validate required kwargs
    for (const p of task.params) {
      if (!this.form.kwargs[p]) {
        this.toast.show(`"${p}" is required.`, 'error');
        return;
      }
    }

    const payload: any = {
      task_key: this.form.task_key,
      kwargs: { ...this.form.kwargs },
    };

    if (this.form.schedule_mode === 'later') {
      if (!this.form.scheduled_time) {
        this.toast.show('Provide a scheduled datetime.', 'error');
        return;
      }
      payload.scheduled_time = new Date(this.form.scheduled_time).toISOString();
      if (this.repeatSeconds) payload.repeat = this.repeatSeconds;
    }

    this.submitting.set(true);
    const scheduleMode = this.form.schedule_mode;
    this.api.createScheduledTask(payload).pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: () => {
        const when =
          scheduleMode === 'now'
            ? 'queued immediately'
            : `scheduled for ${new Date(payload.scheduled_time).toLocaleString()}`;
        this.toast.show(`"${task.label}" ${when}.`, 'success');
        this.submitting.set(false);
        this.clearSelection();
        this.loadJobs();
      },
      error: (err) => {
        this.toast.show(apiErrorMessage(err, 'Failed to schedule task.'), 'error');
        this.submitting.set(false);
      },
    });
  }

  async cancel(jobId: string) {
    if (!this.access.can('automation.manage') || !await this.confirmService.ask('Cancel job', 'Cancel this queued or scheduled job?')) return;
    this.cancellingId.set(jobId);
    this.api.cancelScheduledTask(jobId).pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: () => {
        this.toast.show('Job cancelled.', 'success');
        this.cancellingId.set(null);
        this.loadJobs();
      },
      error: () => {
        this.toast.show('Failed to cancel job.', 'error');
        this.cancellingId.set(null);
      },
    });
  }

  async retry(jobId: string) {
    if(!this.access.can('automation.manage')||!await this.confirmService.ask('Retry task', 'Requeue this failed task for another worker attempt?'))return;
    this.cancellingId.set(jobId);
    this.api.retryScheduledTask(jobId).pipe(takeUntilDestroyed(this.destroy)).subscribe({next:()=>{this.cancellingId.set(null);this.toast.show('Retry queued.', 'success');this.loadJobs()},error:err=>{this.cancellingId.set(null);this.toast.show(apiErrorMessage(err,'Retry failed.'),'error')}});
  }

  categoryLabel(cat: string): string {
    const m: Record<string, string> = {
      payouts: 'Payouts',
      reports: 'Reports',
      notifications: 'Notifications',
      operations: 'Operations',
      recommendations: 'Recommendations',
    };
    return m[cat] || cat;
  }

  categoryIcon(cat: string): string {
    const m: Record<string, string> = {
      payouts: 'payments',
      reports: 'bar_chart',
      notifications: 'campaign',
    };
    return m[cat] || 'schedule';
  }

  statusClass(s: string): string {
    const m: Record<string, string> = {
      scheduled: 'status-scheduled',
      queued: 'status-queued',
      started: 'status-running',
      finished: 'status-done',
      failed: 'status-failed',
      deferred: 'status-scheduled',
      canceled: 'status-failed',
    };
    return m[s] || 'status-queued';
  }

  formatKwargs(kwargs: Record<string, any>): string {
    return (
      Object.entries(kwargs)
        .map(([k, v]) => `${k}: ${v}`)
        .join(' · ') || '—'
    );
  }

  tasksByCategory(cat: string): TaskDef[] {
    return this.taskDefs().filter((t) => t.category === cat);
  }

  get categories(): string[] {
    return [...new Set(this.taskDefs().map((t) => t.category))];
  }
}
