import { Component, EventEmitter, Input, Output } from '@angular/core';
import { RouterLink } from '@angular/router';

export interface MobileQuickAction {
  id: string;
  label: string;
  icon?: string;
  route?: string;
}

@Component({
  selector: 'fd-mobile-quick-action-grid',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './mobile-quick-action-grid.component.html',
  styleUrls: ['./mobile-quick-action-grid.component.scss'],
})
export class MobileQuickActionGridComponent {
  @Input() actions: MobileQuickAction[] = [];
  @Output() selected = new EventEmitter<string>();
}

