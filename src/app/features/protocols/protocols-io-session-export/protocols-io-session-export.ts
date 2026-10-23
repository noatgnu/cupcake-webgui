import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AsyncTaskMonitorService, TaskStatus, ToastService } from '@noatgnu/cupcake-core';
import { Session, SessionService } from '@noatgnu/cupcake-red-velvet';
import {
  ProtocolsIOAccountService,
  ProtocolsIOFolderEntry,
  ProtocolsIORun,
  ProtocolsIOSessionExportResult,
  ProtocolsIOSessionProtocolStatus,
  ProtocolsIOSessionService
} from '@noatgnu/cupcake-protocols-io';

import { ProtocolsIoBrowser } from '../protocols-io-browser/protocols-io-browser';

@Component({
  selector: 'app-protocols-io-session-export',
  imports: [DatePipe, FormsModule, RouterLink, ProtocolsIoBrowser],
  templateUrl: './protocols-io-session-export.html',
  styleUrl: './protocols-io-session-export.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProtocolsIoSessionExport implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private sessionService = inject(SessionService);
  private accountService = inject(ProtocolsIOAccountService);
  private protocolsIOSessionService = inject(ProtocolsIOSessionService);
  private taskMonitor = inject(AsyncTaskMonitorService);
  private toastService = inject(ToastService);

  sessionId = signal<number | null>(null);
  session = signal<Session | null>(null);
  connected = signal<boolean | null>(null);
  rows = signal<ProtocolsIOSessionProtocolStatus[] | null>(null);
  runs = signal<ProtocolsIORun[]>([]);
  selected = signal<Set<number>>(new Set());
  newRuns = signal(false);
  folder = signal<ProtocolsIOFolderEntry | null>(null);
  choosingFolder = signal(false);
  queuing = signal(false);
  taskId = signal<string | null>(null);

  task = computed(() => {
    const id = this.taskId();
    return id ? this.taskMonitor.tasks().find(task => task.id === id) ?? null : null;
  });
  finished = computed(() => {
    const status = this.task()?.status;
    return status === TaskStatus.SUCCESS || status === TaskStatus.FAILURE || status === TaskStatus.CANCELLED;
  });
  result = computed(() =>
    this.task()?.status === TaskStatus.SUCCESS ? (this.task()?.result as unknown as ProtocolsIOSessionExportResult) : null
  );
  progress = computed(() => Math.round(this.task()?.progressPercentage ?? 0));
  sessionTitle = computed(() => this.session()?.name || 'Session');
  createsRuns = computed(() =>
    (this.rows() ?? []).some(row => this.selected().has(row.protocol) && !this.updatesRun(row))
  );
  canExport = computed(() => this.selected().size > 0 && !this.queuing());

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!id) {
      this.router.navigate(['/protocols/sessions']);
      return;
    }
    this.sessionId.set(id);
    this.accountService.getStatus().subscribe({
      next: status => this.connected.set(status.connected),
      error: () => this.toastService.error('Failed to load the protocols.io account')
    });
    this.sessionService.getSession(id).subscribe({
      next: session => {
        this.session.set(session);
        this.loadProtocols(session);
      },
      error: () => {
        this.toastService.error('Failed to load the session');
        this.router.navigate(['/protocols/sessions']);
      }
    });
  }

  toggle(protocolId: number, checked: boolean): void {
    const next = new Set(this.selected());
    if (checked) {
      next.add(protocolId);
    } else {
      next.delete(protocolId);
    }
    this.selected.set(next);
  }

  exportable(row: ProtocolsIOSessionProtocolStatus): boolean {
    return row.protocolExport !== null || row.variedSteps > 0;
  }

  updatesRun(row: ProtocolsIOSessionProtocolStatus): boolean {
    return row.run !== null && row.runIsCurrent && !this.newRuns();
  }

  chooseFolder(folder: ProtocolsIOFolderEntry): void {
    this.folder.set(folder);
    this.choosingFolder.set(false);
  }

  clearFolder(): void {
    this.folder.set(null);
  }

  startExport(): void {
    const id = this.sessionId();
    if (!id || !this.canExport()) {
      return;
    }
    const protocols = (this.rows() ?? []).map(row => row.protocol).filter(protocolId => this.selected().has(protocolId));
    const sessionUrl = this.sessionAddress(id);
    this.queuing.set(true);
    this.protocolsIOSessionService.exportSession(id, {
      protocols,
      newRuns: this.newRuns(),
      ...(this.folder() ? { folder: this.folder()!.guid } : {}),
      ...(sessionUrl ? { sessionUrl } : {})
    }).subscribe({
      next: queued => {
        this.queuing.set(false);
        this.taskId.set(queued.taskId);
        this.taskMonitor.pollUntilComplete(queued.taskId);
      },
      error: (error: HttpErrorResponse) => {
        this.queuing.set(false);
        this.toastService.error(error.error?.error || 'Failed to start the export');
      }
    });
  }

  exportAgain(): void {
    this.taskId.set(null);
    const session = this.session();
    if (session) {
      this.loadProtocols(session);
    }
  }

  private loadProtocols(session: Session): void {
    forkJoin({
      status: this.protocolsIOSessionService.getStatus(session.id),
      runs: this.protocolsIOSessionService.getRuns(session.id).pipe(catchError(() => of([] as ProtocolsIORun[])))
    }).subscribe({
      next: ({ status, runs }) => {
        this.runs.set(runs);
        this.rows.set(status);
        this.selected.set(new Set(status.filter(row => this.exportable(row)).map(row => row.protocol)));
      },
      error: () => {
        this.rows.set([]);
        this.toastService.error('Failed to load the session protocols');
      }
    });
  }

  private sessionAddress(id: number): string | null {
    const origin = window.location.origin;
    if (!origin.startsWith('http://') && !origin.startsWith('https://')) {
      return null;
    }
    const path = this.router.serializeUrl(this.router.createUrlTree(['/protocols/sessions', id]));
    return `${origin}${window.location.pathname}#${path}`;
  }
}
