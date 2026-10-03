import { Pipe, PipeTransform } from '@angular/core';
import { DisplayValuePipe } from './display-value.pipe';
import { ProfileDisplayField } from './dynamic-profile.models';

@Pipe({ name: 'adminIcon', standalone: true })
export class AdminIconPipe implements PipeTransform {
  private readonly names: Record<string, string> = {
    '🏪': 'storefront', '👤': 'person_outline', '📍': 'location_on',
    '🛡️': 'verified_user', '📄': 'description', '🏦': 'account_balance',
    '🚚': 'local_shipping', '⚙️': 'settings', '🛒': 'shopping_cart',
    '🛵': 'two_wheeler', '📈': 'trending_up', '✏️': 'edit', '🧾': 'fact_check',
    '🔐': 'lock_outline', '✅': 'check_circle_outline', '⭐': 'star_outline',
    '📋': 'dashboard', '📦': 'inventory_2', '🕒': 'schedule', '📌': 'push_pin',
    '☎️': 'phone', 'info_outline': 'info',
  };

  transform(value: string | undefined): string {
    if (!value) return 'info';
    return this.names[value] || (/^[a-z_]+$/.test(value) ? value : 'info');
  }
}

@Pipe({ name: 'adminDate', standalone: true })
export class AdminDatePipe implements PipeTransform {
  transform(value: string | undefined): string {
    if (!value) return 'Not available';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat(undefined, {
      day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit',
    }).format(date);
  }
}

@Pipe({ name: 'profileFieldValue', standalone: true })
export class ProfileFieldValuePipe implements PipeTransform {
  private readonly displayValue = new DisplayValuePipe();
  private readonly date = new AdminDatePipe();

  transform(field: ProfileDisplayField): string {
    const text = this.displayValue.transform(field.value);
    if (text === '-') return 'Not provided';
    if (/^(Created|Updated|Date Joined|Last Login)$/.test(field.label)) return this.date.transform(text);
    if (field.label === 'Country' && /^[A-Z]{2}$/.test(text)) {
      return new Intl.DisplayNames(undefined, { type: 'region' }).of(text) || text;
    }
    if (/^(Status|Role|Tier|Vehicle Type|Account Type|Fulfillment Type|Settlement Cycle)$/.test(field.label)) {
      return text.replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
    }
    return text;
  }
}
