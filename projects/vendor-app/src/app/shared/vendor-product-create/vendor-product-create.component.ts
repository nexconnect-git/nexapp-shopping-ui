import { NgFor, NgIf } from '@angular/common';
import { Component, EventEmitter, inject, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService, AppCurrencyPipe, AuthService } from '@shared/public-api';
import {
  CreateProductSubmitPayload,
  VendorVariantDraft,
} from './vendor-product-create.models';
import { VendorProductCreateService } from './vendor-product-create.service';

@Component({
  selector: 'nc-vendor-product-create',
  standalone: true,
  imports: [NgFor, NgIf, FormsModule, RouterLink, AppCurrencyPipe],
  templateUrl: './vendor-product-create.component.html',
  styleUrls: ['./vendor-product-create.component.scss'],
})
export class VendorProductCreateComponent {
  @Output() cancelCreate = new EventEmitter<void>();
  @Output() submitted = new EventEmitter<CreateProductSubmitPayload>();
  readonly auth = inject(AuthService);
  readonly api = inject(ApiService);

  constructor(public service: VendorProductCreateService) {}

  updateVariant<K extends keyof VendorVariantDraft>(
    key: K,
    value: VendorVariantDraft[K],
  ): void {
    this.service.updateVariant({ [key]: value } as Partial<VendorVariantDraft>);
  }

  toggleVariant(key: keyof VendorVariantDraft): void {
    const active = this.service.activeVariant();
    this.service.updateVariant({
      [key]: !active[key],
    } as Partial<VendorVariantDraft>);
  }

  toggleTag(tag: string): void {
    const active = this.service.activeVariant();
    const tags = active.tags.includes(tag)
      ? active.tags.filter((item) => item !== tag)
      : [...active.tags, tag];

    this.service.updateVariant({ tags });
  }

  async submit(): Promise<void> {
    try {
      const payload = await this.service.submitForApproval();
      this.submitted.emit(payload);
    } catch {
      // The service owns the visible error state and toast.
    }
  }

  stepNumber(): number {
    const step = this.service.activeStep();
    if (step === 'catalog') return 1;
    if (step === 'variant-1' || step === 'variant-2')
      return this.service.activeVariantIndex() + 2;
    return this.service.variants().length + 2;
  }

  userInitials(): string {
    const user = this.auth.user();
    const initials =
      `${user?.first_name?.[0] || ''}${user?.last_name?.[0] || ''}`.trim();
    return initials || user?.username?.[0]?.toUpperCase() || 'V';
  }
}
