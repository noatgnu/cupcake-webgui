import { ChangeDetectionStrategy, Component, inject, Input, OnInit, signal, WritableSignal } from '@angular/core';
import { forkJoin, of } from 'rxjs';

import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { SessionService } from '@noatgnu/cupcake-red-velvet';
import type { Session } from '@noatgnu/cupcake-red-velvet';
import { ToastService, User, UserManagementService } from '@noatgnu/cupcake-core';

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
  private userManagementService = inject(UserManagementService);
  activeModal = inject(NgbActiveModal);

  @Input() session!: Session;

  saving = signal(false);
  editors = signal<User[]>([]);
  viewers = signal<User[]>([]);
  searchTerm = signal('');
  searchResults = signal<User[]>([]);
  searching = signal(false);

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
      this.loadMembers(this.session.editors || [], this.editors);
      this.loadMembers(this.session.viewers || [], this.viewers);
    }
  }

  private loadMembers(ids: number[], target: WritableSignal<User[]>): void {
    const requests = ids.map(id => this.userManagementService.getUser(id));
    (requests.length ? forkJoin(requests) : of([])).subscribe({
      next: (users) => target.set(users),
      error: () => this.toastService.error('Failed to load session members')
    });
  }

  onSearchChange(term: string): void {
    this.searchTerm.set(term);
    if (term.trim().length < 2) {
      this.searchResults.set([]);
      return;
    }
    this.searching.set(true);
    this.userManagementService.getUsers({ search: term.trim(), isActive: true, limit: 10, offset: 0 }).subscribe({
      next: (response) => {
        this.searchResults.set(response.results);
        this.searching.set(false);
      },
      error: () => {
        this.toastService.error('Failed to search users');
        this.searching.set(false);
      }
    });
  }

  addEditor(user: User): void {
    this.viewers.update(list => list.filter(u => u.id !== user.id));
    if (!this.editors().some(u => u.id === user.id)) {
      this.editors.update(list => [...list, user]);
    }
  }

  addViewer(user: User): void {
    this.editors.update(list => list.filter(u => u.id !== user.id));
    if (!this.viewers().some(u => u.id === user.id)) {
      this.viewers.update(list => [...list, user]);
    }
  }

  removeEditor(user: User): void {
    this.editors.update(list => list.filter(u => u.id !== user.id));
  }

  removeViewer(user: User): void {
    this.viewers.update(list => list.filter(u => u.id !== user.id));
  }

  getUserDisplayName(user: User): string {
    return this.userManagementService.getUserDisplayName(user);
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
      endedAt: formValue.endedAt || undefined,
      editors: this.editors().map(u => u.id),
      viewers: this.viewers().map(u => u.id)
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
