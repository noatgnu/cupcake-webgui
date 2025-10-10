import { Component, inject, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { NgbActiveModal, NgbTypeahead } from '@ng-bootstrap/ng-bootstrap';
import { ToastService } from '@noatgnu/cupcake-core';
import { StepReagentService } from '@noatgnu/cupcake-red-velvet';
import type { StepReagent } from '@noatgnu/cupcake-red-velvet';
import { ReagentService } from '@noatgnu/cupcake-macaron';
import type { Reagent } from '@noatgnu/cupcake-macaron';
import { debounceTime, map, Observable, of, switchMap } from 'rxjs';

@Component({
  selector: 'app-step-reagent-modal',
  imports: [CommonModule, ReactiveFormsModule, NgbTypeahead],
  templateUrl: './step-reagent-modal.html',
  styleUrl: './step-reagent-modal.scss'
})
export class StepReagentModal implements OnInit {
  private fb = inject(FormBuilder);
  private stepReagentService = inject(StepReagentService);
  private reagentService = inject(ReagentService);
  private toastService = inject(ToastService);
  activeModal = inject(NgbActiveModal);

  @Input() stepId!: number;
  @Input() stepReagent?: StepReagent;

  saving = false;

  reagentForm: FormGroup = this.fb.group({
    reagentName: ['', Validators.required],
    reagentUnit: ['', Validators.required],
    quantity: [0, [Validators.required, Validators.min(0)]],
    scalable: [false],
    scalableFactor: [1]
  });

  searchReagent = (text$: Observable<string>) => {
    return text$.pipe(
      debounceTime(200),
      switchMap(term => {
        if (term.length < 1) {
          return of([]);
        }
        return this.reagentService.getReagents({ search: term, limit: 10 }).pipe(
          map(response => response.results)
        );
      })
    );
  };

  formatReagent = (reagent: Reagent | string): string => {
    if (typeof reagent === 'string') {
      return reagent;
    }
    return reagent.name;
  };

  onSelectReagent(event: any): void {
    event.preventDefault();
    if (typeof event.item === 'object' && event.item.unit) {
      this.reagentForm.patchValue({
        reagentName: event.item.name,
        reagentUnit: event.item.unit
      });
    }
  }

  ngOnInit(): void {
    if (this.stepReagent && this.stepReagent.reagent) {
      this.reagentForm.patchValue({
        reagentName: this.stepReagent.reagent.name,
        reagentUnit: this.stepReagent.reagent.unit || '',
        quantity: this.stepReagent.quantity,
        scalable: this.stepReagent.scalable,
        scalableFactor: this.stepReagent.scalableFactor || 1
      });
    }

    this.reagentForm.get('scalable')?.valueChanges.subscribe(scalable => {
      if (!scalable) {
        this.reagentForm.patchValue({ scalableFactor: 1 });
      }
    });
  }

  save(): void {
    if (!this.reagentForm.valid) {
      this.toastService.error('Please fill in required fields');
      return;
    }

    const name = typeof this.reagentForm.value.reagentName === 'string'
      ? this.reagentForm.value.reagentName.trim()
      : this.reagentForm.value.reagentName;

    if (!name) {
      this.toastService.error('Please enter a reagent name');
      return;
    }

    if (!this.reagentForm.value.reagentUnit?.trim()) {
      this.toastService.error('Please select a unit');
      return;
    }

    this.saving = true;
    const formValue = this.reagentForm.value;

    this.reagentService.getReagents({
      search: name,
      limit: 10
    }).pipe(
      switchMap(response => {
        const unitToMatch = formValue.reagentUnit?.trim() || '';
        const exactMatch = response.results.find(r =>
          r.name.toLowerCase() === name.toLowerCase() &&
          (r.unit || '').toLowerCase() === unitToMatch.toLowerCase()
        );

        if (exactMatch) {
          return of(exactMatch.id);
        } else {
          return this.reagentService.createReagent({
            name: name,
            unit: unitToMatch
          }).pipe(
            map(newReagent => newReagent.id)
          );
        }
      }),
      switchMap(reagentId => {
        if (this.stepReagent) {
          return this.stepReagentService.patchStepReagent(this.stepReagent.id, {
            reagentId: reagentId,
            quantity: formValue.quantity,
            scalable: formValue.scalable,
            scalableFactor: formValue.scalable ? formValue.scalableFactor : 1
          });
        } else {
          return this.stepReagentService.createStepReagent({
            step: this.stepId,
            reagentId: reagentId,
            quantity: formValue.quantity,
            scalable: formValue.scalable,
            scalableFactor: formValue.scalable ? formValue.scalableFactor : 1
          });
        }
      })
    ).subscribe({
      next: (result) => {
        this.toastService.success(
          this.stepReagent
            ? 'Step reagent updated successfully'
            : 'Step reagent created successfully'
        );
        this.activeModal.close(result);
      },
      error: (err) => {
        this.toastService.error(
          this.stepReagent
            ? 'Failed to update step reagent'
            : 'Failed to create step reagent'
        );
        console.error('Error saving step reagent:', err);
        this.saving = false;
      }
    });
  }

  cancel(): void {
    this.activeModal.dismiss();
  }
}
