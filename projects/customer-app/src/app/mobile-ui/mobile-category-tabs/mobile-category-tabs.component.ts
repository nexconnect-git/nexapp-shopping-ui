import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'fd-mobile-category-tabs',
  standalone: true,
  templateUrl: './mobile-category-tabs.component.html',
  styleUrls: ['./mobile-category-tabs.component.scss'],
})
export class MobileCategoryTabsComponent {
  @Input() items: Array<{ label: string; icon?: string; id?: string }> = [];
  @Input() active = '';
  @Output() selected = new EventEmitter<string>();
}
