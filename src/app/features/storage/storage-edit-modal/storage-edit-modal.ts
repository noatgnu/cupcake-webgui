import { Component, inject, Input } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, FormControl, Validators } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { StorageObject } from '@noatgnu/cupcake-macaron';
import { ImageUpload } from '../../../shared/components/image-upload/image-upload';

@Component({
  selector: 'app-storage-edit-modal',
  imports: [ReactiveFormsModule, ImageUpload],
  templateUrl: './storage-edit-modal.html',
  styleUrl: './storage-edit-modal.scss'
})
export class StorageEditModal {
  private activeModal = inject(NgbActiveModal);
  private fb = inject(FormBuilder);

  private _storageObject?: StorageObject;
  initialImage?: string;

  @Input() set storageObject(value: StorageObject | undefined) {
    this._storageObject = value;
    if (value) {
      this.form.controls.objectName.setValue(value.objectName);
      this.form.controls.objectDescription.setValue(value.objectDescription || '');
      this.form.controls.pngBase64.setValue(value.pngBase64 || '');
      this.initialImage = value.pngBase64;
    }
  }

  get storageObject(): StorageObject | undefined {
    return this._storageObject;
  }

  form = this.fb.group({
    objectName: new FormControl('', Validators.required),
    objectDescription: new FormControl(''),
    pngBase64: new FormControl('')
  });

  close(): void {
    this.activeModal.dismiss();
  }

  submit(): void {
    if (this.form.valid) {
      this.activeModal.close(this.form.value);
    }
  }

  onImageChange(base64: string): void {
    this.form.controls.pngBase64.setValue(base64);
  }

  onImageCleared(): void {
    this.form.controls.pngBase64.setValue('');
  }
}
