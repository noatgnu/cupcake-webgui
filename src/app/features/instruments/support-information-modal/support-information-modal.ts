import { Component, inject, Input, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { ToastService } from '@noatgnu/cupcake-core';
import { SupportInformationService, InstrumentService, StorageObject, SupportInformation } from '@noatgnu/cupcake-macaron';
import { StorageLocationTypeahead } from '../../../shared/components/storage-location-typeahead/storage-location-typeahead';

@Component({
  selector: 'app-support-information-modal',
  imports: [CommonModule, FormsModule, StorageLocationTypeahead],
  templateUrl: './support-information-modal.html',
  styleUrl: './support-information-modal.scss'
})
export class SupportInformationModal implements OnInit {
  private activeModal = inject(NgbActiveModal);
  private supportInfoService = inject(SupportInformationService);
  private instrumentService = inject(InstrumentService);
  private toastService = inject(ToastService);

  @Input() instrumentId!: number;
  @Input() supportInformation?: SupportInformation;

  saving = signal(false);
  isEdit = false;

  vendorName = '';
  manufacturerName = '';
  serialNumber = '';
  maintenanceFrequencyDays: number | null = null;
  selectedLocation: StorageObject | null = null;
  selectedLocationName = '';
  warrantyStartDate = '';
  warrantyEndDate = '';

  ngOnInit(): void {
    if (this.supportInformation) {
      this.isEdit = true;
      this.vendorName = this.supportInformation.vendorName || '';
      this.manufacturerName = this.supportInformation.manufacturerName || '';
      this.serialNumber = this.supportInformation.serialNumber || '';
      this.maintenanceFrequencyDays = this.supportInformation.maintenanceFrequencyDays || null;
      this.warrantyStartDate = this.supportInformation.warrantyStartDate || '';
      this.warrantyEndDate = this.supportInformation.warrantyEndDate || '';
      this.selectedLocationName = this.supportInformation.locationName || '';
    }
  }

  onLocationSelected(location: StorageObject | null): void {
    this.selectedLocation = location;
  }

  save(): void {
    if (!this.vendorName && !this.manufacturerName && !this.serialNumber) {
      this.toastService.error('Please provide at least one field');
      return;
    }

    this.saving.set(true);
    const payload: any = {
      vendorName: this.vendorName || undefined,
      manufacturerName: this.manufacturerName || undefined,
      serialNumber: this.serialNumber || undefined,
      maintenanceFrequencyDays: this.maintenanceFrequencyDays || undefined,
      location: this.selectedLocation?.id || undefined,
      warrantyStartDate: this.warrantyStartDate || undefined,
      warrantyEndDate: this.warrantyEndDate || undefined
    };

    if (this.isEdit && this.supportInformation) {
      this.supportInfoService.updateSupportInformation(this.supportInformation.id, payload).subscribe({
        next: (updated) => {
          this.toastService.success('Support information updated successfully');
          this.activeModal.close(updated);
        },
        error: (err) => {
          this.toastService.error('Failed to update support information');
          console.error('Error updating support information:', err);
          this.saving.set(false);
        }
      });
    } else {
      this.supportInfoService.createSupportInformation(payload).subscribe({
        next: (created) => {
          this.instrumentService.getInstrument(this.instrumentId).subscribe({
            next: (instrument) => {
              const existingSupportInfo = instrument.supportInformation?.map(si => si.id) || [];
              const updatedSupportInfo = [...existingSupportInfo, created.id];

              this.instrumentService.patchInstrument(this.instrumentId, {
                supportInformation: updatedSupportInfo
              }).subscribe({
                next: () => {
                  this.toastService.success('Support information created successfully');
                  this.activeModal.close(created);
                },
                error: (err) => {
                  this.toastService.error('Failed to link support information to instrument');
                  console.error('Error linking support information:', err);
                  this.saving.set(false);
                }
              });
            },
            error: (err) => {
              this.toastService.error('Failed to fetch instrument details');
              console.error('Error fetching instrument:', err);
              this.saving.set(false);
            }
          });
        },
        error: (err) => {
          this.toastService.error('Failed to create support information');
          console.error('Error creating support information:', err);
          this.saving.set(false);
        }
      });
    }
  }

  cancel(): void {
    this.activeModal.dismiss();
  }
}
