import { NgFor, NgIf, NgSwitch, NgSwitchCase } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  inferCountryFromLocation,
  isValidEmail,
  isValidIndianPhone,
  MapLocation,
  MapPickerComponent,
  normalizeIndianPhone,
  sanitizeDigits,
  sanitizeEmail,
} from '@shared/public-api';
import {
  DynamicEditConfig,
  DynamicProfileEntity,
  ProfileFormField,
  ProfileWizardStep,
} from './dynamic-profile.models';

@Component({
  selector: 'nc-dynamic-edit-page',
  standalone: true,
  imports: [
    NgFor,
    NgIf,
    NgSwitch,
    NgSwitchCase,
    FormsModule,
    MapPickerComponent,
  ],
  templateUrl: './dynamic-edit-page.component.html',
  styleUrls: ['./dynamic-edit-page.component.scss'],
})
export class DynamicEditPageComponent implements OnChanges {
  @Input({ required: true }) config!: DynamicEditConfig;
  @Input({ required: true }) entity!: DynamicProfileEntity;
  @Input() initialStepId?: string;
  @Input() submitError = '';
  @Input() fieldErrors: Record<string, string> = {};

  @Output() cancelEdit = new EventEmitter<void>();
  @Output() saveDraft = new EventEmitter<Record<string, unknown>>();
  @Output() submitStep = new EventEmitter<{
    stepId: string;
    value: Record<string, unknown>;
  }>();
  @Output() finalSubmit = new EventEmitter<Record<string, unknown>>();

  formValue: Record<string, unknown> = {};
  activeStepIndex = signal(0);
  localErrors = signal<Record<string, string>>({});
  localSummary = signal('');

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['entity'] && this.entity) {
      this.formValue = { ...this.entity.data };
    }

    if (
      (changes['config'] || changes['initialStepId']) &&
      this.config?.steps?.length
    ) {
      const index = this.config.steps.findIndex(
        (step) => step.id === this.initialStepId,
      );
      this.activeStepIndex.set(index >= 0 ? index : 0);
    }

    if (changes['fieldErrors'] && Object.keys(this.fieldErrors || {}).length) {
      this.goToFirstError(this.fieldErrors);
    }
  }

  get activeStep(): ProfileWizardStep {
    return this.config.steps[this.activeStepIndex()];
  }

  isLastStep(): boolean {
    return this.activeStepIndex() >= this.config.steps.length - 1;
  }

  setValue(key: string, value: unknown): void {
    const field = this.findField(key);
    this.formValue = {
      ...this.formValue,
      [key]: this.normalizeFieldValue(field, value),
    };
    this.clearLocalError(key);
  }

  toggle(key: string): void {
    this.setValue(key, !this.formValue[key]);
  }

  numberValue(key: string, fallback: number): number {
    const value = Number(this.formValue[key]);
    return Number.isFinite(value) ? value : fallback;
  }

  setLocationFromMap(location: MapLocation): void {
    this.formValue = {
      ...this.formValue,
      latitude: location.lat,
      longitude: location.lng,
      address: location.address || this.formValue['address'] || '',
      city: location.city || this.formValue['city'] || '',
      state: location.state || this.formValue['state'] || '',
      postal_code: location.postal_code || this.formValue['postal_code'] || '',
      country: inferCountryFromLocation(location) || 'IN',
    };
  }

  setFile(field: ProfileFormField, event: Event): void {
    const input = event.target as HTMLInputElement;
    this.setValue(field.key, input.files?.[0] || null);
  }

  clearFile(field: ProfileFormField, input: HTMLInputElement): void {
    input.value = '';
    this.setValue(field.key, null);
  }

  fileName(field: ProfileFormField): string {
    const value = this.formValue[field.key];
    return value instanceof File ? value.name : '';
  }

  next(): void {
    const step = this.activeStep;
    if (!this.validateStep(step)) return;
    this.submitStep.emit({ stepId: step.id, value: this.formValue });

    if (this.isLastStep()) {
      if (!this.validateAllSteps()) return;
      this.finalSubmit.emit(this.formValue);
      return;
    }

    this.activeStepIndex.update((i) =>
      Math.min(i + 1, this.config.steps.length - 1),
    );
  }

  previous(): void {
    this.activeStepIndex.update((i) => Math.max(i - 1, 0));
  }

  goTo(index: number): void {
    if (index > this.activeStepIndex() && !this.validateStepsBefore(index)) {
      return;
    }
    this.activeStepIndex.set(index);
  }

  fieldId(field: ProfileFormField): string {
    return `field-${field.key}`;
  }

  submitSaveDraft(): void {
    if (!this.validateAllSteps()) return;
    this.saveDraft.emit(this.formValue);
  }

  fieldError(field: ProfileFormField): string {
    return this.localErrors()[field.key] || this.fieldErrors[field.key] || '';
  }

  hasError(field: ProfileFormField): boolean {
    return !!this.fieldError(field);
  }

  isFormValid(): boolean {
    return Object.keys(this.collectErrors()).length === 0;
  }

  isCurrentStepValid(): boolean {
    return Object.keys(this.collectErrors([this.activeStep])).length === 0;
  }

  blockInvalidNumberKey(event: KeyboardEvent): void {
    if (['e', 'E', '+', '-'].includes(event.key)) event.preventDefault();
  }

  inputMode(field: ProfileFormField): string | null {
    if (field.type === 'tel' || this.isPinField(field.key)) return 'numeric';
    if (field.type === 'number' || field.type === 'currency') return 'decimal';
    return null;
  }

  maxLength(field: ProfileFormField): number | null {
    if (field.type === 'tel') return 10;
    if (this.isPinField(field.key)) return 6;
    return null;
  }

  private validateStep(step: ProfileWizardStep): boolean {
    const errors = this.collectErrors([step]);
    this.localErrors.set(errors);
    this.localSummary.set(
      Object.keys(errors).length ? 'Please fix the highlighted fields.' : ''
    );
    return Object.keys(errors).length === 0;
  }

  private validateAllSteps(): boolean {
    const errors = this.collectErrors();
    this.localErrors.set(errors);
    this.localSummary.set(
      Object.keys(errors).length ? 'Please fix the highlighted fields.' : ''
    );
    if (Object.keys(errors).length) this.goToFirstError(errors);
    return Object.keys(errors).length === 0;
  }

  private validateStepsBefore(index: number): boolean {
    const errors = this.collectErrors(this.config.steps.slice(0, index));
    this.localErrors.set(errors);
    this.localSummary.set(
      Object.keys(errors).length ? 'Please fix the highlighted fields.' : ''
    );
    if (Object.keys(errors).length) this.goToFirstError(errors);
    return Object.keys(errors).length === 0;
  }

  private collectErrors(steps = this.config.steps): Record<string, string> {
    const errors: Record<string, string> = {};
    for (const step of steps) {
      for (const section of step.sections) {
        for (const field of section.fields) {
          const value = this.formValue[field.key];
          const text = String(value ?? '').trim();
          if (field.required && !text) {
            errors[field.key] = `${field.label} is required.`;
            continue;
          }
          if (!text) continue;
          if (field.type === 'email' && !isValidEmail(text))
            errors[field.key] = `Enter a valid ${field.label.toLowerCase()}.`;
          if (field.type === 'tel' && !isValidIndianPhone(text))
            errors[field.key] = 'Enter a valid 10-digit Indian mobile number.';
          if (this.isPinField(field.key) && !/^[1-9]\d{5}$/.test(text))
            errors[field.key] = 'Enter a valid 6-digit PIN code.';
          if (
            (field.type === 'number' || field.type === 'currency') &&
            !Number.isFinite(Number(value))
          )
            errors[field.key] = `${field.label} must be a valid number.`;
        }
      }
    }
    return errors;
  }

  private clearLocalError(key: string): void {
    if (!this.localErrors()[key]) return;
    this.localErrors.update((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
    this.localSummary.set('');
  }

  private goToFirstError(errors: Record<string, string>): void {
    const keys = new Set(Object.keys(errors));
    const index = this.config.steps.findIndex((step) =>
      step.sections.some((section) =>
        section.fields.some((field) => keys.has(field.key))
      )
    );
    if (index >= 0) this.activeStepIndex.set(index);
  }

  private findField(key: string): ProfileFormField | undefined {
    for (const step of this.config.steps) {
      for (const section of step.sections) {
        const field = section.fields.find((item) => item.key === key);
        if (field) return field;
      }
    }
    return undefined;
  }

  private normalizeFieldValue(
    field: ProfileFormField | undefined,
    value: unknown
  ): unknown {
    if (!field) return value;
    if (field.type === 'tel') return normalizeIndianPhone(value);
    if (field.type === 'email') return sanitizeEmail(value);
    if (this.isPinField(field.key)) return sanitizeDigits(value, 6);
    return value;
  }

  private isPinField(key: string): boolean {
    return ['postal_code', 'postalCode', 'pincode', 'pin_code'].includes(key);
  }
}
