import { Component, inject, Input, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { toSignal } from '@angular/core/rxjs-interop';
import { ToastService, AuthService } from '@noatgnu/cupcake-core';
import { ReagentService, StoredReagent, ReagentAlertType, ReagentAlertTypeLabels } from '@noatgnu/cupcake-macaron';
import { ImageUpload } from '../../../shared/components/image-upload/image-upload';
import { BarcodeInput } from '../../../shared/components/barcode-input/barcode-input';

@Component({
  selector: 'app-stored-reagent-edit-modal',
  imports: [CommonModule, FormsModule, ImageUpload, BarcodeInput],
  templateUrl: './stored-reagent-edit-modal.html',
  styleUrl: './stored-reagent-edit-modal.scss'
})
export class StoredReagentEditModal implements OnInit {
  private activeModal = inject(NgbActiveModal);
  private reagentService = inject(ReagentService);
  private toastService = inject(ToastService);
  private authService = inject(AuthService);

  @Input() storedReagent!: StoredReagent;

  saving = signal(false);
  sendingNotification = signal(false);

  currentQuantity = 0;
  molecularWeight: number | null = null;
  notes = '';
  expirationDate = '';
  lowStockThreshold: number | null = null;
  notifyOnLowStock = false;
  shareable = false;
  accessAll = false;
  imageBase64 = '';
  initialImage?: string;
  barcode = '';

  selectedNotificationType: ReagentAlertType = ReagentAlertType.LOW_STOCK;
  readonly ReagentAlertType = ReagentAlertType;
  readonly reagentAlertTypeLabels = ReagentAlertTypeLabels;

  currentUser = toSignal(this.authService.currentUser$);
  isStaffOrAdmin = computed(() => {
    const user = this.currentUser();
    return user?.isStaff || user?.isSuperuser || false;
  });

  ngOnInit(): void {
    this.currentQuantity = this.storedReagent.currentQuantity;
    this.molecularWeight = this.storedReagent.molecularWeight || null;
    this.notes = this.storedReagent.notes || '';
    this.expirationDate = this.storedReagent.expirationDate || '';
    this.lowStockThreshold = this.storedReagent.lowStockThreshold || null;
    this.notifyOnLowStock = this.storedReagent.notifyOnLowStock;
    this.shareable = this.storedReagent.shareable;
    this.accessAll = this.storedReagent.accessAll;
    this.initialImage = this.storedReagent.pngBase64;
    this.barcode = this.storedReagent.barcode || '';
  }

  save(): void {
    this.saving.set(true);
    const payload: any = {
      currentQuantity: this.currentQuantity,
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

    if (this.molecularWeight !== null && this.molecularWeight > 0) {
      payload.molecularWeight = this.molecularWeight;
    } else {
      payload.molecularWeight = null;
    }

    if (this.imageBase64) {
      payload.pngBase64 = this.imageBase64;
    }

    if (this.barcode.trim()) {
      payload.barcode = this.barcode.trim();
    } else {
      payload.barcode = null;
    }

    this.reagentService.updateStoredReagent(this.storedReagent.id, payload).subscribe({
      next: () => {
        this.toastService.success('Stored reagent updated successfully');
        this.activeModal.close(true);
      },
      error: (err) => {
        this.toastService.error('Failed to update stored reagent');
        console.error('Error updating stored reagent:', err);
        this.saving.set(false);
      }
    });
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

  sendTestNotification(): void {
    this.sendingNotification.set(true);
    this.reagentService.sendTestNotification(
      this.storedReagent.id,
      this.selectedNotificationType
    ).subscribe({
      next: (response) => {
        this.toastService.success(response.message);
        this.sendingNotification.set(false);
      },
      error: (err) => {
        this.toastService.error(err.error?.error || 'Failed to send test notification');
        console.error('Error sending test notification:', err);
        this.sendingNotification.set(false);
      }
    });
  }

  getAlertTypes(): ReagentAlertType[] {
    return [
      ReagentAlertType.LOW_STOCK,
      ReagentAlertType.EXPIRED,
      ReagentAlertType.EXPIRING_SOON
    ];
  }
}
