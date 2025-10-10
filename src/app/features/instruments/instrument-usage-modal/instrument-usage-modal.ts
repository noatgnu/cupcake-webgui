import { Component, inject, Input, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { ToastService } from '@noatgnu/cupcake-core';
import { InstrumentUsageService } from '@noatgnu/cupcake-macaron';
import type { Instrument, InstrumentDetail, InstrumentUsage } from '@noatgnu/cupcake-macaron';

@Component({
  selector: 'app-instrument-usage-modal',
  imports: [CommonModule, FormsModule],
  templateUrl: './instrument-usage-modal.html',
  styleUrl: './instrument-usage-modal.scss'
})
export class InstrumentUsageModal implements OnInit {
  private activeModal = inject(NgbActiveModal);
  private instrumentUsageService = inject(InstrumentUsageService);
  private toastService = inject(ToastService);

  @Input() instrument!: Instrument | InstrumentDetail;
  @Input() usage?: InstrumentUsage;

  saving = signal(false);
  isEdit = false;

  timeStarted = '';
  timeEnded = '';
  description = '';
  maintenance = false;

  ngOnInit(): void {
    if (this.usage) {
      this.isEdit = true;
      this.timeStarted = this.usage.timeStarted ? this.formatDateTimeLocal(this.usage.timeStarted) : '';
      this.timeEnded = this.usage.timeEnded ? this.formatDateTimeLocal(this.usage.timeEnded) : '';
      this.description = this.usage.description || '';
      this.maintenance = this.usage.maintenance;
    } else {
      const now = new Date();
      this.timeStarted = this.formatDateTimeLocal(now.toISOString());
    }
  }

  formatDateTimeLocal(isoString: string): string {
    const date = new Date(isoString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  save(): void {
    if (!this.timeStarted) {
      this.toastService.error('Start time is required');
      return;
    }

    if (this.timeEnded && new Date(this.timeEnded) <= new Date(this.timeStarted)) {
      this.toastService.error('End time must be after start time');
      return;
    }

    this.saving.set(true);

    if (this.isEdit && this.usage) {
      const updatePayload = {
        timeStarted: this.timeStarted || undefined,
        timeEnded: this.timeEnded || undefined,
        description: this.description.trim() || undefined,
        maintenance: this.maintenance
      };

      this.instrumentUsageService.updateInstrumentUsage(this.usage.id, updatePayload).subscribe({
        next: (updated) => {
          this.toastService.success('Booking updated successfully');
          this.activeModal.close(updated);
        },
        error: (err) => {
          this.toastService.error('Failed to update booking');
          console.error('Error updating instrument usage:', err);
          this.saving.set(false);
        }
      });
    } else {
      const createPayload = {
        instrument: this.instrument.id,
        timeStarted: this.timeStarted || undefined,
        timeEnded: this.timeEnded || undefined,
        description: this.description.trim() || undefined,
        maintenance: this.maintenance
      };

      this.instrumentUsageService.createInstrumentUsage(createPayload).subscribe({
        next: (created) => {
          this.toastService.success('Booking created successfully');
          this.activeModal.close(created);
        },
        error: (err) => {
          this.toastService.error('Failed to create booking');
          console.error('Error creating instrument usage:', err);
          this.saving.set(false);
        }
      });
    }
  }

  cancel(): void {
    this.activeModal.dismiss();
  }
}
