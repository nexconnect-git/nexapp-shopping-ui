import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { ApiService, AuthService } from '@shared/public-api';

@Component({
  selector: 'app-order-issue',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './order-issue.component.html',
  styleUrl: './order-issue.component.scss' })
export class OrderIssueComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  orderId = '';
  orderNumber = signal('');
  step = signal<'select' | 'describe' | 'chat'>('select');

  selectedType = signal('');
  description = '';
  submitting = signal(false);
  error = signal('');

  issue = signal<any>(null);
  newMessage = '';
  sending = signal(false);
  private ws: WebSocket | null = null;

  readonly issueTypes = [
    { value: 'return',   icon: 'undo',          label: 'Return Item',        desc: 'Want to return one or more items' },
    { value: 'refund',   icon: 'payments',       label: 'Request Refund',     desc: 'Paid but didn\'t receive expected value' },
    { value: 'damage',   icon: 'broken_image',   label: 'Damaged Item',       desc: 'Item arrived broken or damaged' },
    { value: 'mismatch', icon: 'compare_arrows', label: 'Wrong Item Received', desc: 'Got something different from what you ordered' },
  ];

  ngOnInit() {
    // Route /issue/:issueId — viewing existing issue, no orderId in URL
    const issueId = this.route.snapshot.paramMap.get('issueId');
    if (issueId) {
      this.loadExistingIssue(issueId);
      return;
    }
    // Route /order/:id/issue — raising new issue
    this.orderId = this.route.snapshot.paramMap.get('id')!;
    this.api.getOrder(this.orderId).subscribe({
      next: (o) => this.orderNumber.set(o.order_number),
      error: () => {}
    });
  }

  ngOnDestroy() {
    this.closeWebSocket();
  }

  closeWebSocket() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  connectWebSocket(issueId: string) {
    this.closeWebSocket();
    const token = this.auth.getToken() || '';
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/issues/${issueId}/?token=${token}`;
    this.ws = new WebSocket(wsUrl);

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'chat_message') {
        const msg = data.message;
        this.issue.update(iss => {
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

  loadExistingIssue(issueId: string) {
    this.api.getMyIssue(issueId).subscribe({
      next: (iss) => {
        this.issue.set(iss);
        this.orderNumber.set(iss.order_number);
        this.step.set('chat');
        this.connectWebSocket(iss.id);
      },
      error: () => this.router.navigate(['/profile/orders'])
    });
  }

  selectType(type: string) {
    this.selectedType.set(type);
    this.step.set('describe');
  }

  back() {
    if (this.step() === 'describe') { this.step.set('select'); return; }
    window.history.back();
  }

  submit() {
    if (!this.description.trim()) { this.error.set('Please describe your issue.'); return; }
    this.submitting.set(true);
    this.error.set('');
    this.api.createIssue({
      order: this.orderId,
      issue_type: this.selectedType(),
      description: this.description.trim() }).subscribe({
      next: (iss) => {
        this.issue.set(iss);
        this.step.set('chat');
        this.submitting.set(false);
        this.connectWebSocket(iss.id);
      },
      error: (err) => {
        this.error.set(err.error?.error || 'Failed to submit. Please try again.');
        this.submitting.set(false);
      }
    });
  }

  sendMessage() {
    const text = this.newMessage.trim();
    if (!text || this.sending()) return;
    this.sending.set(true);
    this.api.sendIssueMessage(this.issue().id, text).subscribe({
      next: (msg) => {
        this.issue.update(iss => {
          if (!iss || !iss.messages) return iss;
          if (iss.messages.find((m: any) => m.id === msg.id)) return iss;
          return { ...iss, messages: [...iss.messages, msg] };
        });
        this.newMessage = '';
        this.sending.set(false);
      },
      error: () => this.sending.set(false)
    });
  }

  typeLabel(type: string): string {
    return this.issueTypes.find(t => t.value === type)?.label ?? type;
  }

  typeIcon(type: string): string {
    return this.issueTypes.find(t => t.value === type)?.icon ?? 'help_outline';
  }

  statusColor(s: string): string {
    const map: Record<string, string> = {
      open: '#f97316', in_review: '#3b82f6', resolved: '#10b981',
      rejected: '#ef4444', refund_initiated: '#8b5cf6' };
    return map[s] ?? '#888';
  }
}


