import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class CustomerVisualService {
  initialsFor(value: string | null | undefined, fallback = 'NT') {
    const normalized = String(value || fallback)
      .replace(/[_-]+/g, ' ')
      .split(/\s+/)
      .map((word) => word.trim())
      .filter(Boolean);

    if (normalized.length > 1) {
      return normalized
        .slice(0, 2)
        .map((word) => word[0])
        .join('')
        .toUpperCase();
    }

    return (normalized[0] || fallback).slice(0, 2).toUpperCase();
  }

  coverForCategory(category: string | null | undefined) {
    const key = String(category || '').toLowerCase();
    if (key.includes('pharma') || key.includes('health'))
      return 'linear-gradient(135deg,#e6f3ff,#ffffff)';
    if (key.includes('care')) return 'linear-gradient(135deg,#ffeaf2,#eef4ff)';
    if (key.includes('pet')) return 'linear-gradient(135deg,#f4ecff,#fff)';
    if (key.includes('fruit') || key.includes('fresh'))
      return 'linear-gradient(135deg,#e5fff2,#fff7df)';
    return 'linear-gradient(135deg,#eef8ff,#fff)';
  }
}
