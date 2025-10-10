import { Component, inject, Input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbActiveModal, NgbTypeahead, NgbHighlight } from '@ng-bootstrap/ng-bootstrap';
import { ToastService } from '@noatgnu/cupcake-core';
import { ReagentService, Reagent, StorageObject } from '@noatgnu/cupcake-macaron';
import { ImageUpload } from '../../../shared/components/image-upload/image-upload';
import { BarcodeInput } from '../../../shared/components/barcode-input/barcode-input';
import { Observable } from 'rxjs';
import { debounceTime, map, switchMap } from 'rxjs/operators';

@Component({
  selector: 'app-stored-reagent-create-modal',
  imports: [CommonModule, FormsModule, ImageUpload, BarcodeInput, NgbTypeahead, NgbHighlight],
  templateUrl: './stored-reagent-create-modal.html',
  styleUrl: './stored-reagent-create-modal.scss'
})
export class StoredReagentCreateModal {
  private activeModal = inject(NgbActiveModal);
  private reagentService = inject(ReagentService);
  private toastService = inject(ToastService);

  @Input() storageObject!: StorageObject;

  saving = signal(false);

  reagentName: string | Reagent = '';
  reagentUnit = '';
  quantity = 0;
  notes = '';
  expirationDate = '';
  lowStockThreshold: number | null = null;
  notifyOnLowStock = false;
  shareable = false;
  accessAll = false;
  imageBase64 = '';
  barcode = '';

  search = (text$: Observable<string>) => {
    return text$.pipe(
      debounceTime(200),
      switchMap(term => this.reagentService.getReagents({ search: term, limit: 10 })),
      map(data => data.results)
    );
  };

  formatIngredient = (reagent: Reagent | string) => {
    if (typeof reagent === 'string') {
      return reagent;
    }
    return reagent.name;
  };

  resultFormatter = (reagent: Reagent) => {
    if (typeof reagent === 'string') {
      return reagent;
    }
    return reagent.name;
  };

  onSelectReagent(event: any): void {
    event.preventDefault();
    const reagent = event.item as Reagent;
    this.reagentName = reagent.name;
    this.reagentUnit = reagent.unit || '';
  }

  save(): void {
    const name = typeof this.reagentName === 'string' ? this.reagentName.trim() : this.reagentName.name;

    if (!name) {
      this.toastService.error('Please enter a reagent name');
      return;
    }

    if (!this.reagentUnit.trim()) {
      this.toastService.error('Please select a unit');
      return;
    }

    if (this.quantity <= 0) {
      this.toastService.error('Quantity must be greater than 0');
      return;
    }

    this.saving.set(true);

    this.reagentService.getReagents({
      name: name,
      unit: this.reagentUnit.trim(),
      limit: 1
    }).pipe(
      switchMap(response => {
        if (response.results.length > 0) {
          const existingReagent = response.results[0];
          return this.createStoredReagent(existingReagent.id);
        } else {
          return this.reagentService.createReagent({
            name: name,
            unit: this.reagentUnit.trim()
          }).pipe(
            switchMap(newReagent => this.createStoredReagent(newReagent.id))
          );
        }
      })
    ).subscribe({
      next: () => {
        this.toastService.success('Stored reagent created successfully');
        this.activeModal.close(true);
      },
      error: (err) => {
        this.toastService.error('Failed to create stored reagent');
        console.error('Error creating stored reagent:', err);
        this.saving.set(false);
      }
    });
  }

  private createStoredReagent(reagentId: number) {
    const payload: any = {
      reagent: reagentId,
      storageObject: this.storageObject.id,
      quantity: this.quantity,
      shareable: this.shareable,
      accessAll: this.accessAll,
      notifyOnLowStock: this.notifyOnLowStock
    };

    if (this.notes.trim()) {
      payload.notes = this.notes.trim();
    }

    if (this.expirationDate) {
      payload.expirationDate = this.expirationDate;
    }

    if (this.lowStockThreshold !== null && this.lowStockThreshold > 0) {
      payload.lowStockThreshold = this.lowStockThreshold;
    }

    if (this.imageBase64) {
      payload.pngBase64 = this.imageBase64;
    }

    if (this.barcode.trim()) {
      payload.barcode = this.barcode.trim();
    }

    return this.reagentService.createStoredReagent(payload);
  }

  cancel(): void {
    this.activeModal.dismiss();
  }

  onImageChange(base64: string): void {
    this.imageBase64 = base64;
  }

  onImageCleared(): void {
    this.imageBase64 = '';
  }
}
