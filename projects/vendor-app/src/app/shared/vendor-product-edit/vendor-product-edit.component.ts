import { NgFor, NgIf } from '@angular/common';
import {
  Component,
  computed,
  EventEmitter,
  inject,
  Output,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService, AppCurrencyPipe, AuthService } from '@shared/public-api';
import {
  ProductEditSaveEvent,
  VendorProductEdit,
} from './vendor-product-edit.models';
import { VendorProductEditService } from './vendor-product-edit.service';

@Component({
  selector: 'nc-vendor-product-edit',
  standalone: true,
  imports: [NgFor, NgIf, FormsModule, RouterLink, AppCurrencyPipe],
  templateUrl: './vendor-product-edit.component.html',
  styleUrls: ['./vendor-product-edit.component.scss'],
})
export class VendorProductEditComponent {
  @Output() cancelEdit = new EventEmitter<void>();
  @Output() saved = new EventEmitter<ProductEditSaveEvent>();
  readonly auth = inject(AuthService);
  readonly api = inject(ApiService);

  readonly readiness = computed(() => this.service.readinessItems());
  readonly readinessScore = computed(() => this.service.readinessScore());

  constructor(public service: VendorProductEditService) {}

  update<K extends keyof VendorProductEdit>(
    key: K,
    value: VendorProductEdit[K],
  ): void {
    this.service.patch({ [key]: value } as Partial<VendorProductEdit>);
  }

  toggle(key: keyof VendorProductEdit): void {
    this.service.toggle(key);
  }

  async save(mode: ProductEditSaveEvent['mode']): Promise<void> {
    try {
      const result = await this.service.save(mode);
      this.saved.emit(result);
    } catch {
      // The service owns the visible error state and toast.
    }
  }

  userInitials(): string {
    const user = this.auth.user();
    const initials =
      `${user?.first_name?.[0] || ''}${user?.last_name?.[0] || ''}`.trim();
    return initials || user?.username?.[0]?.toUpperCase() || 'V';
  }

  displayName(): string {
    const user = this.auth.user();
    const name = `${user?.first_name || ''} ${user?.last_name || ''}`.trim();
    return name || user?.username || 'Vendor';
  }
}
