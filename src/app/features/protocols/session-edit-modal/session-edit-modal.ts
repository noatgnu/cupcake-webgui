import { ChangeDetectionStrategy, Component, inject, Input, OnInit, signal } from '@angular/core';

import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { SessionService } from '@noatgnu/cupcake-red-velvet';
import type { Session } from '@noatgnu/cupcake-red-velvet';
import { ToastService } from '@noatgnu/cupcake-core';

@Component({
  selector: 'app-session-edit-modal',
  imports: [ReactiveFormsModule],
  templateUrl: './session-edit-modal.html',
  styleUrl: './session-edit-modal.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SessionEditModal implements OnInit {
  private fb = inject(FormBuilder);
  private sessionService = inject(SessionService);
  private toastService = inject(ToastService);
  activeModal = inject(NgbActiveModal);

  @Input() session!: Session;

  saving = signal(false);

  sessionForm: FormGroup = this.fb.group({
    name: ['', Validators.required],
    enabled: [false],
    startedAt: [''],
    endedAt: ['']
  });

  ngOnInit(): void {
    if (this.session) {
      this.sessionForm.patchValue({
        name: this.session.name,
        enabled: this.session.enabled,
        startedAt: this.session.startedAt ? this.session.startedAt.split('T')[0] : '',
        endedAt: this.session.endedAt ? this.session.endedAt.split('T')[0] : ''
      });
    }
  }

  updateSession(): void {
    if (!this.sessionForm.valid) {
      this.toastService.error('Please fill in required fields');
      return;
    }

    this.saving.set(true);
    const formValue = this.sessionForm.value;

    this.sessionService.updateSession(this.session.id, {
      name: formValue.name,
      enabled: formValue.enabled,
      startedAt: formValue.startedAt || undefined,
      endedAt: formValue.endedAt || undefined
    }).subscribe({
      next: (session) => {
        this.toastService.success('Session updated successfully');
        this.activeModal.close(session);
      },
      error: (err) => {
        this.toastService.error('Failed to update session');
        this.saving.set(false);
      }
    });
  }

  cancel(): void {
    this.activeModal.dismiss();
  }
}
