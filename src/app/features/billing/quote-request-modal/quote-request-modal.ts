import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { ServiceTierService, ServicePriceService, BillableItemTypeService, BillingUnit } from '@noatgnu/cupcake-salted-caramel';
import type { ServiceTier, ServicePrice, BillableItemType, CostBreakdown } from '@noatgnu/cupcake-salted-caramel';
import { InstrumentService } from '@noatgnu/cupcake-macaron';
import type { Instrument } from '@noatgnu/cupcake-macaron';
import { ToastService, AuthService } from '@noatgnu/cupcake-core';

@Component({
  selector: 'app-quote-request-modal',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './quote-request-modal.html',
  styleUrl: './quote-request-modal.scss'
})
export class QuoteRequestModal implements OnInit {
  activeModal = inject(NgbActiveModal);
  private instrumentService = inject(InstrumentService);
  private serviceTierService = inject(ServiceTierService);
  private billableItemTypeService = inject(BillableItemTypeService);
  private servicePriceService = inject(ServicePriceService);
  private toastService = inject(ToastService);
  private authService = inject(AuthService);
  private fb = inject(FormBuilder);

  form!: FormGroup;
  loading = signal(true);
  calculating = signal(false);

  instruments = signal<Instrument[]>([]);
  serviceTiers = signal<ServiceTier[]>([]);
  billableItemTypes = signal<BillableItemType[]>([]);
  servicePrices = signal<ServicePrice[]>([]);

  selectedInstrument = signal<Instrument | null>(null);
  selectedServiceTier = signal<ServiceTier | null>(null);
  selectedItemType = signal<BillableItemType | null>(null);
  selectedPrice = signal<ServicePrice | null>(null);
  costBreakdown = signal<CostBreakdown | null>(null);

  ngOnInit(): void {
    this.initForm();
    this.loadData();
  }

  initForm(): void {
    const user = this.authService.getCurrentUser();
    this.form = this.fb.group({
      instrument: [null, Validators.required],
      serviceTier: [null, Validators.required],
      billableItemType: [null, Validators.required],
      quantity: [1, [Validators.required, Validators.min(0.01)]],
      contactEmail: [user?.email || '', [Validators.required, Validators.email]],
      notes: ['']
    });

    this.form.get('instrument')?.valueChanges.subscribe(value => {
      this.onInstrumentChange(value);
    });

    this.form.get('serviceTier')?.valueChanges.subscribe(value => {
      this.onServiceTierChange(value);
    });

    this.form.get('billableItemType')?.valueChanges.subscribe(value => {
      this.onItemTypeChange(value);
    });

    this.form.get('quantity')?.valueChanges.subscribe(() => {
      this.calculateCost();
    });
  }

  loadData(): void {
    this.loading.set(true);

    this.instrumentService.getEnabledInstruments().subscribe({
      next: (response) => {
        this.instruments.set(response.results);
      },
      error: (err) => {
        console.error('Error loading instruments:', err);
        this.toastService.error('Failed to load instruments');
      }
    });

    this.serviceTierService.getActiveServiceTiers().subscribe({
      next: (response) => {
        this.serviceTiers.set(response.results);
      },
      error: (err) => {
        console.error('Error loading service tiers:', err);
        this.toastService.error('Failed to load service tiers');
      }
    });

    this.billableItemTypeService.getActiveBillableItemTypes().subscribe({
      next: (response) => {
        this.billableItemTypes.set(response.results);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error loading billable item types:', err);
        this.toastService.error('Failed to load billable item types');
        this.loading.set(false);
      }
    });
  }

  onInstrumentChange(instrumentId: number): void {
    const instrument = this.instruments().find(i => i.id === instrumentId);
    this.selectedInstrument.set(instrument || null);
    this.loadPrices();
  }

  onServiceTierChange(tierId: number): void {
    const tier = this.serviceTiers().find(t => t.id === tierId);
    this.selectedServiceTier.set(tier || null);
    this.loadPrices();
  }

  onItemTypeChange(itemTypeId: number): void {
    const itemType = this.billableItemTypes().find(it => it.id === itemTypeId);
    this.selectedItemType.set(itemType || null);
    this.loadPrices();
  }

  loadPrices(): void {
    const tierId = this.form.get('serviceTier')?.value;
    const itemTypeId = this.form.get('billableItemType')?.value;

    if (!tierId || !itemTypeId) {
      this.servicePrices.set([]);
      this.selectedPrice.set(null);
      return;
    }

    this.servicePriceService.getServicePrices({
      serviceTier: tierId,
      billableItemType: itemTypeId,
      isActive: true
    }).subscribe({
      next: (response) => {
        this.servicePrices.set(response.results);
        if (response.results.length > 0) {
          this.selectedPrice.set(response.results[0]);
          this.calculateCost();
        } else {
          this.selectedPrice.set(null);
          this.costBreakdown.set(null);
          this.toastService.warning('No active pricing found for this combination');
        }
      },
      error: (err) => {
        console.error('Error loading service prices:', err);
        this.toastService.error('Failed to load pricing');
      }
    });
  }

  calculateCost(): void {
    const price = this.selectedPrice();
    const quantity = this.form.get('quantity')?.value;

    if (!price || !quantity || quantity <= 0) {
      this.costBreakdown.set(null);
      return;
    }

    this.calculating.set(true);
    this.servicePriceService.calculateCost(price.id, {
      quantity: quantity,
      applyBulkDiscount: true
    }).subscribe({
      next: (breakdown) => {
        this.costBreakdown.set(breakdown);
        this.calculating.set(false);
      },
      error: (err) => {
        console.error('Error calculating cost:', err);
        this.toastService.error('Failed to calculate cost');
        this.calculating.set(false);
      }
    });
  }

  generateQuote(): void {
    if (this.form.invalid) {
      Object.keys(this.form.controls).forEach(key => {
        this.form.get(key)?.markAsTouched();
      });
      return;
    }

    const breakdown = this.costBreakdown();
    if (!breakdown) {
      this.toastService.error('Please wait for cost calculation to complete');
      return;
    }

    const instrument = this.selectedInstrument();
    const tier = this.selectedServiceTier();
    const itemType = this.selectedItemType();
    const price = this.selectedPrice();
    const quantity = this.form.get('quantity')?.value;
    const email = this.form.get('contactEmail')?.value;
    const notes = this.form.get('notes')?.value;

    const quoteText = this.formatQuote(
      instrument,
      tier,
      itemType,
      price,
      quantity,
      breakdown,
      email,
      notes
    );

    this.downloadQuote(quoteText);
    this.activeModal.close();
  }

  private formatQuote(
    instrument: Instrument | null,
    tier: ServiceTier | null,
    itemType: BillableItemType | null,
    price: ServicePrice | null,
    quantity: number,
    breakdown: CostBreakdown,
    email: string,
    notes: string
  ): string {
    const date = new Date().toLocaleDateString();

    let quote = `SERVICE QUOTE\n`;
    quote += `=============\n\n`;
    quote += `Date: ${date}\n`;
    quote += `Contact Email: ${email}\n\n`;

    quote += `INSTRUMENT DETAILS\n`;
    quote += `------------------\n`;
    quote += `Instrument: ${instrument?.instrumentName || 'N/A'}\n`;
    if (instrument?.instrumentDescription) {
      quote += `Description: ${instrument.instrumentDescription}\n`;
    }
    quote += `\n`;

    quote += `SERVICE DETAILS\n`;
    quote += `---------------\n`;
    quote += `Service Tier: ${tier?.tierName || 'N/A'}\n`;
    quote += `Billable Item: ${itemType?.name || 'N/A'}\n`;
    quote += `Billing Unit: ${price?.billingUnitDisplay || 'N/A'}\n`;
    quote += `Quantity: ${quantity}\n`;
    quote += `\n`;

    quote += `COST BREAKDOWN\n`;
    quote += `--------------\n`;
    quote += `Unit Price: ${breakdown.currency} ${breakdown.unitPrice.toFixed(2)}\n`;
    quote += `Subtotal: ${breakdown.currency} ${breakdown.subtotal.toFixed(2)}\n`;
    if (breakdown.setupFee > 0) {
      quote += `Setup Fee: ${breakdown.currency} ${breakdown.setupFee.toFixed(2)}\n`;
    }
    if (breakdown.bulkDiscount > 0) {
      quote += `Bulk Discount: -${breakdown.currency} ${breakdown.bulkDiscount.toFixed(2)}\n`;
    }
    if (breakdown.taxAmount > 0) {
      quote += `Tax: ${breakdown.currency} ${breakdown.taxAmount.toFixed(2)}\n`;
    }
    quote += `------------------\n`;
    quote += `TOTAL: ${breakdown.currency} ${breakdown.total.toFixed(2)}\n`;
    quote += `\n`;

    if (notes) {
      quote += `NOTES\n`;
      quote += `-----\n`;
      quote += `${notes}\n`;
      quote += `\n`;
    }

    quote += `\nThis is an estimated quote. Final pricing may vary based on actual usage.\n`;
    quote += `Please contact us at ${email} for any questions or to proceed with the service.\n`;

    return quote;
  }

  private downloadQuote(quoteText: string): void {
    const blob = new Blob([quoteText], { type: 'text/plain;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `quote-${new Date().toISOString().split('T')[0]}.txt`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    this.toastService.success('Quote downloaded successfully');
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
    if (field.errors['email']) return 'Please enter a valid email address';

    return 'Invalid value';
  }
}
