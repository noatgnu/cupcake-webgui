import { ChangeDetectionStrategy, Component, inject, Input, OnInit, computed, signal } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { LabGroup, LabGroupService, ToastService, AuthService } from '@noatgnu/cupcake-core';

@Component({
  selector: 'app-lab-group-edit-modal',
  imports: [FormsModule],
  templateUrl: './lab-group-edit-modal.html',
  styleUrl: './lab-group-edit-modal.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LabGroupEditModal implements OnInit {
  private activeModal = inject(NgbActiveModal);
  private labGroupService = inject(LabGroupService);
  private toastService = inject(ToastService);
  private authService = inject(AuthService);

  @Input() labGroup!: LabGroup;

  name = '';
  description = '';
  allowMemberInvites = false;
  allowProcessJobs = false;
  isActive = true;
  saving = signal(false);

  isStaff = computed(() => {
    const user = this.authService.currentUser();
    return user?.isStaff ?? false;
  });

  ngOnInit(): void {
    this.name = this.labGroup.name;
    this.description = this.labGroup.description || '';
    this.allowMemberInvites = this.labGroup.allowMemberInvites;
    this.allowProcessJobs = this.labGroup.allowProcessJobs;
    this.isActive = this.labGroup.isActive;
  }

  save(): void {
    if (!this.name.trim()) {
      this.toastService.error('Lab group name is required');
      return;
    }

    this.saving.set(true);
    this.labGroupService.updateLabGroup(this.labGroup.id, {
      name: this.name.trim(),
      description: this.description.trim(),
      allowMemberInvites: this.allowMemberInvites,
      allowProcessJobs: this.allowProcessJobs,
      isActive: this.isActive
    }).subscribe({
      next: (updated) => {
        this.toastService.success('Lab group updated successfully');
        this.saving.set(false);
        this.activeModal.close(updated);
      },
      error: (err) => {
        this.toastService.error('Failed to update lab group');
        this.saving.set(false);
      }
    });
  }

  close(): void {
    this.activeModal.dismiss();
  }
}
