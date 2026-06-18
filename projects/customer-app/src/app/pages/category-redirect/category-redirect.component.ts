import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  standalone: true,
  template: '',
})
export class CategoryRedirectComponent {
  constructor(
    private route: ActivatedRoute,
    private router: Router,
  ) {
    const category = String(this.route.snapshot.paramMap.get('id') || '').trim();
    this.router.navigate(['/explore', category || 'all'], {
      queryParams: category && category !== 'all' ? { category } : {},
      replaceUrl: true,
    });
  }
}
