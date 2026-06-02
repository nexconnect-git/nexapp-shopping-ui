import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '@shared/lib/services/api.service';
import { displayOrderId } from '../../shared/display-order-id.pipe';

@Component({
  standalone: true,
  imports: [RouterLink],
  templateUrl: './issues.component.html',
  styleUrls: ['./issues.component.scss'],
})
export class IssuesComponent {
  active = signal('All');
  tabs = ['All', 'Open', 'Resolved', 'Closed'];
  issues = signal<
    Array<{
      id: string;
      title: string;
      order: string;
      date: string;
      status: string;
    }>
  >([]);

  constructor(private api: ApiService) {
    this.api.getMyIssues().subscribe({
      next: (response) =>
        this.issues.set(
          this.unwrap(response).map((issue) => ({
            id: issue.id,
            title: this.typeLabel(issue.issue_type),
            order: `Order #${displayOrderId(issue.order_number || issue.order || '')}`,
            date: issue.created_at
              ? new Date(issue.created_at).toLocaleString()
              : 'Recently',
            status: this.statusLabel(issue.status),
          })),
        ),
      error: () => this.issues.set([]),
    });
  }

  filtered(): Array<{
    id: string;
    title: string;
    order: string;
    date: string;
    status: string;
  }> {
    return this.active() === 'All'
      ? this.issues()
      : this.issues().filter((issue) => issue.status === this.active());
  }

  private unwrap(response: any): any[] {
    if (Array.isArray(response)) return response;
    if (Array.isArray(response?.results)) return response.results;
    return [];
  }

  private typeLabel(value: string): string {
    return (value || 'issue')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  private statusLabel(value: string): string {
    const status = String(value || '').toLowerCase();
    if (status === 'resolved') return 'Resolved';
    if (status === 'closed' || status === 'cancelled') return 'Closed';
    return 'Open';
  }
}
