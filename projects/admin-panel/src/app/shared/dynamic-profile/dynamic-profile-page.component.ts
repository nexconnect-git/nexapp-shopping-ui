import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  signal,
} from '@angular/core';

import { DisplayValuePipe } from './display-value.pipe';
import {
  AdminDatePipe,
  AdminIconPipe,
  ProfileFieldValuePipe,
} from './profile-display.pipes';
import {
  DynamicProfileConfig,
  ProfileDisplayField,
  ProfileDisplaySection,
  ProfileHeroAction,
} from './dynamic-profile.models';

@Component({
  selector: 'nc-dynamic-profile-page',
  standalone: true,
  imports: [AdminDatePipe, AdminIconPipe, ProfileFieldValuePipe],
  templateUrl: './dynamic-profile-page.component.html',
  styleUrls: ['./dynamic-profile-page.component.scss'],
})
export class DynamicProfilePageComponent implements OnChanges {
  @Input({ required: true }) config!: DynamicProfileConfig;
  @Output() action = new EventEmitter<ProfileHeroAction>();
  @Output() editSection = new EventEmitter<string>();

  selectedSection = signal('all');
  fieldQuery = signal('');
  private readonly displayValue = new DisplayValuePipe();
  private readonly fieldValue = new ProfileFieldValuePipe();

  ngOnChanges() {
    this.selectedSection.set('all');
    this.fieldQuery.set('');
  }

  selectSection(id: string) {
    this.selectedSection.set(id);
    this.fieldQuery.set('');
  }

  get visibleSections(): ProfileDisplaySection[] {
    return (this.config.sections || []).filter(
      (section) =>
        (this.selectedSection() === 'all' ||
          section.id === this.selectedSection()) &&
        (!this.fieldQuery().trim() || this.matchingFields(section).length > 0)
    );
  }

  get contactFields() {
    const fields = (this.config.sections || []).flatMap(
      (section) => section.fields
    );
    return ['Email', 'Phone', 'City'].flatMap((label) => {
      const field = fields.find(
        (item) => item.label === label && !this.isEmpty(item.value)
      );
      return field
        ? [
            {
              ...field,
              icon:
                label === 'Email'
                  ? 'mail_outline'
                  : label === 'Phone'
                  ? 'call'
                  : 'location_on',
            },
          ]
        : [];
    });
  }

  matchingFields(section: ProfileDisplaySection): ProfileDisplayField[] {
    const query = this.fieldQuery().trim().toLowerCase();
    return section.fields.filter(
      (field) =>
        !query ||
        `${field.label} ${this.displayValue.transform(
          field.value
        )} ${this.fieldValue.transform(field)}`
          .toLowerCase()
          .includes(query)
    );
  }

  detailFields(section: ProfileDisplaySection): ProfileDisplayField[] {
    return this.matchingFields(section).filter(
      (field) => !this.isRecordField(field)
    );
  }

  recordFields(section: ProfileDisplaySection): ProfileDisplayField[] {
    return this.matchingFields(section).filter((field) =>
      this.isRecordField(field)
    );
  }

  isRecordField(field: ProfileDisplayField): boolean {
    return /^(User|Store|Partner|Product) ID$|^(Created|Updated|Date Joined|First Name|Last Name)$/.test(
      field.label
    );
  }

  isEmpty(value: unknown): boolean {
    return this.displayValue.transform(value) === '-';
  }

  trackById(
    _: number,
    item: { id?: string; label?: string; title?: string }
  ): string {
    return String(item.id ?? item.label ?? item.title);
  }
}
