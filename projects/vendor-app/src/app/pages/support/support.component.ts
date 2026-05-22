import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, ToastService } from '@shared/public-api';

@Component({
  selector: 'app-support',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './support.component.html',
  styleUrl: './support.component.scss',
})
export class SupportComponent implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);

  tickets = signal<any[]>([]);
  loading = signal(true);
  creating = signal(false);
  createdMessage = signal('');
  formError = signal('');

  readonly categories = [
    { value: 'other', label: 'General Support' },
    { value: 'billing', label: 'Billing & Payouts' },
    { value: 'technical', label: 'Technical Issue' },
    { value: 'order', label: 'Order Dispute' },
    { value: 'account', label: 'Account Help' },
  ];

  form: any = { subject: '', category: 'other', message: '' };

  ngOnInit() {
    this.loadTickets();
  }

  loadTickets() {
    this.loading.set(true);
    this.api.getSupportTickets().subscribe({
      next: (res) => {
        this.tickets.set(res.results || res);
        this.loading.set(false);
      },
      error: () => {
        this.toast.show('Failed to load tickets.', 'error');
        this.loading.set(false);
      },
    });
  }

  submitTicket() {
    this.createdMessage.set('');
    this.formError.set('');
    if (!this.form.subject.trim() || !this.form.message.trim()) {
      this.formError.set('Please fill out subject and message.');
      return;
    }
    this.creating.set(true);
    const payload = {
      ...this.form,
      subject: this.form.subject.trim(),
      message: this.form.message.trim(),
      category: this.form.category || 'other',
    };
    this.api.createSupportTicket(payload).subscribe({
      next: () => {
        this.createdMessage.set(
          'Support ticket created successfully. Admin replies will appear in conversation history.',
        );
        this.toast.show('Support ticket created successfully.', 'success');
        this.creating.set(false);
        this.form = { subject: '', category: 'other', message: '' };
        this.loadTickets();
      },
      error: (err) => {
        const message =
          this.formatError(err?.error) ||
          'Failed to create ticket. Please try again.';
        this.formError.set(message);
        this.toast.show(message, 'error');
        this.creating.set(false);
      },
    });
  }

  private formatError(error: any): string {
    if (!error) return '';
    if (typeof error === 'string') return error;
    if (error.error || error.detail) return error.error || error.detail;
    return Object.entries(error)
      .map(([field, value]) => {
        const text = Array.isArray(value) ? value.join(' ') : String(value);
        return `${this.fieldLabel(field)}: ${text}`;
      })
      .join(' ');
  }

  private fieldLabel(field: string): string {
    const labels: Record<string, string> = {
      subject: 'Subject',
      message: 'Message',
      category: 'Category',
      priority: 'Priority',
    };
    return labels[field] || field;
  }
}
