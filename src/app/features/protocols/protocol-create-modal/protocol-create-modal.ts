import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { ProtocolService } from '@noatgnu/cupcake-red-velvet';
import { ToastService } from '@noatgnu/cupcake-core';

@Component({
  selector: 'app-protocol-create-modal',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './protocol-create-modal.html',
  styleUrl: './protocol-create-modal.scss'
})
export class ProtocolCreateModal {
  private fb = inject(FormBuilder);
  private protocolService = inject(ProtocolService);
  private toastService = inject(ToastService);
  activeModal = inject(NgbActiveModal);

  protocolForm: FormGroup = this.fb.group({
    protocolTitle: ['', Validators.required],
    protocolDescription: [''],
    enabled: [false]
  });

  importForm: FormGroup = this.fb.group({
    protocolsIOUrl: ['', [Validators.required, Validators.pattern(/^https?:\/\/(www\.)?protocols\.io\/.+/)]]
  });

  saving = false;
  isImportMode = signal(false);

  createProtocol(): void {
    if (!this.protocolForm.valid) {
      this.toastService.error('Please fill in required fields');
      return;
    }

    this.saving = true;
    const formValue = this.protocolForm.value;

    this.protocolService.createProtocol({
      protocolTitle: formValue.protocolTitle,
      protocolDescription: formValue.protocolDescription,
      enabled: formValue.enabled
    }).subscribe({
      next: (protocol) => {
        this.toastService.success('Protocol created successfully');
        this.activeModal.close(protocol);
      },
      error: (err) => {
        this.toastService.error('Failed to create protocol');
        console.error('Error creating protocol:', err);
        this.saving = false;
      }
    });
  }

  toggleMode(): void {
    this.isImportMode.set(!this.isImportMode());
    this.protocolForm.reset({ enabled: false });
    this.importForm.reset();
  }

  importProtocol(): void {
    if (!this.importForm.valid) {
      this.toastService.error('Please enter a valid protocols.io URL');
      return;
    }

    this.saving = true;
    const url = this.importForm.value.protocolsIOUrl;

    this.protocolService.importFromProtocolsIO(url).subscribe({
      next: (protocol) => {
        this.toastService.success('Protocol imported successfully from protocols.io');
        this.activeModal.close(protocol);
      },
      error: (err) => {
        this.toastService.error(err?.error?.error || 'Failed to import protocol from protocols.io');
        console.error('Error importing protocol:', err);
        this.saving = false;
      }
    });
  }

  cancel(): void {
    this.activeModal.dismiss();
  }
}
