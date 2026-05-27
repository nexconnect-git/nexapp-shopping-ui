import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'fd-mobile-bottom-sheet',
  standalone: true,
  templateUrl: './mobile-bottom-sheet.component.html',
  styleUrls: ['./mobile-bottom-sheet.component.scss'],
})
export class MobileBottomSheetComponent {
  @Input() open = false;
  @Input() title = '';
  @Output() closed = new EventEmitter<void>();
}
