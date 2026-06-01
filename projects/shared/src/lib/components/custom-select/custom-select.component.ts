import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  Output,
  signal,
} from '@angular/core';

@Component({
  selector: 'fd-custom-select',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './custom-select.component.html',
  styleUrls: ['./custom-select.component.scss'],
})
export class CustomSelectComponent {
  @Input() options: string[] = [];
  @Input() value = '';
  @Input() placeholder = 'Select';
  @Input() icon = 'unfold_more';
  @Input() disabled = false;
  @Input() ariaLabel = 'Select option';

  @Output() valueChange = new EventEmitter<string>();

  readonly open = signal(false);

  constructor(private host: ElementRef<HTMLElement>) {}

  toggle(): void {
    if (this.disabled || !this.options.length) return;
    this.open.update((current) => !current);
  }

  choose(option: string): void {
    if (this.disabled) return;
    this.valueChange.emit(option);
    this.open.set(false);
  }

  label(): string {
    return this.value || this.placeholder;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.open()) return;
    const target = event.target as Node | null;
    if (target && !this.host.nativeElement.contains(target)) {
      this.open.set(false);
    }
  }
}

