import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  NxButtonComponent,
  NxBadgeComponent,
  NxSpinnerComponent,
  NxInputComponent,
  NxCardComponent,
  NxPalettePickerComponent,
} from '../../design-system/index';

@Component({
  selector: 'app-showcase',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NxButtonComponent,
    NxBadgeComponent,
    NxSpinnerComponent,
    NxInputComponent,
    NxCardComponent,
    NxPalettePickerComponent,
  ],
  templateUrl: './showcase.component.html',
  styleUrl: './showcase.component.scss',
})
export class ShowcaseComponent {
  inputValue = '';
  passwordValue = '';
  loadingBtn = false;

  triggerLoading() {
    this.loadingBtn = true;
    setTimeout(() => this.loadingBtn = false, 2000);
  }
}
