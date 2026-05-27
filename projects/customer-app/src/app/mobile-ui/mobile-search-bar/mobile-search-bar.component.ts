import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'fd-mobile-search-bar',
  standalone: true,
  templateUrl: './mobile-search-bar.component.html',
  styleUrls: ['./mobile-search-bar.component.scss'],
})
export class MobileSearchBarComponent {
  @Input() value = '';
  @Input() placeholder = 'Search Nextou';
  @Output() valueChange = new EventEmitter<string>();
  @Output() submitted = new EventEmitter<string>();

  submit(event: Event): void {
    event.preventDefault();
    this.submitted.emit(this.value.trim());
  }
}
