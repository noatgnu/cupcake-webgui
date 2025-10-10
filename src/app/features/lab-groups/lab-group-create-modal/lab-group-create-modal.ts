import { Component, inject, Input, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { LabGroupService, ToastService, LabGroup, AuthService } from '@noatgnu/cupcake-core';

@Component({
  selector: 'app-lab-group-create-modal',
  imports: [CommonModule, FormsModule],
  templateUrl: './lab-group-create-modal.html',
  styleUrl: './lab-group-create-modal.scss'
})
export class LabGroupCreateModal {
  private activeModal = inject(NgbActiveModal);
  private labGroupService = inject(LabGroupService);
  private toastService = inject(ToastService);
  private authService = inject(AuthService);

  @Input() parentGroup?: LabGroup;

  name = '';
  description = '';
  allowMemberInvites = true;
  allowProcessJobs = false;
  saving = false;

  isStaff = computed(() => {
    const user = this.authService.getCurrentUser();
    return user?.isStaff ?? false;
  });

  save(): void {
    if (!this.name.trim()) {
      this.toastService.error('Lab group name is required');
      return;
    }

    this.saving = true;
    const payload: any = {
      name: this.name.trim(),
      description: this.description.trim(),
      allowMemberInvites: this.allowMemberInvites,
      allowProcessJobs: this.allowProcessJobs
    };

    if (this.parentGroup) {
      payload.parentGroup = this.parentGroup.id;
    }

    this.labGroupService.createLabGroup(payload).subscribe({
      next: (created) => {
        const message = this.parentGroup
          ? `Sub-group created under "${this.parentGroup.name}"`
          : 'Lab group created successfully';
        this.toastService.success(message);
        this.saving = false;
        this.activeModal.close(created);
      },
      error: (err) => {
        this.toastService.error('Failed to create lab group');
        console.error('Error creating lab group:', err);
        this.saving = false;
      }
    });
  }

  close(): void {
    this.activeModal.dismiss();
  }
}
