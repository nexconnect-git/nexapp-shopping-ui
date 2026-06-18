import {
  Component,
  EventEmitter,
  inject,
  Input,
  OnChanges,
  Output,
  signal,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable, Subscription } from 'rxjs';
import {
  inferCountryFromLocation,
  MapLocation,
  MapPickerComponent,
  ToastService,
} from '@shared/public-api';

export interface StepperField {
  key: string;
  label: string;
  type:
    | 'text'
    | 'email'
    | 'tel'
    | 'number'
    | 'password'
    | 'select'
    | 'textarea'
    | 'checkbox'
    | 'file'
    | 'time'
    | 'date'
    | 'map';
  placeholder?: string;
  hint?: string;
  options?: { value: any; label: string }[];
  fullWidth?: boolean;
  optional?: boolean;
  required?: boolean;
  defaultValue?: any;
  pattern?: RegExp;
  patternMessage?: string;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  uppercase?: boolean;
  inputMode?: 'text' | 'email' | 'tel' | 'numeric' | 'decimal';
  unique?: boolean;
  accept?: string;
}

export interface UniqueValidationResult {
  unique: boolean;
  message?: string;
  suggestions?: string[];
}

export interface StepperList {
  key: string;
  title: string;
  addLabel: string;
  itemTitleKey: string;
  itemSubtitleKeys?: string[];
  fields: StepperField[];
}

export interface StepperSection {
  title?: string;
  description?: string;
  fields?: StepperField[];
  list?: StepperList;
}

export interface StepperStep {
  label: string;
  title: string;
  subtitle: string;
  sections: StepperSection[];
}

export interface StepperConfig {
  title: string;
  subtitle: string;
  submitLabel: string;
  steps: StepperStep[];
}

interface StepperRailItem {
  number: number;
  label: string;
  review?: boolean;
}

export interface UniqueFieldState {
  checking: boolean;
  unique?: boolean;
  message?: string;
  suggestions: string[];
  value: string;
}

@Component({
  selector: 'app-dynamic-stepper',
  standalone: true,
  imports: [CommonModule, FormsModule, MapPickerComponent],
  templateUrl: './dynamic-stepper.component.html',
  styleUrl: './dynamic-stepper.component.scss',
})
export class DynamicStepperComponent implements OnChanges {
  @Input({ required: true }) config!: StepperConfig;
  @Input() loading = false;
  @Input() serverErrors: Record<string, string> | null = null;
  @Input() success = false;
  @Input() successMessage = 'Submitted successfully!';
  @Input() successSubmessage = 'Redirecting...';
  @Input() prefillData: Record<string, any> | null = null;
  @Input() isEditMode = false;
  @Input() uniqueChecker?: (
    field: StepperField,
    value: string,
    model: any,
  ) => Observable<UniqueValidationResult>;

  @Output() submitForm = new EventEmitter<any>();
  @Output() stepperCancel = new EventEmitter<void>();

  step = signal(1);
  model: any = {};
  listStates: Record<string, any> = {};
  uniqueStates: Record<string, UniqueFieldState> = {};
  errors = signal<Record<string, string>>({});

  private toast = inject(ToastService);
  private uniqueTimers: Record<string, ReturnType<typeof setTimeout>> = {};
  private uniqueSubscriptions: Record<string, Subscription> = {};
  private dismissedServerErrors: Record<string, boolean> = {};

  ngOnChanges(changes: SimpleChanges) {
    if (changes['config'] && this.config) {
      this.initializeModel();
    }
    if (changes['prefillData'] && this.prefillData) {
      Object.assign(this.model, this.prefillData);
    }
    if (
      changes['serverErrors'] &&
      this.serverErrors &&
      Object.keys(this.serverErrors).length > 0
    ) {
      this.dismissedServerErrors = {};
      for (const key of Object.keys(this.serverErrors)) {
        this.toast.show(
          `${key}: ${this.formatServerError(this.serverErrors[key])}`,
          'error',
        );
      }
    }
  }

  initializeModel() {
    Object.values(this.uniqueSubscriptions).forEach((subscription) =>
      subscription.unsubscribe(),
    );
    Object.values(this.uniqueTimers).forEach((timer) => clearTimeout(timer));
    this.uniqueStates = {};
    this.uniqueTimers = {};
    this.uniqueSubscriptions = {};
    this.listStates = {};
    this.errors.set({});

    for (const s of this.config.steps) {
      for (const section of s.sections) {
        if (section.fields) {
          for (const f of section.fields) {
            this.model[f.key] =
              f.type === 'checkbox'
                ? false
                : f.type === 'number' || f.type === 'file'
                  ? null
                  : '';
            if (f.type === 'select' && f.options?.length) {
              this.model[f.key] = f.options[0].value;
            }
            if (f.defaultValue !== undefined) {
              this.model[f.key] = f.defaultValue;
            }
          }
        }
        if (section.list) {
          this.model[section.list.key] = [];
          this.listStates[section.list.key] = this.createEmptyListItem(
            section.list.fields,
          );
        }
      }
    }
  }

  createEmptyListItem(fields: StepperField[]): any {
    const item: any = {};
    for (const f of fields) {
      item[f.key] =
        f.defaultValue !== undefined
          ? f.defaultValue
          : f.type === 'checkbox'
            ? false
            : f.type === 'number'
              ? null
              : '';
    }
    return item;
  }

  get totalSteps() {
    return this.config.steps.length + 1; // +1 for the review step generated automatically
  }

  get stepItems(): StepperRailItem[] {
    const configuredSteps = this.config.steps.map((s, index) => ({
      number: index + 1,
      label: s.label,
    }));
    return [
      ...configuredSteps,
      { number: this.totalSteps, label: 'Review & Submit', review: true },
    ];
  }

  get currentStepConfig(): StepperStep | null {
    if (this.step() === this.totalSteps) return null;
    return this.config.steps[this.step() - 1] || null;
  }

  get currentStepIndex(): number {
    return Math.min(this.step(), this.totalSteps);
  }

  goTo(n: number) {
    if (
      this.isEditMode ||
      n < this.step() ||
      (n === this.step() + 1 && this.validateCurrentStep())
    ) {
      this.step.set(n);
      this.clearErrors();
    }
  }

  next() {
    if (this.validateCurrentStep()) {
      if (this.step() < this.totalSteps) {
        this.step.update((s) => s + 1);
        this.clearErrors();
      }
    }
  }

  prev() {
    if (this.step() > 1) {
      this.step.update((s) => s - 1);
      this.clearErrors();
    }
  }

  validateCurrentStep(): boolean {
    if (this.step() === this.totalSteps) return this.validateAllSteps(); // Review step

    const currentStepConfig = this.config.steps[this.step() - 1];
    const newErrors: Record<string, string> = {};

    this.validateStepFields(currentStepConfig, newErrors);
    this.errors.set(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  validateAllSteps(): boolean {
    const newErrors: Record<string, string> = {};

    for (const stepConfig of this.config.steps) {
      this.validateStepFields(stepConfig, newErrors);
    }

    this.errors.set(newErrors);
    if (Object.keys(newErrors).length === 0) return true;

    const firstInvalidStep = this.config.steps.findIndex((stepConfig) =>
      this.stepHasError(stepConfig, newErrors),
    );
    if (firstInvalidStep >= 0) {
      this.step.set(firstInvalidStep + 1);
    }
    return false;
  }

  private validateStepFields(
    stepConfig: StepperStep,
    newErrors: Record<string, string>,
  ) {
    for (const section of stepConfig.sections) {
      if (section.fields) {
        for (const f of section.fields) {
          this.validateField(f, this.model[f.key], f.key, newErrors);
        }
      }

      if (section.list) {
        this.validateAddedListItems(section.list, newErrors);
      }
    }

    this.validateUniqueFields(stepConfig, newErrors);
  }

  clearErrors() {
    this.errors.set({});
  }

  addListItem(listConfig: StepperList) {
    const item = { ...this.listStates[listConfig.key] };

    // Check if at least one field has data
    const hasData = Object.values(item).some(
      (v) => v !== '' && v !== null && v !== false,
    );
    if (!hasData) {
      this.errors.update((e) => ({
        ...e,
        [`${listConfig.key}.__list`]: `Add at least one value before clicking ${listConfig.addLabel}.`,
      }));
      return;
    }

    const itemErrors: Record<string, string> = {};
    for (const f of listConfig.fields) {
      this.validateField(
        f,
        item[f.key],
        this.listFieldKey(listConfig.key, f.key),
        itemErrors,
      );
    }
    if (Object.keys(itemErrors).length > 0) {
      this.errors.update((e) => ({ ...e, ...itemErrors }));
      return;
    }

    this.model[listConfig.key].push(item);
    this.listStates[listConfig.key] = this.createEmptyListItem(
      listConfig.fields,
    );
    this.clearListErrors(listConfig.key);
  }

  removeListItem(listKey: string, index: number) {
    this.model[listKey].splice(index, 1);
  }

  formatListItemSubtitle(item: any, subsetKeys: string[] | undefined): string {
    if (!subsetKeys || subsetKeys.length === 0) return '';
    return subsetKeys
      .map((k) => item[k])
      .filter((v) => !!v)
      .join(', ');
  }

  onSubmitClick() {
    if (this.loading) return;
    if (!this.validateAllSteps()) return;
    this.submitForm.emit(this.model);
  }

  fieldError(key: string): string {
    return (
      this.errors()[key] ||
      (this.dismissedServerErrors[key]
        ? ''
        : this.formatServerError(this.serverErrors?.[key]))
    );
  }

  serverErrorEntries(): { key: string; message: string }[] {
    return Object.entries(this.serverErrors || {})
      .filter(([key]) => !this.dismissedServerErrors[key])
      .map(([key, value]) => ({ key, message: this.formatServerError(value) }))
      .filter((item) => !!item.message);
  }

  listFieldKey(listKey: string, fieldKey: string): string {
    return `${listKey}.${fieldKey}`;
  }

  listError(listKey: string): string {
    return this.errors()[`${listKey}.__list`] || '';
  }

  clearFieldError(key: string) {
    this.dismissedServerErrors[key] = true;
    if (!this.errors()[key]) return;
    this.errors.update((errors) => {
      const next = { ...errors };
      delete next[key];
      return next;
    });
  }

  onFieldInput(field: StepperField) {
    this.clearFieldError(field.key);
    if (field.unique) {
      this.scheduleUniqueCheck(field);
    }
  }

  uniqueState(key: string): UniqueFieldState | null {
    return this.uniqueStates[key] || null;
  }

  selectUniqueSuggestion(field: StepperField, suggestion: string) {
    this.model[field.key] = suggestion;
    this.clearFieldError(field.key);
    this.scheduleUniqueCheck(field, 0);
  }

  normalizeField(field: StepperField) {
    const value = this.model[field.key];
    if (typeof value !== 'string') return;
    const normalized = field.uppercase
      ? value.trim().toUpperCase()
      : value.trim();
    this.model[field.key] = normalized;
    if (field.unique) {
      this.scheduleUniqueCheck(field, 0);
    }
  }

  numberValue(key: string, fallback: number): number {
    const value = Number(this.model[key]);
    return Number.isFinite(value) ? value : fallback;
  }

  setLocationFromMap(location: MapLocation, field?: StepperField) {
    const nextModel = {
      ...this.model,
      latitude: location.lat,
      longitude: location.lng,
      address: location.address || this.model.address || '',
      city: location.city || this.model.city || '',
      state: location.state || this.model.state || '',
      postal_code: location.postal_code || this.model.postal_code || '',
      country: inferCountryFromLocation(location) || 'IN',
    };

    if (field?.key && field.key !== 'location') {
      const value = this.formatMapFieldValue(location);
      nextModel[field.key] = field.maxLength
        ? value.slice(0, field.maxLength).trim()
        : value;
    }

    this.model = nextModel;
    this.clearFieldError('latitude');
    this.clearFieldError('longitude');
    this.clearFieldError('location');
    if (field?.key) this.clearFieldError(field.key);
  }

  private formatMapFieldValue(location: MapLocation): string {
    const address = location.address?.trim();
    const city = location.city?.trim();
    const state = location.state?.trim();
    const parts = [address, city, state].filter(
      (part, index, list) =>
        !!part &&
        list.findIndex(
          (candidate) => candidate?.toLowerCase() === part.toLowerCase(),
        ) === index,
    );

    if (parts.length) return parts.join(', ');
    return `Pinned location: ${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`;
  }

  onFileSelected(field: StepperField, event: Event) {
    const input = event.target as HTMLInputElement;
    this.model[field.key] = input.files?.[0] || null;
    this.clearFieldError(field.key);
  }

  clearFile(field: StepperField, input: HTMLInputElement) {
    input.value = '';
    this.model[field.key] = null;
    this.clearFieldError(field.key);
  }

  fileName(key: string): string {
    const value = this.model[key];
    return value instanceof File ? value.name : '';
  }

  reviewValue(field: StepperField): string {
    const value = this.model[field.key];
    if (field.type === 'password') return '********';
    if (field.type === 'checkbox') return value ? 'Yes' : 'No';
    if (field.type === 'file') return value instanceof File ? value.name : '-';
    return value || '-';
  }

  normalizeListField(listKey: string, field: StepperField) {
    const value = this.listStates[listKey]?.[field.key];
    if (typeof value !== 'string') return;
    this.listStates[listKey][field.key] = field.uppercase
      ? value.trim().toUpperCase()
      : value.trim();
  }

  hasCheckboxes(fields?: StepperField[]): boolean {
    if (!fields) return false;
    return fields.some((f) => f.type === 'checkbox');
  }

  objectKeys(obj: any) {
    return Object.keys(obj || {});
  }

  private formatServerError(error: any): string {
    if (!error) return '';
    if (Array.isArray(error)) return error.join(' ');
    if (typeof error === 'object') return Object.values(error).flat().join(' ');
    return String(error);
  }

  private scheduleUniqueCheck(field: StepperField, delay = 450) {
    const key = field.key;
    const value = String(this.model[key] ?? '').trim();

    if (this.uniqueTimers[key]) clearTimeout(this.uniqueTimers[key]);
    if (this.uniqueSubscriptions[key])
      this.uniqueSubscriptions[key].unsubscribe();

    if (!field.unique || !this.uniqueChecker || !value) {
      delete this.uniqueStates[key];
      return;
    }

    const existingState = this.uniqueStates[key];
    if (
      existingState?.value === value &&
      existingState.checking === false &&
      existingState.unique !== undefined
    ) {
      return;
    }

    const localErrors: Record<string, string> = {};
    this.validateField(field, value, key, localErrors);
    if (localErrors[key]) {
      delete this.uniqueStates[key];
      return;
    }

    this.uniqueStates[key] = { checking: true, suggestions: [], value };
    this.uniqueTimers[key] = setTimeout(() => {
      this.uniqueSubscriptions[key] = this.uniqueChecker!(
        field,
        value,
        this.model,
      ).subscribe({
        next: (result) => {
          const currentValue = String(this.model[key] ?? '').trim();
          if (currentValue !== value) return;

          const message = result.message || `${field.label} is already in use.`;
          this.uniqueStates[key] = {
            checking: false,
            unique: result.unique,
            message: result.unique ? '' : message,
            suggestions: result.suggestions || [],
            value,
          };

          if (result.unique) {
            this.clearFieldError(key);
          } else {
            this.errors.update((errors) => ({ ...errors, [key]: message }));
          }
        },
        error: () => {
          const currentValue = String(this.model[key] ?? '').trim();
          if (currentValue !== value) return;

          const message = `Could not validate ${field.label.toLowerCase()} availability. Try again.`;
          this.uniqueStates[key] = {
            checking: false,
            unique: false,
            message,
            suggestions: [],
            value,
          };
          this.errors.update((errors) => ({ ...errors, [key]: message }));
        },
      });
    }, delay);
  }

  private validateUniqueFields(
    stepConfig: StepperStep,
    newErrors: Record<string, string>,
  ) {
    for (const section of stepConfig.sections) {
      for (const field of section.fields || []) {
        if (!field.unique) continue;

        const value = String(this.model[field.key] ?? '').trim();
        if (!value || newErrors[field.key]) continue;

        const state = this.uniqueStates[field.key];
        if (!state || state.value !== value) {
          this.scheduleUniqueCheck(field, 0);
          newErrors[field.key] =
            `Checking ${field.label.toLowerCase()} availability...`;
          continue;
        }

        if (state.checking) {
          newErrors[field.key] =
            `Checking ${field.label.toLowerCase()} availability...`;
          continue;
        }

        if (state.unique === false) {
          newErrors[field.key] =
            state.message || `${field.label} is already in use.`;
        }
      }
    }
  }

  private validateField(
    field: StepperField,
    value: any,
    errorKey: string,
    newErrors: Record<string, string>,
  ) {
    const isEmpty = value === '' || value === null || value === undefined;
    if (field.required && isEmpty) {
      newErrors[errorKey] = `${field.label} is required.`;
      return;
    }
    if (isEmpty) return;

    const stringValue = String(value).trim();

    if (
      field.type === 'email' &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(stringValue)
    ) {
      newErrors[errorKey] = 'Enter a valid email address.';
      return;
    }

    if (field.type === 'tel' && !/^\+?[0-9][0-9\s-]{8,18}$/.test(stringValue)) {
      newErrors[errorKey] = 'Enter a valid phone number.';
      return;
    }

    if (field.pattern && !field.pattern.test(stringValue)) {
      newErrors[errorKey] = field.patternMessage || 'Invalid format.';
      return;
    }

    if (field.minLength && stringValue.length < field.minLength) {
      newErrors[errorKey] = `Must be at least ${field.minLength} characters.`;
      return;
    }

    if (field.maxLength && stringValue.length > field.maxLength) {
      newErrors[errorKey] = `Cannot exceed ${field.maxLength} characters.`;
      return;
    }

    if (field.type === 'number') {
      const numericValue = Number(value);
      if (Number.isNaN(numericValue)) {
        newErrors[errorKey] = `${field.label} must be a number.`;
        return;
      }
      if (field.min !== undefined && numericValue < field.min) {
        newErrors[errorKey] = `Must be at least ${field.min}.`;
        return;
      }
      if (field.max !== undefined && numericValue > field.max) {
        newErrors[errorKey] = `Cannot exceed ${field.max}.`;
      }
    }
  }

  private validateAddedListItems(
    listConfig: StepperList,
    newErrors: Record<string, string>,
  ) {
    const items = this.model[listConfig.key] || [];
    items.forEach((item: any, index: number) => {
      for (const field of listConfig.fields) {
        this.validateField(
          field,
          item[field.key],
          `${listConfig.key}.${index}.${field.key}`,
          newErrors,
        );
      }
    });
  }

  private stepHasError(
    stepConfig: StepperStep,
    errors: Record<string, string>,
  ): boolean {
    const keys = Object.keys(errors);
    return stepConfig.sections.some((section) => {
      const fieldKeys = section.fields?.map((field) => field.key) || [];
      const listKey = section.list?.key;
      return keys.some(
        (key) =>
          fieldKeys.includes(key) ||
          (!!listKey && key.startsWith(`${listKey}.`)),
      );
    });
  }

  private clearListErrors(listKey: string) {
    this.errors.update((errors) => {
      const next = { ...errors };
      for (const key of Object.keys(next)) {
        if (key.startsWith(`${listKey}.`)) delete next[key];
      }
      return next;
    });
  }
}
