import { CommonModule } from '@angular/common';
import { Component, effect, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AppCurrencyPipe } from '@shared/public-api';
import { WorkspaceDialogComponent } from '../../components/workspace-dialog.component';
import { WorkspacePagerComponent } from '../../components/workspace-pager.component';
import {
  CreateProductSubmitPayload,
  VendorVariantDraft,
} from './vendor-product-create.models';
import { VendorProductCreateService } from './vendor-product-create.service';
@Component({
  selector: 'nc-vendor-product-create',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    AppCurrencyPipe,
    WorkspaceDialogComponent,
    WorkspacePagerComponent,
  ],
  templateUrl: './vendor-product-create.component.html',
  styleUrl: './vendor-product-create.component.scss',
})
export class VendorProductCreateComponent {
  readonly cancelCreate = output<void>();
  readonly submitted = output<CreateProductSubmitPayload>();
  readonly service = inject(VendorProductCreateService);
  readonly removeDialog = signal(false);
  readonly advancedOpen = signal(false);
  constructor() {
    effect(() => {
      if (this.service.fieldError('comparePrice') || this.service.fieldError('prepTime')) this.advancedOpen.set(true);
    });
  }
  advancedToggled(event: Event): void {
    this.advancedOpen.set((event.target as HTMLDetailsElement).open);
  }
  readonly units = [
    { value: 'g', label: 'Gram (g)' },
    { value: 'kg', label: 'Kilogram (kg)' },
    { value: 'ml', label: 'Millilitre (ml)' },
    { value: 'l', label: 'Litre (l)' },
    { value: 'piece', label: 'Piece' },
    { value: 'pack', label: 'Pack' },
  ];
  updateVariant<K extends keyof VendorVariantDraft>(
    key: K,
    value: VendorVariantDraft[K]
  ): void {
    this.service.updateVariant({ [key]: value } as Partial<VendorVariantDraft>);
  }
  imageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) void this.service.upload(file);
    input.value = '';
  }
  async remove(): Promise<void> {
    await this.service.removeActiveVariant();
    if (!this.service.error()) this.removeDialog.set(false);
  }
  async submit(): Promise<void> {
    try {
      this.submitted.emit(await this.service.submitForApproval());
    } catch {
      /* The service retains row failures and successful submissions. */
    }
  }
}
