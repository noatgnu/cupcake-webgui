import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { SessionService, ProtocolService } from '@noatgnu/cupcake-red-velvet';
import type { Session, ProtocolModel } from '@noatgnu/cupcake-red-velvet';
import { ToastService } from '@noatgnu/cupcake-core';
import { SessionEditModal } from '../session-edit-modal/session-edit-modal';

@Component({
  selector: 'app-session-list',
  imports: [CommonModule, FormsModule],
  templateUrl: './session-list.html',
  styleUrl: './session-list.scss'
})
export class SessionList implements OnInit {
  private sessionService = inject(SessionService);
  private protocolService = inject(ProtocolService);
  private router = inject(Router);
  private toastService = inject(ToastService);
  private modalService = inject(NgbModal);

  sessions = signal<Session[]>([]);
  loading = signal(false);
  searchTerm = '';
  selectedSessionIndex = signal<number | null>(null);
  sessionProtocols = signal<Map<number, ProtocolModel[]>>(new Map());
  loadingProtocols = signal(false);

  total = signal(0);
  page = signal(1);
  readonly pageSize = 10;
  readonly Math = Math;

  selectedSession = computed(() => {
    const index = this.selectedSessionIndex();
    const sessionsList = this.sessions();
    return index !== null && index >= 0 && index < sessionsList.length ? sessionsList[index] : null;
  });

  selectedSessionProtocols = computed(() => {
    const session = this.selectedSession();
    if (!session) return [];
    return this.sessionProtocols().get(session.id) || [];
  });

  ngOnInit(): void {
    this.loadSessions();
  }

  loadSessions(): void {
    this.loading.set(true);
    const offset = (this.page() - 1) * this.pageSize;

    const params: any = {
      limit: this.pageSize,
      offset: offset,
      ordering: '-created_at'
    };

    if (this.searchTerm.trim()) {
      params.search = this.searchTerm.trim();
    }

    this.sessionService.getSessions(params).subscribe({
      next: (response) => {
        this.sessions.set(response.results);
        this.total.set(response.count);
        this.loading.set(false);

        if (response.results.length > 0) {
          this.selectSession(0);
        } else {
          this.selectedSessionIndex.set(null);
        }
      },
      error: (err) => {
        this.toastService.error('Failed to load sessions');
        console.error('Error loading sessions:', err);
        this.loading.set(false);
      }
    });
  }

  selectSession(index: number): void {
    this.selectedSessionIndex.set(index);
    const session = this.sessions()[index];

    if (session && session.protocols && session.protocols.length > 0) {
      this.loadSessionProtocols(session.id, session.protocols);
    } else {
      const protocolsMap = new Map(this.sessionProtocols());
      protocolsMap.set(session.id, []);
      this.sessionProtocols.set(protocolsMap);
    }
  }

  loadSessionProtocols(sessionId: number, protocolIds: number[]): void {
    this.loadingProtocols.set(true);
    const protocolRequests = protocolIds.map(id =>
      this.protocolService.getProtocol(id)
    );

    Promise.all(protocolRequests.map(req => req.toPromise()))
      .then(protocols => {
        const protocolsMap = new Map(this.sessionProtocols());
        protocolsMap.set(sessionId, protocols.filter((p): p is ProtocolModel => p !== undefined));
        this.sessionProtocols.set(protocolsMap);
        this.loadingProtocols.set(false);
      })
      .catch(err => {
        console.error('Error loading protocols:', err);
        this.toastService.error('Failed to load session protocols');
        this.loadingProtocols.set(false);
      });
  }

  onSearchChange(): void {
    this.page.set(1);
    this.loadSessions();
  }

  previousPage(): void {
    if (this.page() > 1) {
      this.page.update(p => p - 1);
      this.loadSessions();
    }
  }

  nextPage(): void {
    if (this.page() * this.pageSize < this.total()) {
      this.page.update(p => p + 1);
      this.loadSessions();
    }
  }

  deleteSession(id: number, event: Event): void {
    event.stopPropagation();

    if (!confirm('Are you sure you want to delete this session?')) {
      return;
    }

    this.sessionService.deleteSession(id).subscribe({
      next: () => {
        this.toastService.success('Session deleted successfully');
        this.loadSessions();
      },
      error: (err) => {
        this.toastService.error('Failed to delete session');
        console.error('Error deleting session:', err);
      }
    });
  }

  toggleEnabled(session: Session, event: Event): void {
    event.stopPropagation();

    this.sessionService.updateSession(session.id, {
      enabled: !session.enabled
    }).subscribe({
      next: (updated) => {
        session.enabled = updated.enabled;
        this.toastService.success(`Session ${session.enabled ? 'enabled' : 'disabled'}`);
      },
      error: (err) => {
        this.toastService.error('Failed to update session');
        console.error('Error updating session:', err);
      }
    });
  }

  getSessionStatus(session: Session): string {
    if (session.endedAt) {
      return 'Completed';
    } else if (session.startedAt) {
      return 'In Progress';
    }
    return 'Not Started';
  }

  getSessionStatusClass(session: Session): string {
    if (session.endedAt) {
      return 'bg-success';
    } else if (session.startedAt) {
      return 'bg-primary';
    }
    return 'bg-secondary';
  }

  openProtocolEditor(protocolId: number): void {
    this.router.navigate(['/protocols', protocolId, 'edit']);
  }

  openSessionDetail(sessionId: number): void {
    this.router.navigate(['/protocols/sessions', sessionId]);
  }

  editSession(session: Session): void {
    const modalRef = this.modalService.open(SessionEditModal, {
      size: 'md',
      backdrop: 'static'
    });

    modalRef.componentInstance.session = session;

    modalRef.result.then(
      (updatedSession: Session) => {
        const sessions = this.sessions();
        const index = sessions.findIndex(s => s.id === updatedSession.id);
        if (index >= 0) {
          sessions[index] = updatedSession;
          this.sessions.set([...sessions]);
        }
      },
      () => {
      }
    );
  }
}
