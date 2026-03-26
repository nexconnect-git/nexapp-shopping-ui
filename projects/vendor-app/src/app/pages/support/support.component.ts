import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '@shared/public-api';

@Component({
  selector: 'app-support',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './support.component.html',
  styleUrl: './support.component.scss'
})
export class SupportComponent implements OnInit {
  private api = inject(ApiService);

  tickets = signal<any[]>([]);
  loading = signal(true);
  creating = signal(false);
  
  errorMsg = signal('');
  successMsg = signal('');

  form: any = { subject: '', category: 'general', message: '' };

  ngOnInit() {
    this.loadTickets();
  }

  loadTickets() {
    this.loading.set(true);
    this.errorMsg.set('');
    this.api.getSupportTickets().subscribe({
      next: (res) => {
        this.tickets.set(res.results || res);
        this.loading.set(false);
      },
      error: (err) => {
        this.errorMsg.set('Failed to load tickets.');
        this.loading.set(false);
      }
    });
  }

  submitTicket() {
    if (!this.form.subject.trim() || !this.form.message.trim()) {
      this.errorMsg.set('Please fill out all required fields.');
      return;
    }
    this.creating.set(true);
    this.errorMsg.set('');
    this.successMsg.set('');
    this.api.createSupportTicket(this.form).subscribe({
      next: () => {
        this.successMsg.set('Support ticket created successfully.');
        this.creating.set(false);
        this.form = { subject: '', category: 'general', message: '' };
        this.loadTickets();
      },
      error: (err) => {
        this.errorMsg.set('Failed to create ticket.');
        this.creating.set(false);
      }
    });
  }
}
