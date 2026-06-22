import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  ApiService,
  apiErrorMessage,
  AuthService,
  parseFormErrors,
  ToastService,
} from '@shared/public-api';
import { DynamicEditPageComponent } from '../../shared/dynamic-profile/dynamic-edit-page.component';
import {
  DynamicEditConfig,
  DynamicProfileEntity,
} from '../../shared/dynamic-profile/dynamic-profile.models';
import { EntityProfileAdapterService } from '../../shared/dynamic-profile/entity-profile-adapter.service';

@Component({
  selector: 'app-dynamic-entity-edit',
  standalone: true,
  imports: [DynamicEditPageComponent],
  templateUrl: './dynamic-entity-edit.component.html',
})
export class DynamicEntityEditComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly adapter = inject(EntityProfileAdapterService);

  readonly loading = signal(true);
  readonly entityDto = signal<unknown>(null);
  readonly entityType = signal('vendor');
  readonly entityId = signal('');
  readonly initialStepId = signal<string | undefined>(undefined);
  readonly saveError = signal('');
  readonly fieldErrors = signal<Record<string, string>>({});

  readonly editConfig = computed<DynamicEditConfig | null>(() => {
    const dto = this.entityDto();
    return dto ? this.adapter.buildEditConfig(this.entityType(), dto) : null;
  });

  readonly entity = computed<DynamicProfileEntity | null>(() => {
    const dto = this.entityDto();
    return dto ? this.adapter.toEntity(this.entityType(), dto) : null;
  });

  ngOnInit(): void {
    this.entityType.set(this.route.snapshot.data['entityType'] || 'vendor');
    this.entityId.set(this.route.snapshot.paramMap.get('id') || '');
    this.initialStepId.set(
      this.route.snapshot.queryParamMap.get('step') || undefined,
    );
    this.load();
  }

  cancel(): void {
    this.router.navigate([this.profileUrl()]);
  }

  saveDraft(formValue: Record<string, unknown>): void {
    this.save(formValue, false);
  }

  finalSubmit(formValue: Record<string, unknown>): void {
    this.save(formValue, true);
  }

  private load(): void {
    this.loading.set(true);
    const type = this.entityType();
    const id = this.entityId();

    const request =
      type === 'vendor'
        ? this.api.getAdminVendor(id)
        : type === 'customer'
          ? this.api.getAdminCustomer(id)
          : type === 'delivery-partner'
            ? this.api.getAdminDeliveryPartner(id)
            : type === 'product'
              ? this.api.getAdminProducts({ id })
              : this.api.getProfile();

    request.subscribe({
      next: (dto: unknown) => {
        const normalized = this.normalizeLoadedDto(dto);
        this.entityDto.set(
          type === 'admin-user' ? this.auth.user() || normalized : normalized,
        );
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.toast.show('Unable to load editor data.', 'error');
        this.router.navigate(['/']);
      },
    });
  }

  private save(
    formValue: Record<string, unknown>,
    navigateToReview: boolean,
  ): void {
    const type = this.entityType();
    const payload = this.adapter.toUpdatePayload(type, formValue);
    const id = this.entityId();
    const request =
      type === 'vendor'
        ? this.api.adminUpdateVendor(id, payload)
        : type === 'customer'
          ? this.api.updateAdminCustomer(id, payload)
          : type === 'delivery-partner'
            ? this.api.updateAdminDeliveryPartner(id, payload)
            : type === 'product'
              ? this.api.updateAdminProduct(id, payload)
              : this.api.updateProfile(payload);

    request.subscribe({
      next: (dto: unknown) => {
        this.saveError.set('');
        this.fieldErrors.set({});
        this.entityDto.set(
          this.normalizeLoadedDto(dto) || {
            ...(this.entityDto() as Record<string, unknown>),
            ...(payload as Record<string, unknown>),
          },
        );
        this.toast.show(
          navigateToReview
            ? 'Changes saved. Review the profile.'
            : 'Draft saved.',
          'success',
        );
        if (navigateToReview) {
          this.router.navigate([this.reviewUrl()]);
        }
      },
      error: (error: unknown) => {
        const parsed = parseFormErrors(error);
        const message = apiErrorMessage(error, 'Unable to save changes.');
        this.fieldErrors.set(parsed.fieldErrors);
        this.saveError.set(message);
        this.toast.show(message, 'error');
      },
    });
  }

  private normalizeLoadedDto(dto: unknown): unknown {
    if (dto && typeof dto === 'object' && 'results' in dto) {
      const results = (dto as { results?: unknown[] }).results || [];
      return results[0] || dto;
    }
    return dto;
  }

  private profileUrl(): string {
    const type = this.entityType();
    if (type === 'vendor') return `/vendors/${this.entityId()}`;
    if (type === 'customer') return `/customers/${this.entityId()}`;
    if (type === 'delivery-partner')
      return `/delivery-partners/${this.entityId()}`;
    if (type === 'product') return `/products`;
    return '/admin/profile';
  }

  private reviewUrl(): string {
    const type = this.entityType();
    if (type === 'vendor') return `/vendors/${this.entityId()}/review`;
    if (type === 'customer') return `/customers/${this.entityId()}/review`;
    if (type === 'delivery-partner')
      return `/delivery-partners/${this.entityId()}/review`;
    if (type === 'product') return `/products`;
    return '/admin/profile/review';
  }
}
