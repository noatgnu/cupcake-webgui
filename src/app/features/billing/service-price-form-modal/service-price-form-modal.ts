import { ChangeDetectionStrategy, Component, inject, Input, OnInit, signal } from '@angular/core';

import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { ToastService } from '@noatgnu/cupcake-core';
import {
  ServicePriceService,
  ServicePrice,
  BillingUnit,
  ServiceTierService,
  BillableItemTypeService,
  ServiceTier,
  BillableItemType
} from '@noatgnu/cupcake-salted-caramel';

@Component({
  selector: 'app-service-price-form-modal',
  imports: [ReactiveFormsModule],
  templateUrl: './service-price-form-modal.html',
  styleUrl: './service-price-form-modal.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ServicePriceFormModal implements OnInit {
  private activeModal = inject(NgbActiveModal);
  private fb = inject(FormBuilder);
  private servicePriceService = inject(ServicePriceService);
  private serviceTierService = inject(ServiceTierService);
  private billableItemTypeService = inject(BillableItemTypeService);
  private toastService = inject(ToastService);

  @Input() servicePrice?: ServicePrice;

  form!: FormGroup;
  saving = signal(false);
  isEditMode = signal(false);
  loadingTiers = signal(false);
  loadingItemTypes = signal(false);

  serviceTiers = signal<ServiceTier[]>([]);
  billableItemTypes = signal<BillableItemType[]>([]);

  readonly billingUnits = Object.values(BillingUnit);

  ngOnInit(): void {
    this.isEditMode.set(!!this.servicePrice);
    this.loadServiceTiers();
    this.loadBillableItemTypes();
    this.initForm();
  }

  loadServiceTiers(): void {
    this.loadingTiers.set(true);
    this.serviceTierService.getServiceTiers({ limit: 100 }).subscribe({
      next: (response) => {
        this.serviceTiers.set(response.results);
        this.loadingTiers.set(false);
      },
      error: () => {
        this.toastService.error('Failed to load service tiers');
        this.loadingTiers.set(false);
      }
    });
  }

  loadBillableItemTypes(): void {
    this.loadingItemTypes.set(true);
    this.billableItemTypeService.getBillableItemTypes({ limit: 100 }).subscribe({
      next: (response) => {
        this.billableItemTypes.set(response.results);
        this.loadingItemTypes.set(false);
      },
      error: () => {
        this.toastService.error('Failed to load billable item types');
        this.loadingItemTypes.set(false);
      }
    });
  }

  initForm(): void {
    const today = new Date().toISOString().split('T')[0];

    this.form = this.fb.group({
      billableItemType: [this.servicePrice?.billableItemType || null, Validators.required],
      serviceTier: [this.servicePrice?.serviceTier || null, Validators.required],
      basePrice: [this.servicePrice?.basePrice || 0, [Validators.required, Validators.min(0)]],
      currency: [this.servicePrice?.currency || 'USD', [Validators.required, Validators.maxLength(3)]],
      billingUnit: [this.servicePrice?.billingUnit || BillingUnit.HOURLY, Validators.required],
      minimumChargeUnits: [this.servicePrice?.minimumChargeUnits || 1, [Validators.required, Validators.min(0)]],
      setupFee: [this.servicePrice?.setupFee || 0, [Validators.min(0)]],
      bulkThreshold: [this.servicePrice?.bulkThreshold || null, [Validators.min(1)]],
      bulkDiscountPercentage: [this.servicePrice?.bulkDiscountPercentage || 0, [Validators.min(0), Validators.max(100)]],
      effectiveFrom: [this.servicePrice?.effectiveFrom?.split('T')[0] || today, Validators.required],
      effectiveUntil: [this.servicePrice?.effectiveUntil?.split('T')[0] || ''],
      isActive: [this.servicePrice?.isActive ?? true]
    });

    if (this.isEditMode()) {
      this.form.get('billableItemType')?.disable();
      this.form.get('serviceTier')?.disable();
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

    if (this.isEditMode() && this.servicePrice) {
      const updateData = {
        basePrice: formValue.basePrice,
        currency: formValue.currency,
        billingUnit: formValue.billingUnit,
        minimumChargeUnits: formValue.minimumChargeUnits,
        setupFee: formValue.setupFee || 0,
        bulkThreshold: formValue.bulkThreshold || undefined,
        bulkDiscountPercentage: formValue.bulkDiscountPercentage || 0,
        effectiveFrom: formValue.effectiveFrom,
        effectiveUntil: formValue.effectiveUntil || undefined,
        isActive: formValue.isActive
      };

      this.servicePriceService.updateServicePrice(this.servicePrice.id, updateData).subscribe({
        next: () => {
          this.toastService.success('Service price updated successfully');
          this.activeModal.close(true);
        },
        error: () => {
          this.toastService.error('Failed to update service price');
          this.saving.set(false);
        }
      });
    } else {
      const createData = {
        billableItemType: formValue.billableItemType,
        serviceTier: formValue.serviceTier,
        basePrice: formValue.basePrice,
        currency: formValue.currency,
        billingUnit: formValue.billingUnit,
        minimumChargeUnits: formValue.minimumChargeUnits,
        setupFee: formValue.setupFee || 0,
        bulkThreshold: formValue.bulkThreshold || undefined,
        bulkDiscountPercentage: formValue.bulkDiscountPercentage || 0,
        effectiveFrom: formValue.effectiveFrom,
        effectiveUntil: formValue.effectiveUntil || undefined,
        isActive: formValue.isActive
      };

      this.servicePriceService.createServicePrice(createData).subscribe({
        next: () => {
          this.toastService.success('Service price created successfully');
          this.activeModal.close(true);
        },
        error: () => {
          this.toastService.error('Failed to create service price');
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
      if (field.errors['min']) return `${fieldName} must be at least ${field.errors['min'].min}`;
      if (field.errors['max']) return `${fieldName} must be at most ${field.errors['max'].max}`;
      if (field.errors['maxlength']) return `${fieldName} is too long`;
    }
    return '';
  }
}
