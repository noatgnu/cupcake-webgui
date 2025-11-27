import { Component, inject, input, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { ServiceTierService } from '@noatgnu/cupcake-salted-caramel';
import type { ServiceTier, ServiceTierCreateRequest, ServiceTierUpdateRequest } from '@noatgnu/cupcake-salted-caramel';
import { ToastService } from '@noatgnu/cupcake-core';

@Component({
  selector: 'app-service-tier-form-modal',
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './service-tier-form-modal.html',
  styleUrl: './service-tier-form-modal.scss'
})
export class ServiceTierFormModal implements OnInit {
  activeModal = inject(NgbActiveModal);
  private serviceTierService = inject(ServiceTierService);
  private toastService = inject(ToastService);
  private fb = inject(FormBuilder);

  tierId = input<number>();
  tier = signal<ServiceTier | null>(null);
  loading = signal(true);
  submitting = signal(false);
  form!: FormGroup;
  features = signal<string[]>([]);
  newFeature = signal('');

  ngOnInit(): void {
    this.initForm();
    if (this.tierId()) {
      this.loadTier();
    } else {
      this.loading.set(false);
    }
  }

  initForm(): void {
    this.form = this.fb.group({
      tierName: ['', [Validators.required, Validators.maxLength(100)]],
      description: [''],
      priorityLevel: [1, [Validators.required, Validators.min(1), Validators.max(100)]],
      maxConcurrentBookings: [null, [Validators.min(1)]],
      advanceBookingDays: [30, [Validators.required, Validators.min(0)]],
      baseRateMultiplier: [1.0, [Validators.required, Validators.min(0)]],
      discountPercentage: [0, [Validators.required, Validators.min(0), Validators.max(100)]],
      isActive: [true]
    });
  }

  loadTier(): void {
    this.loading.set(true);
    const id = this.tierId();
    if (!id) return;

    this.serviceTierService.getServiceTier(id).subscribe({
      next: (tier) => {
        this.tier.set(tier);
        this.features.set(tier.features || []);
        this.form.patchValue({
          tierName: tier.tierName,
          description: tier.description,
          priorityLevel: tier.priorityLevel,
          maxConcurrentBookings: tier.maxConcurrentBookings,
          advanceBookingDays: tier.advanceBookingDays,
          baseRateMultiplier: tier.baseRateMultiplier,
          discountPercentage: tier.discountPercentage,
          isActive: tier.isActive
        });
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error loading service tier:', err);
        this.toastService.error('Failed to load service tier');
        this.loading.set(false);
        this.activeModal.dismiss();
      }
    });
  }

  addFeature(): void {
    const feature = this.newFeature().trim();
    if (feature && !this.features().includes(feature)) {
      this.features.update(f => [...f, feature]);
      this.newFeature.set('');
    }
  }

  removeFeature(feature: string): void {
    this.features.update(f => f.filter(item => item !== feature));
  }

  onSubmit(): void {
    if (this.form.invalid) {
      Object.keys(this.form.controls).forEach(key => {
        this.form.get(key)?.markAsTouched();
      });
      return;
    }

    this.submitting.set(true);
    const formValue = this.form.value;
    const data = {
      ...formValue,
      features: this.features()
    };

    const id = this.tierId();
    const observable = id
      ? this.serviceTierService.updateServiceTier(id, data as ServiceTierUpdateRequest)
      : this.serviceTierService.createServiceTier(data as ServiceTierCreateRequest);

    observable.subscribe({
      next: (tier) => {
        this.toastService.success(`Service tier ${id ? 'updated' : 'created'} successfully`);
        this.submitting.set(false);
        this.activeModal.close(tier);
      },
      error: (err) => {
        console.error('Error saving service tier:', err);
        this.toastService.error(`Failed to ${id ? 'update' : 'create'} service tier`);
        this.submitting.set(false);
      }
    });
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
    if (!field || !field.errors) return '';

    if (field.errors['required']) return 'This field is required';
    if (field.errors['min']) return `Minimum value is ${field.errors['min'].min}`;
    if (field.errors['max']) return `Maximum value is ${field.errors['max'].max}`;
    if (field.errors['maxlength']) return `Maximum length is ${field.errors['maxlength'].requiredLength}`;

    return 'Invalid value';
  }
}
