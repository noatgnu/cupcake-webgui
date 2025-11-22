import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { SessionService } from '@noatgnu/cupcake-red-velvet';
import type { Session } from '@noatgnu/cupcake-red-velvet';
import { ToastService } from '@noatgnu/cupcake-core';

@Component({
  selector: 'app-session-date-edit-modal',
  imports: [CommonModule, FormsModule],
  templateUrl: './session-date-edit-modal.html',
  styleUrl: './session-date-edit-modal.scss',
})
export class SessionDateEditModal implements OnInit {
  public activeModal = inject(NgbActiveModal);
  private sessionService = inject(SessionService);
  private toastService = inject(ToastService);

  session!: Session;

  startedAt = signal<string>('');
  endedAt = signal<string>('');

  saving = signal(false);

  ngOnInit(): void {
    if (this.session) {
      if (this.session.startedAt) {
        this.startedAt.set(this.formatDateForInput(this.session.startedAt));
      }
      if (this.session.endedAt) {
        this.endedAt.set(this.formatDateForInput(this.session.endedAt));
      }
    }
  }

  formatDateForInput(dateString: string): string {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  formatDateForBackend(dateString: string): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toISOString();
  }

  save(): void {
    if (!this.session || !this.session.id) {
      this.toastService.error('Invalid session');
      return;
    }

    const updateData: any = {};

    const newStartedAt = this.startedAt() ? this.formatDateForBackend(this.startedAt()) : null;
    const newEndedAt = this.endedAt() ? this.formatDateForBackend(this.endedAt()) : null;

    const oldStartedAt = this.session.startedAt || null;
    const oldEndedAt = this.session.endedAt || null;

    if (newStartedAt !== oldStartedAt) {
      updateData.startedAt = newStartedAt;
    }

    if (newEndedAt !== oldEndedAt) {
      updateData.endedAt = newEndedAt;
    }

    if (Object.keys(updateData).length === 0) {
      this.toastService.info('No changes to save');
      return;
    }

    if (newStartedAt && newEndedAt && new Date(newStartedAt) > new Date(newEndedAt)) {
      this.toastService.error('Start date cannot be after end date');
      return;
    }

    this.saving.set(true);
    this.sessionService.patchSession(this.session.id, updateData).subscribe({
      next: (updatedSession) => {
        this.toastService.success('Session dates updated successfully');
        this.activeModal.close(updatedSession);
      },
      error: (err) => {
        console.error('Error updating session dates:', err);
        this.toastService.error('Failed to update session dates');
        this.saving.set(false);
      }
    });
  }

  cancel(): void {
    this.activeModal.dismiss();
  }

  clearStartDate(): void {
    this.startedAt.set('');
  }

  clearEndDate(): void {
    this.endedAt.set('');
  }
}
