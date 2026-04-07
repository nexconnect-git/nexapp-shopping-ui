import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, ToastService } from '@shared/public-api';

@Component({
  selector: 'app-support',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './support.component.html',
  styleUrl: './support.component.scss'
})
export class SupportComponent implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);

  tickets = signal<any[]>([]);
  loading = signal(true);
  creating = signal(false);
  


  form: any = { subject: '', category: 'general', message: '' };

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
      }
    });
  }

  submitTicket() {
    if (!this.form.subject.trim() || !this.form.message.trim()) {
      this.toast.show('Please fill out all required fields.', 'error');
      return;
    }
    this.creating.set(true);
    this.api.createSupportTicket(this.form).subscribe({
      next: () => {
        this.toast.show('Support ticket created successfully.', 'success');
        this.creating.set(false);
        this.form = { subject: '', category: 'general', message: '' };
        this.loadTickets();
      },
      error: () => {
        this.toast.show('Failed to create ticket.', 'error');
        this.creating.set(false);
      }
    });
  }
}
