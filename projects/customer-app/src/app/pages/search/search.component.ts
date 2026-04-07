import { Component, inject, signal, OnInit, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {  Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ApiService } from '@shared/public-api';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './search.component.html',
  styleUrl: './search.component.scss'
})
export class SearchComponent implements OnInit, AfterViewInit {
  private api = inject(ApiService);
  private router = inject(Router);
  private sanitizer = inject(DomSanitizer);

  @ViewChild('searchInput') searchInput!: ElementRef<HTMLInputElement>;

  queryValue = '';
  storeResults = signal<any[]>([]);
  itemResults = signal<any[]>([]);
  searching = signal(false);
  pastSearches = signal<string[]>([]);
  popularVendors = signal<any[]>([]);

  private timer: any;

  ngOnInit() {
    this.loadPastSearches();
    this.loadPopular();
  }

  ngAfterViewInit() {
    setTimeout(() => this.searchInput?.nativeElement?.focus(), 100);
  }

  loadPastSearches() {
    try {
      const s = localStorage.getItem('nx_searches');
      if (s) this.pastSearches.set(JSON.parse(s));
    } catch { /* ignore */ }
  }

  loadPopular() {
    this.api.getVendors({}).subscribe({
      next: (res) => this.popularVendors.set((res.results || res).slice(0, 12))
    });
  }

  onSearch() {
    clearTimeout(this.timer);
    if (!this.queryValue.trim()) { this.storeResults.set([]); this.itemResults.set([]); return; }
    this.timer = setTimeout(() => this.doSearch(), 300);
  }

  doSearch() {
    this.searching.set(true);
    forkJoin({
      vendors: this.api.getVendors({ search: this.queryValue }),
      products: this.api.getProducts({ search: this.queryValue }) }).subscribe({
      next: ({ vendors, products }) => {
        const storeList = (vendors.results || vendors).slice(0, 5);
        this.storeResults.set(storeList);

        const storeIds = new Set(storeList.map((v: any) => v.id));
        const productList = (products.results || products).slice(0, 15);
        // Deduplicate vendors already shown in store results
        // Show unique products (one per vendor-product combo)
        this.itemResults.set(productList.filter((p: any) => !storeIds.has(p.vendor)));
        this.searching.set(false);
      },
      error: () => this.searching.set(false) });
  }

  goBack() { window.history.back(); }

  get hasResults() { return this.storeResults().length > 0 || this.itemResults().length > 0; }

  selectVendor(vendorId: string) {
    this.saveSearch(this.queryValue || '');
    this.router.navigate(['/shop', vendorId]);
  }

  selectSearch(q: string) {
    this.queryValue = q;
    this.saveSearch(q);
    this.doSearch();
  }

  showAll() {
    this.saveSearch(this.queryValue);
    this.router.navigate(['/shops'], { queryParams: { search: this.queryValue } });
  }

  saveSearch(q: string) {
    if (!q.trim()) return;
    const list = [q, ...this.pastSearches().filter(s => s !== q)].slice(0, 8);
    this.pastSearches.set(list);
    try { localStorage.setItem('nx_searches', JSON.stringify(list)); } catch { /* ignore */ }
  }

  removeSearch(q: string, e: Event) {
    e.stopPropagation();
    const list = this.pastSearches().filter(s => s !== q);
    this.pastSearches.set(list);
    try { localStorage.setItem('nx_searches', JSON.stringify(list)); } catch { /* ignore */ }
  }

  highlight(text: string): SafeHtml {
    const q = this.queryValue.trim();
    if (!q) return text;
    const escaped = text.replace(/[<>&'"]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;',"'":'&#39;','"':'&quot;'}[c] || c));
    const safeQ = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const html = escaped.replace(new RegExp(`(${safeQ})`, 'gi'), '<strong>$1</strong>');
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }
}
