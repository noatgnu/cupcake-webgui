import { Component, forwardRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
  selector: 'app-duration-input',
  imports: [CommonModule, FormsModule],
  templateUrl: './duration-input.html',
  styleUrl: './duration-input.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => DurationInput),
      multi: true
    }
  ]
})
export class DurationInput implements ControlValueAccessor {
  days = 0;
  hours = 0;
  minutes = 0;
  seconds = 0;

  disabled = false;
  private onChange: (value: number) => void = () => {};
  private onTouched: () => void = () => {};

  writeValue(totalSeconds: number | null): void {
    if (totalSeconds === null || totalSeconds === undefined) {
      this.days = 0;
      this.hours = 0;
      this.minutes = 0;
      this.seconds = 0;
      return;
    }

    this.deserializeDuration(totalSeconds);
  }

  registerOnChange(fn: (value: number) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  onValueChange(): void {
    this.onTouched();
    const totalSeconds = this.serializeDuration();
    this.onChange(totalSeconds);
  }

  private deserializeDuration(totalSeconds: number): void {
    let remaining = totalSeconds;

    this.days = Math.floor(remaining / 86400);
    remaining -= this.days * 86400;

    this.hours = Math.floor(remaining / 3600);
    remaining -= this.hours * 3600;

    this.minutes = Math.floor(remaining / 60);
    remaining -= this.minutes * 60;

    this.seconds = remaining;
  }

  private serializeDuration(): number {
    return (
      (this.days || 0) * 86400 +
      (this.hours || 0) * 3600 +
      (this.minutes || 0) * 60 +
      (this.seconds || 0)
    );
  }
}
