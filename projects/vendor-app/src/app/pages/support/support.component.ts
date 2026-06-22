import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  VendorApi,
  formatFormErrors,
  parseFormErrors,
  ToastService,
} from '@shared/public-api';

@Component({
  selector: 'app-support',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './support.component.html',
  styleUrl: './support.component.scss',
})
export class SupportComponent implements OnInit {
  private api = inject(VendorApi);
  private toast = inject(ToastService);

  tickets = signal<any[]>([]);
  loading = signal(true);
  creating = signal(false);
  createdMessage = signal('');
  formError = signal('');
  fieldErrors = signal<Record<string, string>>({});

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
    const validationErrors = this.validateForm();
    this.fieldErrors.set(validationErrors);
    if (Object.keys(validationErrors).length) {
      this.formError.set(
        'Please fix the highlighted fields before submitting.'
      );
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
          'Support ticket created successfully. Admin replies will appear in conversation history.'
        );
        this.toast.show('Support ticket created successfully.', 'success');
        this.creating.set(false);
        this.form = { subject: '', category: 'other', message: '' };
        this.loadTickets();
      },
      error: (err) => {
        const parsed = parseFormErrors(err?.error, { description: 'message' });
        this.fieldErrors.set(parsed.fieldErrors);
        const message = formatFormErrors(
          err?.error,
          'Failed to create ticket. Please try again.',
          { description: 'Message' }
        );
        this.formError.set(message);
        this.toast.show(message, 'error');
        this.creating.set(false);
      },
    });
  }

  clearFieldError(field: string): void {
    if (!this.fieldErrors()[field]) return;
    this.fieldErrors.update((current) => {
      const next = { ...current };
      delete next[field];
      return next;
    });
    this.formError.set('');
  }

  fieldError(field: string): string {
    return this.fieldErrors()[field] || '';
  }

  canSubmitTicket(): boolean {
    return (
      !this.creating() &&
      Object.keys(this.validateForm()).length === 0 &&
      Object.keys(this.fieldErrors()).length === 0
    );
  }

  private validateForm(): Record<string, string> {
    const errors: Record<string, string> = {};
    if (!this.form.category) errors['category'] = 'Category is required.';
    if (!this.form.subject.trim()) errors['subject'] = 'Subject is required.';
    if (!this.form.message.trim()) errors['message'] = 'Message is required.';
    return errors;
  }
}
