import { Injectable, signal, effect } from '@angular/core';

export type ColorPalette = 'orange' | 'purple' | 'blue' | 'green' | 'rose';
export type ThemeMode = 'light' | 'dark' | 'system';

export const PALETTES: { id: ColorPalette; label: string; hex: string }[] = [
  { id: 'orange', label: 'Orange',  hex: '#F97316' },
  { id: 'purple', label: 'Purple',  hex: '#7C3AED' },
  { id: 'blue',   label: 'Blue',    hex: '#3B82F6' },
  { id: 'green',  label: 'Green',   hex: '#22C55E' },
  { id: 'rose',   label: 'Rose',    hex: '#F43F5E' },
];

const STORAGE_THEME   = 'nx_theme';
const STORAGE_PALETTE = 'nx_palette';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private _mode    = signal<ThemeMode>(this._loadMode());
  private _palette = signal<ColorPalette>(this._loadPalette());

  readonly mode    = this._mode.asReadonly();
  readonly palette = this._palette.asReadonly();

  constructor() {
    effect(() => this._applyTheme(this._mode(), this._palette()));
    this._listenSystemPreference();
  }

  setMode(mode: ThemeMode) {
    this._mode.set(mode);
    localStorage.setItem(STORAGE_THEME, mode);
  }

  setPalette(palette: ColorPalette) {
    this._palette.set(palette);
    localStorage.setItem(STORAGE_PALETTE, palette);
  }

  private _applyTheme(mode: ThemeMode, palette: ColorPalette) {
    const html = document.documentElement;
    const isDark =
      mode === 'dark' ||
      (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

    html.setAttribute('data-theme', isDark ? 'dark' : 'light');
    html.setAttribute('data-palette', palette);
  }

  private _listenSystemPreference() {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (this._mode() === 'system') {
        this._applyTheme('system', this._palette());
      }
    });
  }

  private _loadMode(): ThemeMode {
    return (localStorage.getItem(STORAGE_THEME) as ThemeMode) || 'light';
  }

  private _loadPalette(): ColorPalette {
    return (localStorage.getItem(STORAGE_PALETTE) as ColorPalette) || 'orange';
  }
}
