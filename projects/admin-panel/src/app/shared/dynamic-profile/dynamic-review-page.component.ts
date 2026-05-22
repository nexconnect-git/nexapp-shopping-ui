import { NgFor, NgIf } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { DisplayValuePipe } from './display-value.pipe';
import {
  DynamicReviewConfig,
  ProfileDisplayField,
} from './dynamic-profile.models';

@Component({
  selector: 'nc-dynamic-review-page',
  standalone: true,
  imports: [NgFor, NgIf, DisplayValuePipe],
  templateUrl: './dynamic-review-page.component.html',
  styleUrls: ['./dynamic-review-page.component.scss'],
})
export class DynamicReviewPageComponent {
  @Input({ required: true }) config!: DynamicReviewConfig;

  @Output() back = new EventEmitter<void>();
  @Output() editSection = new EventEmitter<string>();
  @Output() saveDraft = new EventEmitter<void>();
  @Output() submitForApproval = new EventEmitter<void>();

  totalFields(): number {
    return this.config.sections.reduce(
      (total, section) => total + section.fields.length,
      0,
    );
  }

  visibleFields(fields: ProfileDisplayField[]): ProfileDisplayField[] {
    return fields.slice(0, 8);
  }

  hiddenFields(fields: ProfileDisplayField[]): ProfileDisplayField[] {
    return fields.slice(8);
  }

  hiddenFieldCount(fields: ProfileDisplayField[]): number {
    return Math.max(fields.length - 8, 0);
  }

  isWideField(value: unknown): boolean {
    if (Array.isArray(value) || (value && typeof value === 'object'))
      return true;
    return String(value ?? '').length > 70;
  }
}
