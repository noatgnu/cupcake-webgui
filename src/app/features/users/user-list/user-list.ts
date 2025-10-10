import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { User, ToastService, AuthService } from '@noatgnu/cupcake-core';
import { UserManagementService } from '@noatgnu/cupcake-core';
import { UserCreateModal } from '../user-create-modal/user-create-modal';
import { UserEditModal } from '../user-edit-modal/user-edit-modal';

@Component({
  selector: 'app-user-list',
  imports: [CommonModule, FormsModule],
  templateUrl: './user-list.html',
  styleUrl: './user-list.scss'
})
export class UserList implements OnInit {
  private userManagementService = inject(UserManagementService);
  private toastService = inject(ToastService);
  private authService = inject(AuthService);
  private modalService = inject(NgbModal);

  currentUser$ = this.authService.currentUser$;

  users = signal<User[]>([]);
  selectedUser = signal<User | null>(null);
  loading = signal(false);
  error = signal<string | null>(null);

  total = signal(0);
  page = signal(1);
  searchQuery = '';
  readonly pageSize = 20;
  readonly Math = Math;

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers(): void {
    this.loading.set(true);
    this.error.set(null);

    const offset = (this.page() - 1) * this.pageSize;
    const params: {
      isStaff?: boolean;
      isActive?: boolean;
      search?: string;
      limit?: number;
      offset?: number;
    } = {
      limit: this.pageSize,
      offset: offset
    };

    if (this.searchQuery) {
      params.search = this.searchQuery;
    }

    this.userManagementService.getUsers(params).subscribe({
      next: (response) => {
        this.users.set(response.results);
        this.total.set(response.count);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set('Failed to load users');
        this.loading.set(false);
        console.error('Error loading users:', err);
      }
    });
  }

  onSearchChange(): void {
    this.page.set(1);
    this.loadUsers();
  }

  previousPage(): void {
    if (this.page() > 1) {
      this.page.update(p => p - 1);
      this.loadUsers();
    }
  }

  nextPage(): void {
    const totalPages = Math.ceil(this.total() / this.pageSize);
    if (this.page() < totalPages) {
      this.page.update(p => p + 1);
      this.loadUsers();
    }
  }

  selectUser(user: User): void {
    this.selectedUser.set(user);
  }

  openCreateModal(): void {
    const modalRef = this.modalService.open(UserCreateModal, {
      backdrop: 'static'
    });
    modalRef.result.then(
      (result) => {
        if (result) {
          this.loadUsers();
        }
      },
      () => {}
    );
  }

  openEditModal(user: User): void {
    const modalRef = this.modalService.open(UserEditModal, {
      backdrop: 'static'
    });
    modalRef.componentInstance.user = user;
    modalRef.result.then(
      (result) => {
        if (result) {
          const usersArray = this.users();
          const index = usersArray.findIndex(u => u.id === result.id);
          if (index !== -1) {
            usersArray[index] = result;
            this.users.set([...usersArray]);
          }
          if (this.selectedUser()?.id === result.id) {
            this.selectedUser.set(result);
          }
        }
      },
      () => {}
    );
  }

  getUserDisplayName(user: User): string {
    return this.userManagementService.getUserDisplayName(user);
  }

  isStaff(): boolean {
    const user = this.authService.getCurrentUser();
    return user?.isStaff ?? false;
  }
}
