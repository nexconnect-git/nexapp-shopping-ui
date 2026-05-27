import { Component, Input } from '@angular/core';

@Component({
  selector: 'fd-mobile-stepper',
  standalone: true,
  templateUrl: './mobile-stepper.component.html',
  styleUrls: ['./mobile-stepper.component.scss'],
})
export class MobileStepperComponent {
  @Input() steps: Array<{ id: number | string; title: string; sub?: string }> = [];
  @Input() active: number | string = 1;
}
