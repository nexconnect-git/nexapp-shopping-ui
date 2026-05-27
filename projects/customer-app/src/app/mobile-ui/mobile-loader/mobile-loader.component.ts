import { Component, Input } from '@angular/core';

@Component({
  selector: 'fd-mobile-loader',
  standalone: true,
  templateUrl: './mobile-loader.component.html',
  styleUrls: ['./mobile-loader.component.scss'],
})
export class MobileLoaderComponent {
  @Input() label = 'Loading';
}
