import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  apiErrorMessage,
  AuthService,
  SessionStore,
  VendorDocument,
  VendorWorkspace,
  VendorWorkspaceApi,
} from '@shared/public-api';
import { timer } from 'rxjs';
@Component({
  selector: 'app-pending-approval',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './pending-approval.component.html',
  styleUrl: './pending-approval.component.scss',
})
export class PendingApprovalComponent implements OnInit {
  private readonly api = inject(VendorWorkspaceApi);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly session = inject(SessionStore);
  private readonly destroy = inject(DestroyRef);
  readonly context = signal<VendorWorkspace | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly actionError = signal('');
  readonly saving = signal(false);
  readonly success = signal('');
  readonly documents = signal<VendorDocument[]>([]);
  readonly docError = signal('');
  readonly documentType = signal('license');
  readonly file = signal<File | null>(null);
  readonly subject = signal('');
  readonly message = signal('');
  readonly details = signal<Record<string, string>>({});
  private initialized = false;
  readonly fields = [
    { key: 'store_name', label: 'Store name' },
    { key: 'phone', label: 'Store phone' },
    { key: 'email', label: 'Business email' },
    { key: 'address', label: 'Pickup address' },
    { key: 'city', label: 'City' },
    { key: 'state', label: 'State' },
    { key: 'postal_code', label: 'Postal code' },
    { key: 'description', label: 'Store description' },
  ];
  readonly documentTypes = [
    { key: 'license', label: 'Business / trade license' },
    { key: 'pan_card', label: 'PAN card' },
    { key: 'gstin_certificate', label: 'GSTIN certificate' },
    { key: 'identity_proof', label: 'Identity proof' },
    { key: 'address_proof', label: 'Address proof' },
    { key: 'cancelled_cheque', label: 'Cancelled cheque' },
    { key: 'fssai_license', label: 'FSSAI license' },
    { key: 'trademark', label: 'Trademark certificate' },
    { key: 'business_registration', label: 'Business registration' },
  ];
  ngOnInit(): void {
    this.refresh();
    this.loadDocuments();
    timer(30000, 30000)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe(() => {
        if (!document.hidden && !this.saving()) this.refresh();
      });
    const visible = () => {
      if (!document.hidden) this.refresh();
    };
    document.addEventListener('visibilitychange', visible);
    this.destroy.onDestroy(() =>
      document.removeEventListener('visibilitychange', visible)
    );
  }
  refresh(): void {
    if (this.loading()) return;
    this.loading.set(true);
    this.api
      .context()
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (context) => {
          this.context.set(context);
          this.session.setVendorStatus(context.vendor.status);
          if (!this.initialized) {
            const vendor = context.vendor;
            this.details.set({
              store_name: vendor.store_name,
              phone: vendor.phone,
              email: vendor.email,
              address: vendor.address,
              city: vendor.city,
              state: vendor.state,
              postal_code: vendor.postal_code,
              description: vendor.description,
            });
            this.initialized = true;
          }
          this.loading.set(false);
          this.error.set('');
          if (context.vendor.status === 'approved')
            void this.router.navigate([
              context.vendor.user_info.force_password_change
                ? '/change-password'
                : '/',
            ]);
        },
        error: (failure) => {
          this.loading.set(false);
          this.error.set(
            apiErrorMessage(failure, 'Approval status could not be checked.')
          );
        },
      });
  }
  updateField(key: string, value: string): void {
    this.details.update((current) => ({ ...current, [key]: value }));
    this.success.set('');
  }
  saveDetails(): void {
    if (this.saving() || !this.context()?.allowed_actions.correct_details)
      return;
    this.saving.set(true);
    this.actionError.set('');
    this.api
      .updateProfile(this.details())
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.success.set(
            'Corrections saved for platform review. Approval status has not been changed.'
          );
          this.refresh();
        },
        error: (failure) => {
          this.saving.set(false);
          this.actionError.set(
            apiErrorMessage(failure, 'Corrections were not saved.')
          );
        },
      });
  }
  loadDocuments(): void {
    this.api
      .documents()
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (documents) => {
          this.documents.set(documents);
          this.docError.set('');
        },
        error: (failure) =>
          this.docError.set(
            apiErrorMessage(failure, 'Document history could not be loaded.')
          ),
      });
  }
  selectFile(event: Event): void {
    this.file.set((event.target as HTMLInputElement).files?.[0] || null);
  }
  upload(): void {
    const file = this.file();
    if (
      !file ||
      this.saving() ||
      !this.context()?.allowed_actions.upload_documents
    )
      return;
    this.saving.set(true);
    this.actionError.set('');
    this.api
      .uploadDocument(file, this.documentType())
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.file.set(null);
          this.success.set('Document uploaded and pending verification.');
          this.loadDocuments();
          this.refresh();
        },
        error: (failure) => {
          this.saving.set(false);
          this.actionError.set(
            apiErrorMessage(failure, 'Document was not uploaded.')
          );
        },
      });
  }
  contact(): void {
    if (this.saving() || !this.subject().trim() || !this.message().trim())
      return;
    this.saving.set(true);
    this.actionError.set('');
    this.api
      .contact(this.subject().trim(), this.message().trim())
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (ticket) => {
          this.saving.set(false);
          this.subject.set('');
          this.message.set('');
          this.success.set(
            'Onboarding support request saved. Reference: ' + ticket.id
          );
        },
        error: (failure) => {
          this.saving.set(false);
          this.actionError.set(
            apiErrorMessage(failure, 'Support request was not saved.')
          );
        },
      });
  }
  logout(): void {
    this.auth.logout();
  }
  statusLabel(status: string): string {
    return status
      .replaceAll('_', ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }
}
