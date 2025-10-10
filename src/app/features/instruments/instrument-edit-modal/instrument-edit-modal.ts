import { Component, inject, Input, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { ToastService } from '@noatgnu/cupcake-core';
import { InstrumentService, Instrument } from '@noatgnu/cupcake-macaron';

@Component({
  selector: 'app-instrument-edit-modal',
  imports: [CommonModule, FormsModule],
  templateUrl: './instrument-edit-modal.html',
  styleUrl: './instrument-edit-modal.scss'
})
export class InstrumentEditModal implements OnInit {
  private activeModal = inject(NgbActiveModal);
  private instrumentService = inject(InstrumentService);
  private toastService = inject(ToastService);

  @Input() instrument?: Instrument;

  saving = signal(false);
  isEdit = false;
  imagePreview = signal<string | null>(null);
  currentImageUrl = signal<string | null>(null);

  instrumentName = '';
  instrumentDescription = '';
  enabled = true;
  acceptsBookings = false;
  allowOverlappingBookings = false;
  maxDaysAheadPreApproval: number | null = null;
  maxDaysWithinUsagePreApproval: number | null = null;
  daysBeforeWarrantyNotification: number | null = null;
  daysBeforeMaintenanceNotification: number | null = null;

  ngOnInit(): void {
    if (this.instrument) {
      this.isEdit = true;
      this.instrumentName = this.instrument.instrumentName;
      this.instrumentDescription = this.instrument.instrumentDescription || '';
      this.enabled = this.instrument.enabled;
      this.acceptsBookings = this.instrument.acceptsBookings;
      this.allowOverlappingBookings = this.instrument.allowOverlappingBookings;
      this.maxDaysAheadPreApproval = this.instrument.maxDaysAheadPreApproval || null;
      this.maxDaysWithinUsagePreApproval = this.instrument.maxDaysWithinUsagePreApproval || null;
      this.daysBeforeWarrantyNotification = this.instrument.daysBeforeWarrantyNotification || null;
      this.daysBeforeMaintenanceNotification = this.instrument.daysBeforeMaintenanceNotification || null;

      if (this.instrument.image) {
        this.currentImageUrl.set(this.instrument.image);
      }
    }
  }

  onImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];

      if (!file.type.startsWith('image/')) {
        this.toastService.error('Please select an image file');
        return;
      }

      const maxSize = 10 * 1024 * 1024;
      if (file.size > maxSize) {
        this.toastService.error('Image size must be less than 10MB');
        return;
      }

      const reader = new FileReader();
      reader.onload = (e: ProgressEvent<FileReader>) => {
        if (e.target?.result) {
          const base64 = e.target.result as string;
          this.imagePreview.set(base64);
          this.currentImageUrl.set(null);
        }
      };
      reader.readAsDataURL(file);
    }
  }

  removeImage(): void {
    this.imagePreview.set(null);
    this.currentImageUrl.set(null);

    const fileInput = document.getElementById('instrumentImage') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  }

  save(): void {
    if (!this.instrumentName.trim()) {
      this.toastService.error('Instrument name is required');
      return;
    }

    this.saving.set(true);

    if (this.isEdit && this.instrument) {
      const updatePayload: {
        instrumentName?: string;
        instrumentDescription?: string;
        image?: string;
        enabled?: boolean;
        acceptsBookings?: boolean;
        allowOverlappingBookings?: boolean;
        maxDaysAheadPreApproval?: number;
        maxDaysWithinUsagePreApproval?: number;
        daysBeforeWarrantyNotification?: number;
        daysBeforeMaintenanceNotification?: number;
      } = {
        instrumentName: this.instrumentName.trim(),
        instrumentDescription: this.instrumentDescription.trim() || undefined,
        enabled: this.enabled,
        acceptsBookings: this.acceptsBookings,
        allowOverlappingBookings: this.allowOverlappingBookings,
        maxDaysAheadPreApproval: this.maxDaysAheadPreApproval || undefined,
        maxDaysWithinUsagePreApproval: this.maxDaysWithinUsagePreApproval || undefined,
        daysBeforeWarrantyNotification: this.daysBeforeWarrantyNotification || undefined,
        daysBeforeMaintenanceNotification: this.daysBeforeMaintenanceNotification || undefined
      };

      const preview = this.imagePreview();
      if (preview) {
        updatePayload.image = preview;
      } else if (!this.currentImageUrl() && this.instrument.image) {
        updatePayload.image = '';
      }

      this.instrumentService.updateInstrument(this.instrument.id, updatePayload).subscribe({
        next: (updated) => {
          this.toastService.success('Instrument updated successfully');
          this.activeModal.close(updated);
        },
        error: (err) => {
          this.toastService.error('Failed to update instrument');
          console.error('Error updating instrument:', err);
          this.saving.set(false);
        }
      });
    } else {
      const createPayload: {
        instrumentName: string;
        instrumentDescription?: string;
        image?: string;
        enabled?: boolean;
        acceptsBookings?: boolean;
        allowOverlappingBookings?: boolean;
        maxDaysAheadPreApproval?: number;
        maxDaysWithinUsagePreApproval?: number;
        daysBeforeWarrantyNotification?: number;
        daysBeforeMaintenanceNotification?: number;
      } = {
        instrumentName: this.instrumentName.trim(),
        instrumentDescription: this.instrumentDescription.trim() || undefined,
        enabled: this.enabled,
        acceptsBookings: this.acceptsBookings,
        allowOverlappingBookings: this.allowOverlappingBookings,
        maxDaysAheadPreApproval: this.maxDaysAheadPreApproval || undefined,
        maxDaysWithinUsagePreApproval: this.maxDaysWithinUsagePreApproval || undefined,
        daysBeforeWarrantyNotification: this.daysBeforeWarrantyNotification || undefined,
        daysBeforeMaintenanceNotification: this.daysBeforeMaintenanceNotification || undefined
      };

      const preview = this.imagePreview();
      if (preview) {
        createPayload.image = preview;
      }

      this.instrumentService.createInstrument(createPayload).subscribe({
        next: (created) => {
          this.toastService.success('Instrument created successfully');
          this.activeModal.close(created);
        },
        error: (err) => {
          this.toastService.error('Failed to create instrument');
          console.error('Error creating instrument:', err);
          this.saving.set(false);
        }
      });
    }
  }

  cancel(): void {
    this.activeModal.dismiss();
  }
}
