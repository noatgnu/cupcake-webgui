import { Component, inject, Input, Output, EventEmitter, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { StorageService } from '@noatgnu/cupcake-macaron';
import { StorageObject, StorageObjectType, StorageObjectTypeLabels, StorageObjectCreateRequest, StorageObjectUpdateRequest } from '@noatgnu/cupcake-macaron';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'app-storage-form',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './storage-form.html',
  styleUrl: './storage-form.scss'
})
export class StorageForm implements OnInit {
  private fb = inject(FormBuilder);
  private storageService = inject(StorageService);
  activeModal = inject(NgbActiveModal);

  @Input() storageObject?: StorageObject;
  @Output() saved = new EventEmitter<StorageObject>();

  form!: FormGroup;
  submitting = signal(false);
  error = signal<string | null>(null);

  readonly storageTypes = Object.values(StorageObjectType);
  readonly typeLabels = StorageObjectTypeLabels;

  ngOnInit(): void {
    this.initForm();
  }

  private initForm(): void {
    this.form = this.fb.group({
      objectType: [this.storageObject?.objectType || StorageObjectType.SHELF, Validators.required],
      objectName: [this.storageObject?.objectName || '', [Validators.required, Validators.minLength(1)]],
      objectDescription: [this.storageObject?.objectDescription || ''],
      storedAt: [this.storageObject?.storedAt || null]
    });
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.error.set(null);

    const formValue = this.form.value;

    if (this.storageObject) {
      const updateRequest: StorageObjectUpdateRequest = formValue;
      this.storageService.updateStorageObject(this.storageObject.id, updateRequest).subscribe({
        next: (result) => {
          this.saved.emit(result);
          this.activeModal.close(result);
        },
        error: (err) => {
          this.error.set('Failed to update storage object');
          this.submitting.set(false);
          console.error('Error updating storage object:', err);
        }
      });
    } else {
      const createRequest: StorageObjectCreateRequest = formValue;
      this.storageService.createStorageObject(createRequest).subscribe({
        next: (result) => {
          this.saved.emit(result);
          this.activeModal.close(result);
        },
        error: (err) => {
          this.error.set('Failed to create storage object');
          this.submitting.set(false);
          console.error('Error creating storage object:', err);
        }
      });
    }
  }

  cancel(): void {
    this.activeModal.dismiss();
  }
}
