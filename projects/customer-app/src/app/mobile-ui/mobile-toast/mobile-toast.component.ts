import { Component, Input } from '@angular/core';

@Component({
  selector: 'fd-mobile-toast',
  standalone: true,
  templateUrl: './mobile-toast.component.html',
  styleUrls: ['./mobile-toast.component.scss'],
})
export class MobileToastComponent {
  @Input() message = '';
}
