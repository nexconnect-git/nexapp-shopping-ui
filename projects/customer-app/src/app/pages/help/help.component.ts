import { Component, OnDestroy, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  ApiService,
  openAuthenticatedWebSocket,
  AuthService as SharedAuthService,
} from '@shared/public-api';
import { AppStateService } from '../../services/app-state.service';
import { CustomerContentConfigService } from '../../services/customer-content-config.service';
import { displayOrderId } from '../../shared/display-order-id.pipe';

@Component({
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './help.component.html',
  styleUrls: ['./help.component.scss'],
})
export class HelpComponent implements OnDestroy {
  issueType = 'wrong_item';
  message = '';
  reply = '';
  rating = signal(5);
  orderId = signal('');
  orderNumber = signal('');
  issue = signal<any>(null);
  submitting = signal(false);
  sending = signal(false);
  private ws: WebSocket | null = null;

  constructor(
    private route: ActivatedRoute,
    private api: ApiService,
    private sharedAuth: SharedAuthService,
    public state: AppStateService,
    public content: CustomerContentConfigService,
  ) {
    const issueId = this.route.snapshot.paramMap.get('issueId');
    if (issueId) {
      this.loadIssue(issueId);
      return;
    }
    const routeOrderId = this.route.snapshot.paramMap.get('id') || '';
    if (routeOrderId) {
      this.orderId.set(routeOrderId);
      this.api.getOrder(routeOrderId).subscribe({
        next: (order) => this.orderNumber.set(displayOrderId(order)),
        error: () => {},
      });
    } else {
      if (this.sharedAuth.isLoggedIn()) {
        this.api.getOrders().subscribe({
          next: (response) => {
            const order = (
              Array.isArray(response) ? response : response.results || []
            )[0];
            this.orderId.set(order?.id || '');
            this.orderNumber.set(order ? displayOrderId(order) : '');
          },
          error: () => {},
        });
      }
    }
  }

  ngOnDestroy(): void {
    this.ws?.close();
  }

  submit(event: Event): void {
    event.preventDefault();
    const order = this.orderId();
    if (!this.sharedAuth.isLoggedIn()) {
      this.state.showToast('Sign in to raise an order support ticket.');
      return;
    }
    if (!order) {
      this.state.showToast('No recent order found for issue creation');
      return;
    }
    if (!this.message.trim()) {
      this.state.showToast('Please describe the issue');
      return;
    }
    this.submitting.set(true);
    this.api
      .createIssue({
        order,
        issue_type: this.issueType,
        description: this.message.trim(),
      })
      .subscribe({
        next: (issue) => {
          this.submitting.set(false);
          this.issue.set(issue);
          this.connectWebSocket(issue.id);
          this.state.showToast('Issue submitted successfully');
        },
        error: (error) => {
          this.submitting.set(false);
          this.state.showToast(
            error?.error?.detail ||
              error?.error?.error ||
              'Could not submit issue',
          );
        },
      });
  }

  sendReply(): void {
    const text = this.reply.trim();
    const issue = this.issue();
    if (!text || !issue?.id || this.sending()) return;
    this.sending.set(true);
    this.api.sendIssueMessage(issue.id, text).subscribe({
      next: (message) => {
        this.issue.update((current) =>
          current
            ? { ...current, messages: [...(current.messages || []), message] }
            : current,
        );
        this.reply = '';
        this.sending.set(false);
      },
      error: () => {
        this.sending.set(false);
        this.state.showToast('Could not send message');
      },
    });
  }

  addPhotos(): void {
    this.state.showToast('Photo upload will be available after issue creation');
  }

  optionLabel(value: string): string {
    const option = this.state
      .issueOptions()
      .find((item) => item.value === value);
    return (
      option?.label ||
      (value || 'Issue')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (char) => char.toUpperCase())
    );
  }

  private loadIssue(issueId: string): void {
    this.api.getMyIssue(issueId).subscribe({
      next: (issue) => {
        this.issue.set(issue);
        this.issueType = issue.issue_type || this.issueType;
        this.message = issue.description || '';
        this.orderId.set(issue.order || '');
        this.orderNumber.set(
          displayOrderId(issue.order_number || issue.order || ''),
        );
        this.connectWebSocket(issue.id);
      },
      error: () => this.state.showToast('Could not load issue'),
    });
  }

  private connectWebSocket(issueId: string): void {
    this.ws?.close();
    this.ws = openAuthenticatedWebSocket(
      `/ws/issues/${issueId}/`,
      this.sharedAuth.getToken(),
    );
    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type !== 'chat_message') return;
      const message = data.message;
      this.issue.update((current) => {
        if (!current) return current;
        const messages = current.messages || [];
        if (messages.some((item: any) => item.id === message.id))
          return current;
        return { ...current, messages: [...messages, message] };
      });
    };
  }
}
