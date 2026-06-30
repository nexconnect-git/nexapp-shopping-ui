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
      return '#f8fafc';
    if (key.includes('care')) return '#f8fafc';
    if (key.includes('pet')) return '#f8fafc';
    if (key.includes('fruit') || key.includes('fresh'))
      return '#f8fafc';
    return '#f8fafc';
  }
}

