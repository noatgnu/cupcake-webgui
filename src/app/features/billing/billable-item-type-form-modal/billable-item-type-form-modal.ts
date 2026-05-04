import { ChangeDetectionStrategy, Component, inject, Input, OnInit, signal } from '@angular/core';

import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { ToastService } from '@noatgnu/cupcake-core';
import {
  BillableItemTypeService,
  BillableItemType,
  BillingUnit
} from '@noatgnu/cupcake-salted-caramel';

@Component({
  selector: 'app-billable-item-type-form-modal',
  imports: [ReactiveFormsModule],
  templateUrl: './billable-item-type-form-modal.html',
  styleUrl: './billable-item-type-form-modal.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BillableItemTypeFormModal implements OnInit {
  private activeModal = inject(NgbActiveModal);
  private fb = inject(FormBuilder);
  private billableItemTypeService = inject(BillableItemTypeService);
  private toastService = inject(ToastService);

  @Input() billableItemType?: BillableItemType;

  form!: FormGroup;
  saving = signal(false);
  isEditMode = signal(false);

  readonly billingUnits = Object.values(BillingUnit);

  ngOnInit(): void {
    this.isEditMode.set(!!this.billableItemType);
    this.initForm();
  }

  initForm(): void {
    this.form = this.fb.group({
      name: [this.billableItemType?.name || '', [Validators.required, Validators.maxLength(200)]],
      description: [this.billableItemType?.description || ''],
      contentType: [this.billableItemType?.contentType || null, Validators.required],
      defaultBillingUnit: [this.billableItemType?.defaultBillingUnit || BillingUnit.HOURLY, Validators.required],
      requiresApproval: [this.billableItemType?.requiresApproval ?? false],
      isActive: [this.billableItemType?.isActive ?? true]
    });

    if (this.isEditMode()) {
      this.form.get('contentType')?.disable();
    }
  }

  getBillingUnitDisplay(unit: BillingUnit): string {
    const displays: Record<BillingUnit, string> = {
      [BillingUnit.HOURLY]: 'Hourly',
      [BillingUnit.DAILY]: 'Daily',
      [BillingUnit.USAGE]: 'Usage',
      [BillingUnit.SAMPLE]: 'Sample',
      [BillingUnit.FLAT]: 'Flat Rate',
      [BillingUnit.CUSTOM]: 'Custom'
    };
    return displays[unit] || unit;
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toastService.error('Please fix the validation errors');
      return;
    }

    this.saving.set(true);
    const formValue = this.form.getRawValue();

    if (this.isEditMode() && this.billableItemType) {
      const updateData = {
        name: formValue.name,
        description: formValue.description || undefined,
        defaultBillingUnit: formValue.defaultBillingUnit,
        requiresApproval: formValue.requiresApproval,
        isActive: formValue.isActive
      };

      this.billableItemTypeService.updateBillableItemType(this.billableItemType.id, updateData).subscribe({
        next: () => {
          this.toastService.success('Billable item type updated successfully');
          this.activeModal.close(true);
        },
        error: () => {
          this.toastService.error('Failed to update billable item type');
          this.saving.set(false);
        }
      });
    } else {
      const createData = {
        name: formValue.name,
        description: formValue.description || undefined,
        contentType: formValue.contentType,
        defaultBillingUnit: formValue.defaultBillingUnit,
        requiresApproval: formValue.requiresApproval,
        isActive: formValue.isActive
      };

      this.billableItemTypeService.createBillableItemType(createData).subscribe({
        next: () => {
          this.toastService.success('Billable item type created successfully');
          this.activeModal.close(true);
        },
        error: () => {
          this.toastService.error('Failed to create billable item type');
          this.saving.set(false);
        }
      });
    }
  }

  close(): void {
    this.activeModal.dismiss();
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.form.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  getFieldError(fieldName: string): string {
    const field = this.form.get(fieldName);
    if (field?.errors) {
      if (field.errors['required']) return `${fieldName} is required`;
      if (field.errors['maxlength']) return `${fieldName} is too long`;
    }
    return '';
  }
}
