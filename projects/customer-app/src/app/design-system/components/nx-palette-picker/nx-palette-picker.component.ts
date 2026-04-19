import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ThemeService, PALETTES, ColorPalette, ThemeMode } from '../../../core/services/theme.service';

@Component({
  selector: 'nx-palette-picker',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './nx-palette-picker.component.html',
  styleUrl: './nx-palette-picker.component.scss',
})
export class NxPalettePickerComponent {
  theme = inject(ThemeService);
  palettes = PALETTES;

  readonly MODES: { id: ThemeMode; icon: string; label: string }[] = [
    { id: 'light',  icon: 'light_mode',     label: 'Light'  },
    { id: 'dark',   icon: 'dark_mode',       label: 'Dark'   },
    { id: 'system', icon: 'brightness_auto', label: 'System' },
  ];

  selectPalette(id: ColorPalette) { this.theme.setPalette(id); }
  selectMode(mode: ThemeMode) { this.theme.setMode(mode); }
}
