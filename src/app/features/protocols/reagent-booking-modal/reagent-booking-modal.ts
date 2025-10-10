import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { ReagentService, StoredReagentQueryParams, ReagentActionService, ActionType } from '@noatgnu/cupcake-macaron';
import type { StoredReagent, ReagentActionCreateRequest } from '@noatgnu/cupcake-macaron';
import type { StepReagent } from '@noatgnu/cupcake-red-velvet';
import { ToastService } from '@noatgnu/cupcake-core';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

@Component({
  selector: 'app-reagent-booking-modal',
  imports: [CommonModule, FormsModule],
  templateUrl: './reagent-booking-modal.html',
  styleUrl: './reagent-booking-modal.scss'
})
export class ReagentBookingModal implements OnInit {
  activeModal = inject(NgbActiveModal);
  private reagentService = inject(ReagentService);
  private reagentActionService = inject(ReagentActionService);
  private toastService = inject(ToastService);

  stepReagent!: StepReagent;
  sessionId!: number;
  stepId!: number;

  searchTerm = signal('');
  storedReagents = signal<StoredReagent[]>([]);
  loading = signal(false);
  saving = signal(false);

  selectedReagent = signal<StoredReagent | null>(null);
  quantity = signal<number>(0);
  notes = signal('');

  private searchSubject = new Subject<string>();

  availableQuantity = computed(() => {
    const reagent = this.selectedReagent();
    return reagent ? reagent.currentQuantity : 0;
  });

  isValidQuantity = computed(() => {
    const qty = this.quantity();
    const available = this.availableQuantity();
    return qty > 0 && qty <= available;
  });

  ngOnInit(): void {
    if (this.stepReagent) {
      this.quantity.set(this.stepReagent.scaledQuantity || this.stepReagent.quantity);
    }

    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(term => {
      this.performSearch(term);
    });

    this.loadStoredReagents();
  }

  onSearchChange(term: string): void {
    this.searchTerm.set(term);
    this.searchSubject.next(term);
  }

  performSearch(term: string): void {
    this.loadStoredReagents(term);
  }

  loadStoredReagents(search?: string): void {
    this.loading.set(true);
    const params: StoredReagentQueryParams = {
      reagent: this.stepReagent.reagentId,
      limit: 10,
      ordering: '-currentQuantity'
    };

    if (search) {
      params.search = search;
    }

    this.reagentService.getStoredReagents(params).subscribe({
      next: (response) => {
        this.storedReagents.set(response.results);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error loading stored reagents:', err);
        this.toastService.error('Failed to load stored reagents');
        this.loading.set(false);
      }
    });
  }

  selectReagent(reagent: StoredReagent): void {
    this.selectedReagent.set(reagent);
  }

  isSelected(reagent: StoredReagent): boolean {
    const selected = this.selectedReagent();
    return selected ? selected.id === reagent.id : false;
  }

  updateQuantity(value: string): void {
    const num = parseFloat(value);
    this.quantity.set(isNaN(num) ? 0 : num);
  }

  updateNotes(value: string): void {
    this.notes.set(value);
  }

  bookReagent(): void {
    const selected = this.selectedReagent();
    if (!selected || !this.isValidQuantity()) {
      return;
    }

    this.saving.set(true);
    const actionData: ReagentActionCreateRequest = {
      actionType: ActionType.RESERVE,
      reagent: selected.id,
      quantity: this.quantity(),
      session: this.sessionId,
      step: this.stepId,
      notes: this.notes() || undefined
    };

    this.reagentActionService.createReagentAction(actionData).subscribe({
      next: (action) => {
        this.toastService.success('Reagent booked successfully');
        this.activeModal.close(action);
      },
      error: (err) => {
        console.error('Error booking reagent:', err);
        this.toastService.error('Failed to book reagent');
        this.saving.set(false);
      }
    });
  }

  cancel(): void {
    this.activeModal.dismiss();
  }
}
