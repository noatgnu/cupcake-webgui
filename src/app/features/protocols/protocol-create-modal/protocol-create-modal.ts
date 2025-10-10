import { Component, inject } from '@angular/core';
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

  saving = false;

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

  cancel(): void {
    this.activeModal.dismiss();
  }
}
