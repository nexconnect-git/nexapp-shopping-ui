import { Component, Input, forwardRef, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'nx-input',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  providers: [{
    provide: NG_VALUE_ACCESSOR,
    useExisting: forwardRef(() => NxInputComponent),
    multi: true,
  }],
  templateUrl: './nx-input.component.html',
  styleUrl: './nx-input.component.scss',
})
export class NxInputComponent implements ControlValueAccessor {
  @Input() label = '';
  @Input() placeholder = '';
  @Input() type = 'text';
  @Input() hint = '';
  @Input() error = '';
  @Input() prefixIcon = '';
  @Input() suffixIcon = '';
  @Input() required = false;

  value = signal('');
  disabled = signal(false);
  showPassword = signal(false);

  private onChange = (_: any) => {};
  private onTouched = () => {};

  get inputType() {
    if (this.type === 'password') return this.showPassword() ? 'text' : 'password';
    return this.type;
  }

  onInput(event: Event) {
    const val = (event.target as HTMLInputElement).value;
    this.value.set(val);
    this.onChange(val);
  }

  onBlur() { this.onTouched(); }

  writeValue(val: any) { this.value.set(val ?? ''); }
  registerOnChange(fn: any) { this.onChange = fn; }
  registerOnTouched(fn: any) { this.onTouched = fn; }
  setDisabledState(d: boolean) { this.disabled.set(d); }
}
