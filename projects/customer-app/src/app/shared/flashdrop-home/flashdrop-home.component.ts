import { DecimalPipe, NgFor, NgIf } from '@angular/common';
import { Component, EventEmitter, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FlashProduct, FlashStore } from './flashdrop-home.models';
import { FlashdropHomeService } from './flashdrop-home.service';

@Component({
  selector: 'nc-flashdrop-home',
  standalone: true,
  imports: [NgFor, NgIf, FormsModule, DecimalPipe],
  templateUrl: './flashdrop-home.component.html',
  styleUrls: ['./flashdrop-home.component.scss'],
})
export class FlashdropHomeComponent {
  @Output() storeSelected = new EventEmitter<FlashStore>();
  @Output() productSelected = new EventEmitter<FlashProduct>();
  @Output() cartRequested = new EventEmitter<void>();
  @Output() searchRequested = new EventEmitter<string>();
  @Output() locationRequested = new EventEmitter<void>();

  readonly tabs = [
    { id: 'home', label: 'Home', icon: '⌂' },
    { id: 'search', label: 'Search', icon: '⌕' },
    { id: 'categories', label: 'Categories', icon: '⋯' },
    { id: 'cart', label: 'Cart', icon: '🛒' },
    { id: 'orders', label: 'Orders', icon: '▤' },
    { id: 'account', label: 'Account', icon: '♡' },
  ] as const;

  constructor(public home: FlashdropHomeService) {}

  selectStore(store: FlashStore): void {
    this.home.openStore(store);
    this.storeSelected.emit(store);
  }

  openProduct(product: FlashProduct): void {
    this.home.openProduct(product);
  }

  addProduct(product: FlashProduct): void {
    this.home.addToCart(product);
    this.productSelected.emit(product);
  }

  tabClick(tab: (typeof this.tabs)[number]['id']): void {
    this.home.navigateTab(tab);
    if (tab === 'cart') this.cartRequested.emit();
  }

  onSearch(query: string): void {
    this.home.searchQuery.set(query);
    this.searchRequested.emit(query);
  }

  submitSearch(): void {
    this.home.submitSearch();
    this.searchRequested.emit(this.home.searchQuery());
  }

  openLocation(): void {
    this.home.openLocation();
    this.locationRequested.emit();
  }
}
