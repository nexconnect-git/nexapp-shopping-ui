import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, ToastService } from '@shared/public-api';
import { DynamicTableComponent, TableCellDirective } from '../../shared/components/dynamic-table/dynamic-table.component';

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
  imports: [CommonModule, FormsModule, DynamicTableComponent, TableCellDirective],
  templateUrl: './scheduled-tasks.component.html',
  styleUrl: './scheduled-tasks.component.scss'
})
export class ScheduledTasksComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private toast = inject(ToastService);

  loading = signal(true);
  submitting = signal(false);

  taskDefs = signal<TaskDef[]>([]);
  jobs = signal<ScheduledJob[]>([]);
  cancellingId = signal<string | null>(null);

  tableColumns = [
    { key: 'task', label: 'Task', flex: '2fr' },
    { key: 'category', label: 'Category', flex: '1fr' },
    { key: 'parameters', label: 'Parameters', flex: '2fr' },
    { key: 'time', label: 'Time', flex: '1.5fr' },
    { key: 'status', label: 'Status', flex: '1fr' },
    { key: 'actions', label: 'Action', flex: '1fr' }
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
    kwargs: {} as Record<string, any> };

  private refreshInterval: any;

  ngOnInit() {
    this.load();
    this.loadVendors();
    this.loadPartners();
    this.loadPendingPayouts();
    // Auto-refresh jobs every 15 seconds
    this.refreshInterval = setInterval(() => this.loadJobs(), 15000);
  }

  ngOnDestroy() {
    clearInterval(this.refreshInterval);
  }

  load() {
    this.loading.set(true);
    this.api.getScheduledTasks().subscribe({
      next: (res) => {
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
        this.toast.show('Failed to load scheduled tasks.', 'error');
        this.loading.set(false);
      }
    });
  }

  loadJobs() {
    this.api.getScheduledTasks().subscribe({
      next: (res) => {
        const sortedJobs = (res.jobs || []).sort((a: any, b: any) => {
          const ta = new Date(a.scheduled_at || a.enqueued_at || 0).getTime();
          const tb = new Date(b.scheduled_at || b.enqueued_at || 0).getTime();
          return tb - ta;
        });
        this.jobs.set(sortedJobs);
      },
      error: () => {}
    });
  }

  loadVendors() {
    this.api.getAdminVendors({ page_size: 200 }).subscribe({
      next: (res) => this.vendors.set(res.results || res),
      error: () => {}
    });
  }

  loadPartners() {
    this.api.getAdminDeliveryPartners({ page_size: 200 }).subscribe({
      next: (res) => this.partners.set(res.results || res),
      error: () => {}
    });
  }

  loadPendingPayouts() {
    // Vendor payouts: show 'approved' ones (vendor has approved, admin needs to schedule/send)
    this.api.getAdminVendorPayouts().subscribe({
      next: (res) => {
        const payouts = (res.results || res).filter((p: any) =>
          p.status === 'approved' || p.status === 'pending_approval'
        );
        this.pendingVendorPayouts.set(payouts);
      },
      error: () => {}
    });

    // Delivery payouts: show 'scheduled' ones (no approval step, ready to send payment)
    this.api.getAdminDeliveryPayouts().subscribe({
      next: (res) => {
        const payouts = (res.results || res).filter((p: any) => p.status === 'scheduled');
        this.pendingDeliveryPayouts.set(payouts);
      },
      error: () => {}
    });
  }

  selectTask(def: TaskDef) {
    this.selectedTask.set(def);
    this.form.task_key = def.key;
    this.form.kwargs = {};
    // Set defaults for known params
    if (def.params.includes('target')) this.form.kwargs['target'] = 'all';
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
    const task = this.selectedTask();
    if (!task) { this.toast.show('Select a task type first.', 'error'); return; }

    // Validate required kwargs
    for (const p of task.params) {
      if (!this.form.kwargs[p]) {
        this.toast.show(`"${p}" is required.`, 'error');
        return;
      }
    }

    const payload: any = {
      task_key: this.form.task_key,
      kwargs: { ...this.form.kwargs } };

    if (this.form.schedule_mode === 'later') {
      if (!this.form.scheduled_time) { this.toast.show('Provide a scheduled datetime.', 'error'); return; }
      payload.scheduled_time = new Date(this.form.scheduled_time).toISOString();
      if (this.repeatSeconds) payload.repeat = this.repeatSeconds;
    }

    this.submitting.set(true);
    this.api.createScheduledTask(payload).subscribe({
      next: (res) => {
        const when = this.form.schedule_mode === 'now' ? 'queued immediately' : `scheduled for ${new Date(payload.scheduled_time).toLocaleString()}`;
        this.toast.show(`"${task.label}" ${when}.`, 'success');
        this.submitting.set(false);
        this.clearSelection();
        setTimeout(() => this.loadJobs(), 1000);
      },
      error: (err) => {
        const msg = err.error?.error || 'Failed to schedule task.';
        this.toast.show(msg, 'error');
        this.submitting.set(false);
      }
    });
  }

  cancel(jobId: string) {
    if (!confirm('Cancel this scheduled job?')) return;
    this.cancellingId.set(jobId);
    this.api.cancelScheduledTask(jobId).subscribe({
      next: () => {
        this.toast.show('Job cancelled.', 'success');
        this.cancellingId.set(null);
        this.jobs.update(list => list.filter(j => j.id !== jobId));
      },
      error: () => {
        this.toast.show('Failed to cancel job.', 'error');
        this.cancellingId.set(null);
      }
    });
  }

  categoryLabel(cat: string): string {
    const m: Record<string, string> = { payouts: 'Payouts', reports: 'Reports', notifications: 'Notifications' };
    return m[cat] || cat;
  }

  categoryIcon(cat: string): string {
    const m: Record<string, string> = { payouts: 'payments', reports: 'bar_chart', notifications: 'campaign' };
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
      canceled: 'status-failed'
    };
    return m[s] || 'status-queued';
  }

  formatKwargs(kwargs: Record<string, any>): string {
    return Object.entries(kwargs).map(([k, v]) => `${k}: ${v}`).join(' · ') || '—';
  }

  tasksByCategory(cat: string): TaskDef[] {
    return this.taskDefs().filter(t => t.category === cat);
  }

  get categories(): string[] {
    return [...new Set(this.taskDefs().map(t => t.category))];
  }
}


