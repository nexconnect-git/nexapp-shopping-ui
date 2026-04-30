import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ApiService } from '@shared/public-api';

@Component({
  selector: 'app-my-issues',
  standalone: true,
  imports: [CommonModule,],
  templateUrl: './my-issues.component.html',
  styleUrl: './my-issues.component.scss' })
export class MyIssuesComponent implements OnInit {
  private api = inject(ApiService);
  private router = inject(Router);

  issues = signal<any[]>([]);
  loading = signal(true);
  openCount = computed(() => this.issues().filter((issue) => ['open', 'in_review', 'refund_initiated'].includes(issue.status)).length);
  resolvedCount = computed(() => this.issues().filter((issue) => issue.status === 'resolved').length);

  readonly typeIcons: Record<string, string> = {
    return: 'undo', refund: 'payments', damage: 'broken_image', mismatch: 'compare_arrows' };

  goBack() { window.history.back(); }

  ngOnInit() {
    this.api.getMyIssues().subscribe({
      next: (res) => { this.issues.set(res.results || res); this.loading.set(false); },
      error: () => this.loading.set(false) });
  }

  open(issue: any) {
    this.router.navigate(['/issue', issue.id]);
  }

  startFromOrders() {
    this.router.navigate(['/orders']);
  }

  statusColor(s: string): string {
    const map: Record<string, string> = {
      open: '#f97316', in_review: '#3b82f6', resolved: '#10b981',
      rejected: '#ef4444', refund_initiated: '#8b5cf6' };
    return map[s] ?? '#888';
  }
}


