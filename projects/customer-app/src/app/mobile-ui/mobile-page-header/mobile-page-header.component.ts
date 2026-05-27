import { Component, Input } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'fd-mobile-page-header',
  standalone: true,
  templateUrl: './mobile-page-header.component.html',
  styleUrls: ['./mobile-page-header.component.scss'],
})
export class MobilePageHeaderComponent {
  @Input() title = '';
  @Input() subtitle = '';
  @Input() icon = '';
  @Input() showBack = true;

  constructor(private router: Router) {}

  back(): void {
    if (history.length > 1) {
      history.back();
      return;
    }
    this.router.navigateByUrl('/');
  }
}
