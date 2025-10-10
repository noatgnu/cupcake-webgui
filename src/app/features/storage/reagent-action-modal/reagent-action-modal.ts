import { Component, inject, Input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { ToastService } from '@noatgnu/cupcake-core';
import { ReagentActionService, ActionType } from '@noatgnu/cupcake-macaron';
import type { StoredReagent } from '@noatgnu/cupcake-macaron';

@Component({
  selector: 'app-reagent-action-modal',
  imports: [CommonModule, FormsModule],
  templateUrl: './reagent-action-modal.html',
  styleUrl: './reagent-action-modal.scss'
})
export class ReagentActionModal {
  private activeModal = inject(NgbActiveModal);
  private reagentActionService = inject(ReagentActionService);
  private toastService = inject(ToastService);

  @Input() storedReagent!: StoredReagent;
  @Input() actionType!: ActionType;

  saving = signal(false);
  quantity = 0;
  notes = '';

  readonly ActionType = ActionType;

  getTitle(): string {
    return this.actionType === ActionType.ADD ? 'Add Quantity' : 'Reserve Quantity';
  }

  getIcon(): string {
    return this.actionType === ActionType.ADD ? 'bi-plus-circle' : 'bi-dash-circle';
  }

  getButtonClass(): string {
    return this.actionType === ActionType.ADD ? 'btn-primary' : 'btn-danger';
  }

  save(): void {
    if (this.quantity <= 0) {
      this.toastService.error('Quantity must be greater than 0');
      return;
    }

    this.saving.set(true);

    const payload: any = {
      reagent: this.storedReagent.reagent,
      actionType: this.actionType,
      quantity: this.quantity
    };

    if (this.notes.trim()) {
      payload.notes = this.notes.trim();
    }

    this.reagentActionService.createReagentAction(payload).subscribe({
      next: () => {
        const action = this.actionType === ActionType.ADD ? 'added' : 'reserved';
        this.toastService.success(`Quantity ${action} successfully`);
        this.activeModal.close(true);
      },
      error: (err) => {
        this.toastService.error('Failed to save reagent action');
        console.error('Error creating reagent action:', err);
        this.saving.set(false);
      }
    });
  }

  cancel(): void {
    this.activeModal.dismiss();
  }
}
