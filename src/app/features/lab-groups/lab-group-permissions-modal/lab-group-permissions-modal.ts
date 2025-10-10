import { Component, inject, Input, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import {
  LabGroup,
  LabGroupMember,
  LabGroupPermission,
  LabGroupService,
  ToastService,
  AuthService
} from '@noatgnu/cupcake-core';

interface MemberWithPermission {
  member: LabGroupMember;
  permission?: LabGroupPermission;
  canView: boolean;
  canInvite: boolean;
  canManage: boolean;
  canProcessJobs: boolean;
}

@Component({
  selector: 'app-lab-group-permissions-modal',
  imports: [CommonModule, FormsModule],
  templateUrl: './lab-group-permissions-modal.html',
  styleUrl: './lab-group-permissions-modal.scss'
})
export class LabGroupPermissionsModal implements OnInit {
  private activeModal = inject(NgbActiveModal);
  private labGroupService = inject(LabGroupService);
  private toastService = inject(ToastService);
  private authService = inject(AuthService);

  @Input() labGroup!: LabGroup;

  members = signal<MemberWithPermission[]>([]);
  loading = signal(false);
  saving = signal(false);

  isStaff = computed(() => {
    const user = this.authService.getCurrentUser();
    return user?.isStaff ?? false;
  });

  ngOnInit(): void {
    this.loadMembersWithPermissions();
  }

  loadMembersWithPermissions(): void {
    this.loading.set(true);

    this.labGroupService.getLabGroupMembers(this.labGroup.id, { limit: 1000, directOnly: true }).subscribe({
      next: (response) => {
        this.labGroupService.getLabGroupPermissionsForLabGroup(this.labGroup.id).subscribe({
          next: (permissionsResponse) => {
            const permissionsByUser = new Map<number, LabGroupPermission>();
            permissionsResponse.results.forEach(p => permissionsByUser.set(p.user, p));

            const membersWithPermissions = response.results.map((member: LabGroupMember) => {
              const permission = permissionsByUser.get(member.id);
              return {
                member,
                permission,
                canView: permission?.canView || false,
                canInvite: permission?.canInvite || false,
                canManage: permission?.canManage || false,
                canProcessJobs: permission?.canProcessJobs || false
              };
            });

            this.members.set(membersWithPermissions);
            this.loading.set(false);
          },
          error: (err) => {
            this.toastService.error('Failed to load permissions');
            console.error('Error loading permissions:', err);
            this.loading.set(false);
          }
        });
      },
      error: (err) => {
        this.toastService.error('Failed to load members');
        console.error('Error loading members:', err);
        this.loading.set(false);
      }
    });
  }

  save(): void {
    this.saving.set(true);
    const updates: Promise<any>[] = [];

    this.members().forEach(memberWithPermission => {
      const hasAnyPermission = memberWithPermission.canView ||
                              memberWithPermission.canInvite ||
                              memberWithPermission.canManage ||
                              memberWithPermission.canProcessJobs;

      if (hasAnyPermission) {
        if (memberWithPermission.permission) {
          updates.push(
            this.labGroupService.updateLabGroupPermission(
              memberWithPermission.permission.id,
              {
                canView: memberWithPermission.canView,
                canInvite: memberWithPermission.canInvite,
                canManage: memberWithPermission.canManage,
                canProcessJobs: memberWithPermission.canProcessJobs
              }
            ).toPromise()
          );
        } else {
          updates.push(
            this.labGroupService.createLabGroupPermission({
              user: memberWithPermission.member.id,
              labGroup: this.labGroup.id,
              canView: memberWithPermission.canView,
              canInvite: memberWithPermission.canInvite,
              canManage: memberWithPermission.canManage,
              canProcessJobs: memberWithPermission.canProcessJobs
            }).toPromise()
          );
        }
      } else if (memberWithPermission.permission) {
        updates.push(
          this.labGroupService.deleteLabGroupPermission(
            memberWithPermission.permission.id
          ).toPromise()
        );
      }
    });

    Promise.all(updates)
      .then(() => {
        this.toastService.success('Permissions updated successfully');
        this.saving.set(false);
        this.activeModal.close(true);
      })
      .catch((err) => {
        this.toastService.error('Failed to update permissions');
        console.error('Error updating permissions:', err);
        this.saving.set(false);
      });
  }

  close(): void {
    this.activeModal.dismiss();
  }
}
