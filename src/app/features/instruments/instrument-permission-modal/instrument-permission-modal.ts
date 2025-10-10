import { Component, inject, Input, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { InstrumentPermissionService } from '@noatgnu/cupcake-macaron';
import type { Instrument, InstrumentPermission } from '@noatgnu/cupcake-macaron';
import { ToastService, UserManagementService } from '@noatgnu/cupcake-core';
import type { User } from '@noatgnu/cupcake-core';

interface UserWithPermission {
  user: User;
  permission?: InstrumentPermission;
  canView: boolean;
  canBook: boolean;
  canManage: boolean;
}

@Component({
  selector: 'app-instrument-permission-modal',
  imports: [CommonModule, FormsModule],
  templateUrl: './instrument-permission-modal.html',
  styleUrl: './instrument-permission-modal.scss'
})
export class InstrumentPermissionModal implements OnInit {
  private activeModal = inject(NgbActiveModal);
  private instrumentPermissionService = inject(InstrumentPermissionService);
  private userManagementService = inject(UserManagementService);
  private toastService = inject(ToastService);

  @Input() instrument!: Instrument;

  readonly Math = Math;

  users = signal<UserWithPermission[]>([]);
  loading = signal(false);
  saving = signal(false);
  searchTerm = signal('');
  currentPage = signal(1);
  totalUsers = signal(0);
  pageSize = 10;

  ngOnInit(): void {
    this.loadUsersWithPermissions();
  }

  loadUsersWithPermissions(): void {
    this.loading.set(true);
    const offset = (this.currentPage() - 1) * this.pageSize;

    this.userManagementService.getUsers({
      search: this.searchTerm() || undefined,
      limit: this.pageSize,
      offset: offset
    }).subscribe({
      next: (usersResponse) => {
        this.totalUsers.set(usersResponse.count);

        this.instrumentPermissionService.getInstrumentPermissions({
          instrument: this.instrument.id,
          limit: 1000
        }).subscribe({
          next: (permissionsResponse) => {
            const permissionsByUser = new Map<number, InstrumentPermission>();
            permissionsResponse.results.forEach(p => permissionsByUser.set(p.user, p));

            const usersWithPermissions = usersResponse.results.map((user: User) => {
              const permission = permissionsByUser.get(user.id);
              return {
                user,
                permission,
                canView: permission?.canView || false,
                canBook: permission?.canBook || false,
                canManage: permission?.canManage || false
              };
            });

            this.users.set(usersWithPermissions);
            this.loading.set(false);
          },
          error: (err: unknown) => {
            this.toastService.error('Failed to load permissions');
            console.error('Error loading permissions:', err);
            this.loading.set(false);
          }
        });
      },
      error: (err: unknown) => {
        this.toastService.error('Failed to load users');
        console.error('Error loading users:', err);
        this.loading.set(false);
      }
    });
  }

  onSearchChange(): void {
    this.currentPage.set(1);
    this.loadUsersWithPermissions();
  }

  nextPage(): void {
    const totalPages = Math.ceil(this.totalUsers() / this.pageSize);
    if (this.currentPage() < totalPages) {
      this.currentPage.update(page => page + 1);
      this.loadUsersWithPermissions();
    }
  }

  previousPage(): void {
    if (this.currentPage() > 1) {
      this.currentPage.update(page => page - 1);
      this.loadUsersWithPermissions();
    }
  }

  save(): void {
    this.saving.set(true);
    const updates: Promise<any>[] = [];

    this.users().forEach(userWithPermission => {
      const hasAnyPermission = userWithPermission.canView ||
                              userWithPermission.canBook ||
                              userWithPermission.canManage;

      if (hasAnyPermission) {
        if (userWithPermission.permission) {
          updates.push(
            this.instrumentPermissionService.updateInstrumentPermission(
              userWithPermission.permission.id,
              {
                canView: userWithPermission.canView,
                canBook: userWithPermission.canBook,
                canManage: userWithPermission.canManage
              }
            ).toPromise()
          );
        } else {
          updates.push(
            this.instrumentPermissionService.createInstrumentPermission({
              user: userWithPermission.user.id,
              instrument: this.instrument.id,
              canView: userWithPermission.canView,
              canBook: userWithPermission.canBook,
              canManage: userWithPermission.canManage
            }).toPromise()
          );
        }
      } else if (userWithPermission.permission) {
        updates.push(
          this.instrumentPermissionService.deleteInstrumentPermission(
            userWithPermission.permission.id
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
      .catch((err: unknown) => {
        this.toastService.error('Failed to update permissions');
        console.error('Error updating permissions:', err);
        this.saving.set(false);
      });
  }

  close(): void {
    this.activeModal.dismiss();
  }
}
