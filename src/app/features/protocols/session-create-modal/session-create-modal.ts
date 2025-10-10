import { Component, inject, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { SessionService } from '@noatgnu/cupcake-red-velvet';
import type { Session, ProtocolModel } from '@noatgnu/cupcake-red-velvet';
import { ToastService } from '@noatgnu/cupcake-core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-session-create-modal',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './session-create-modal.html',
  styleUrl: './session-create-modal.scss'
})
export class SessionCreateModal {
  private fb = inject(FormBuilder);
  private sessionService = inject(SessionService);
  private toastService = inject(ToastService);
  private router = inject(Router);
  activeModal = inject(NgbActiveModal);

  @Input() protocol!: ProtocolModel;

  sessionForm: FormGroup = this.fb.group({
    name: ['', Validators.required],
    enabled: [true]
  });

  saving = false;

  createSession(): void {
    if (!this.sessionForm.valid) {
      this.toastService.error('Please fill in required fields');
      return;
    }

    this.saving = true;
    const formValue = this.sessionForm.value;

    this.sessionService.createSession({
      name: formValue.name,
      enabled: formValue.enabled,
      protocols: [this.protocol.id]
    }).subscribe({
      next: (session: Session) => {
        this.toastService.success('Session created successfully');
        this.activeModal.close(session);
      },
      error: (err) => {
        this.toastService.error('Failed to create session');
        console.error('Error creating session:', err);
        this.saving = false;
      }
    });
  }

  cancel(): void {
    this.activeModal.dismiss();
  }
}
