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
  MapLocation,
  MapPickerComponent,
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

  @Output() cancelEdit = new EventEmitter<void>();
  @Output() saveDraft = new EventEmitter<Record<string, unknown>>();
  @Output() submitStep = new EventEmitter<{
    stepId: string;
    value: Record<string, unknown>;
  }>();
  @Output() finalSubmit = new EventEmitter<Record<string, unknown>>();

  formValue: Record<string, unknown> = {};
  activeStepIndex = signal(0);

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
  }

  get activeStep(): ProfileWizardStep {
    return this.config.steps[this.activeStepIndex()];
  }

  isLastStep(): boolean {
    return this.activeStepIndex() >= this.config.steps.length - 1;
  }

  setValue(key: string, value: unknown): void {
    this.formValue = { ...this.formValue, [key]: value };
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
    this.submitStep.emit({ stepId: step.id, value: this.formValue });

    if (this.isLastStep()) {
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
    this.activeStepIndex.set(index);
  }

  fieldId(field: ProfileFormField): string {
    return `field-${field.key}`;
  }
}
