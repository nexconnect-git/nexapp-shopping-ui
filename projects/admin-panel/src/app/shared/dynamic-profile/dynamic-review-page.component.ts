import { NgFor, NgIf } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DisplayValuePipe } from './display-value.pipe';
import {
  DynamicReviewConfig,
  ProfileDisplayField,
} from './dynamic-profile.models';

@Component({
  selector: 'nc-dynamic-review-page',
  standalone: true,
  imports: [NgFor, NgIf, FormsModule, DisplayValuePipe],
  templateUrl: './dynamic-review-page.component.html',
  styleUrls: ['./dynamic-review-page.component.scss'],
})
export class DynamicReviewPageComponent implements OnChanges {
  @Input({ required: true }) config!: DynamicReviewConfig;

  @Output() back = new EventEmitter<void>();
  @Output() editSection = new EventEmitter<string>();
  @Output() saveDraft = new EventEmitter<void>();
  @Output() submitForApproval = new EventEmitter<void>();
  @Output() statusSubmit = new EventEmitter<{
    status: string;
    reason: string;
  }>();

  selectedStatus = 'pending';
  statusReason = '';
  reasonModalOpen = false;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['config']) {
      this.selectedStatus = this.config?.statusValue || 'pending';
      this.statusReason = '';
      this.reasonModalOpen = false;
    }
  }

  submitStatus(): void {
    if (!this.config.statusOptions?.length) {
      this.submitForApproval.emit();
      return;
    }
    if (this.selectedStatus !== 'approved') {
      this.reasonModalOpen = true;
      return;
    }
    this.statusSubmit.emit({ status: this.selectedStatus, reason: '' });
  }

  confirmStatusReason(): void {
    const reason = this.statusReason.trim();
    if (!reason) return;
    this.reasonModalOpen = false;
    this.statusSubmit.emit({ status: this.selectedStatus, reason });
  }

  closeReasonModal(): void {
    this.reasonModalOpen = false;
  }

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
