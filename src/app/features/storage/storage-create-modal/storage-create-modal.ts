import { Component, inject, Input } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, FormControl, Validators } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { StorageObject, StorageObjectType } from '@noatgnu/cupcake-macaron';

@Component({
  selector: 'app-storage-create-modal',
  imports: [ReactiveFormsModule],
  templateUrl: './storage-create-modal.html',
  styleUrl: './storage-create-modal.scss'
})
export class StorageCreateModal {
  private activeModal = inject(NgbActiveModal);
  private fb = inject(FormBuilder);

  private _storedAt: StorageObject | null = null;

  @Input() set storedAt(value: StorageObject | null) {
    this._storedAt = value;
    if (value) {
      this.form.controls.storedAt.setValue(value.id);
    }
  }

  get storedAt(): StorageObject | null {
    return this._storedAt;
  }

  form = this.fb.group({
    name: new FormControl('', Validators.required),
    description: new FormControl(''),
    storedAt: new FormControl<number | null>(null),
    type: new FormControl<StorageObjectType>(StorageObjectType.SHELF, Validators.required),
  });

  readonly typeChoices = [
    { value: StorageObjectType.SHELF, label: 'Shelf' },
    { value: StorageObjectType.BOX, label: 'Box' },
    { value: StorageObjectType.FRIDGE, label: 'Fridge' },
    { value: StorageObjectType.FREEZER, label: 'Freezer' },
    { value: StorageObjectType.ROOM, label: 'Room' },
    { value: StorageObjectType.BUILDING, label: 'Building' },
    { value: StorageObjectType.FLOOR, label: 'Floor' },
    { value: StorageObjectType.OTHER, label: 'Other' }
  ];

  close(): void {
    this.activeModal.dismiss();
  }

  submit(): void {
    if (this.form.valid) {
      this.activeModal.close(this.form.value);
    }
  }
}
