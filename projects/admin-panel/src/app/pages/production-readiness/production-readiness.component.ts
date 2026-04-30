import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

interface ReadinessItem {
  title: string;
  status: 'done' | 'partial' | 'missing';
  area: string;
  detail: string;
  route?: string;
}

@Component({
  selector: 'app-production-readiness',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './production-readiness.component.html',
  styleUrl: './production-readiness.component.scss'
})
export class ProductionReadinessComponent {
  items: ReadinessItem[] = [
    { title: 'Command center dashboard', status: 'done', area: 'Operations', detail: 'Live stats, order flow, action queue, recent orders, top stores.', route: '/' },
    { title: 'Dispatch board', status: 'partial', area: 'Operations', detail: 'Frontend live lanes exist. Backend still needs SLA timestamps, rider capacity, and assignment health metrics.', route: '/dispatch' },
    { title: 'Store and partner onboarding', status: 'partial', area: 'Marketplace', detail: 'Admin pages exist. KYC review can be deepened with document expiry, risk flags, and audit notes.', route: '/vendors' },
    { title: 'Catalog governance', status: 'partial', area: 'Catalog', detail: 'Admin catalog exists. Needs moderation queue, low-stock alerts, image review, and restricted-item rules.', route: '/products' },
    { title: 'Payments and payouts', status: 'partial', area: 'Finance', detail: 'Payments and payouts exist. Needs gateway reconciliation, refund ledger, exports, and immutable audit records.', route: '/reconciliation' },
    { title: 'Customer support exceptions', status: 'partial', area: 'Support', detail: 'Issue queue exists. Needs refund decisions, replacement workflows, SLA timers, and canned responses.', route: '/issues' },
    { title: 'Platform settings', status: 'partial', area: 'Governance', detail: 'Core fee/cancellation settings are wired. Needs zones, taxes, surge rules, feature flags, and city rollout settings.', route: '/platform-settings' },
    { title: 'Audit log', status: 'partial', area: 'Security', detail: 'Backend model/API and admin page exist for key mutations. Extend coverage to every payout, notification, delete, and permission change.', route: '/audit-logs' },
    { title: 'Granular RBAC', status: 'missing', area: 'Security', detail: 'Current role is admin/superuser. Add finance, support, dispatch, catalog, and readonly roles with route/API permissions.' },
    { title: 'Observability', status: 'missing', area: 'Reliability', detail: 'Add frontend error tracking, API latency dashboards, job failure alerts, and WebSocket health monitoring.' },
    { title: 'E2E release checks', status: 'missing', area: 'Quality', detail: 'Add seeded admin E2E tests for login, dispatch, order status, payouts, refunds, settings, and notification send.' },
  ];

  get counts() {
    return {
      done: this.items.filter(i => i.status === 'done').length,
      partial: this.items.filter(i => i.status === 'partial').length,
      missing: this.items.filter(i => i.status === 'missing').length,
    };
  }
}
