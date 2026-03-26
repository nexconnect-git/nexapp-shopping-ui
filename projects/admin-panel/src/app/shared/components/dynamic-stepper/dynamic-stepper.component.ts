import { Component, EventEmitter, Input, Output, signal, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface StepperField {
  key: string;
  label: string;
  type: 'text' | 'email' | 'tel' | 'number' | 'password' | 'select' | 'textarea' | 'checkbox' | 'time' | 'date';
  placeholder?: string;
  options?: { value: any; label: string }[];
  fullWidth?: boolean;
  optional?: boolean;
  required?: boolean;
  pattern?: RegExp;
  patternMessage?: string;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
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

@Component({
  selector: 'app-dynamic-stepper',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dynamic-stepper.component.html',
  styleUrl: './dynamic-stepper.component.scss'
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

  @Output() submitForm = new EventEmitter<any>();
  @Output() cancel = new EventEmitter<void>();

  step = signal(1);
  model: any = {};
  listStates: Record<string, any> = {};
  errors = signal<Record<string, string>>({});

  ngOnChanges(changes: SimpleChanges) {
    if (changes['config'] && this.config) {
      this.initializeModel();
    }
    if (changes['prefillData'] && this.prefillData) {
      Object.assign(this.model, this.prefillData);
    }
  }

  initializeModel() {
    for (const s of this.config.steps) {
      for (const section of s.sections) {
        if (section.fields) {
          for (const f of section.fields) {
            this.model[f.key] = f.type === 'checkbox' ? false : (f.type === 'number' ? null : '');
            if (f.type === 'select' && f.options?.length) {
                this.model[f.key] = f.options[0].value;
            }
          }
        }
        if (section.list) {
          this.model[section.list.key] = [];
          this.listStates[section.list.key] = this.createEmptyListItem(section.list.fields);
        }
      }
    }
  }

  createEmptyListItem(fields: StepperField[]): any {
    const item: any = {};
    for (const f of fields) {
      item[f.key] = f.type === 'checkbox' ? false : (f.type === 'number' ? null : '');
    }
    return item;
  }

  get totalSteps() {
    return this.config.steps.length + 1; // +1 for the review step generated automatically
  }

  goTo(n: number) {
    if (this.isEditMode || n < this.step() || (n === this.step() + 1 && this.validateCurrentStep())) {
      this.step.set(n);
      this.clearErrors();
    }
  }

  next() {
    if (this.validateCurrentStep()) {
      if (this.step() < this.totalSteps) {
        this.step.update(s => s + 1);
        this.clearErrors();
      }
    }
  }

  prev() {
    if (this.step() > 1) {
      this.step.update(s => s - 1);
      this.clearErrors();
    }
  }

  validateCurrentStep(): boolean {
    if (this.step() === this.totalSteps) return true; // Review step

    const currentStepConfig = this.config.steps[this.step() - 1];
    const newErrors: Record<string, string> = {};

    for (const section of currentStepConfig.sections) {
      if (section.fields) {
        for (const f of section.fields) {
          const val = this.model[f.key];
          
          if (f.required && (val === '' || val === null || val === undefined)) {
            newErrors[f.key] = `${f.label} is required.`;
            continue;
          }

          if (val) {
            if (f.pattern && !f.pattern.test(val)) {
              newErrors[f.key] = f.patternMessage || `Invalid format.`;
            } else if (f.minLength && String(val).length < f.minLength) {
              newErrors[f.key] = `Must be at least ${f.minLength} characters.`;
            } else if (f.maxLength && String(val).length > f.maxLength) {
              newErrors[f.key] = `Cannot exceed ${f.maxLength} characters.`;
            }
          }
        }
      }
    }

    this.errors.set(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  clearErrors() {
    this.errors.set({});
  }

  addListItem(listConfig: StepperList) {
    const item = { ...this.listStates[listConfig.key] };
    
    // Check if at least one field has data
    const hasData = Object.values(item).some(v => v !== '' && v !== null && v !== false);
    if (!hasData) return;

    this.model[listConfig.key].push(item);
    this.listStates[listConfig.key] = this.createEmptyListItem(listConfig.fields);
  }

  removeListItem(listKey: string, index: number) {
    this.model[listKey].splice(index, 1);
  }

  formatListItemSubtitle(item: any, subsetKeys: string[] | undefined): string {
    if (!subsetKeys || subsetKeys.length === 0) return '';
    return subsetKeys.map(k => item[k]).filter(v => !!v).join(', ');
  }

  onSubmitClick() {
    if (this.loading) return;
    this.submitForm.emit(this.model);
  }

  hasCheckboxes(fields?: StepperField[]): boolean {
    if (!fields) return false;
    return fields.some(f => f.type === 'checkbox');
  }

  objectKeys(obj: any) {
    return Object.keys(obj || {});
  }
}
