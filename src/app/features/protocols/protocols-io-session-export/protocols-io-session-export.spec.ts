import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal, WritableSignal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AsyncTaskMonitorService, AsyncTaskStatus, TaskStatus, TaskType, ToastService } from '@noatgnu/cupcake-core';
import { Session, SessionService } from '@noatgnu/cupcake-red-velvet';
import {
  ProtocolsIOAccountService,
  ProtocolsIOBrowseService,
  ProtocolsIOFolderEntry,
  ProtocolsIOProtocolExport,
  ProtocolsIORun,
  ProtocolsIOSessionProtocolStatus,
  ProtocolsIOSessionService
} from '@noatgnu/cupcake-protocols-io';

import { ProtocolsIoSessionExport } from './protocols-io-session-export';

describe('ProtocolsIoSessionExport', () => {
  let component: ProtocolsIoSessionExport;
  let fixture: ComponentFixture<ProtocolsIoSessionExport>;
  let sessionService: jasmine.SpyObj<SessionService>;
  let protocolsIOSessionService: jasmine.SpyObj<ProtocolsIOSessionService>;
  let accountService: jasmine.SpyObj<ProtocolsIOAccountService>;
  let toastService: jasmine.SpyObj<ToastService>;
  let tasks: WritableSignal<AsyncTaskStatus[]>;
  let taskMonitor: { tasks: WritableSignal<AsyncTaskStatus[]>; pollUntilComplete: jasmine.Spy };

  const lysisExport: ProtocolsIOProtocolExport = {
    id: 3, protocol: 12, session: null, variationHash: '', exportedBy: 5, exportedByUsername: 'toan', protocolsIoId: 340067,
    protocolsIoGuid: 'B5A1B282', protocolsIoUri: 'lysis-abc', protocolsIoUrl: 'https://www.protocols.io/view/lysis-abc',
    stepIds: [41, 42], exportedAt: '2026-10-19T14:02:11Z'
  };
  const lysisRun: ProtocolsIORun = {
    id: 4, session: 7, protocol: 12, protocolTitle: 'Lysis', protocolExport: 3, exportedBy: 5, exportedByUsername: 'toan',
    recordId: 523011, recordGuid: 'C9B15EBC', recordUrl: 'https://www.protocols.io/run/C9B15EBC', itemId: 1841500,
    title: 'Run 7 - Lysis', commentCount: 6, createdAt: '2026-10-19T15:10:00Z', exportedAt: '2026-10-19T15:12:30Z'
  };
  const lysis: ProtocolsIOSessionProtocolStatus = {
    protocol: 12, protocolTitle: 'Lysis', protocolExport: lysisExport, variedSteps: 0, run: lysisRun, runIsCurrent: true
  };
  const digest: ProtocolsIOSessionProtocolStatus = {
    protocol: 15, protocolTitle: 'Digest', protocolExport: null, variedSteps: 0, run: null, runIsCurrent: false
  };
  const folder: ProtocolsIOFolderEntry = {
    kind: 'folder', title: 'Toan Phung', guid: 'C5463D4B', parentGuid: null, hasSubfolders: false,
    workspace: { id: 59673, title: 'lrrk2' }
  };

  function task(status: TaskStatus, extra: Partial<AsyncTaskStatus> = {}): AsyncTaskStatus {
    return { id: 'task-1', taskType: TaskType.EXPORT_RUN_PROTOCOLS_IO, status, user: 5, createdAt: '2026-10-19T10:00:00Z', ...extra };
  }

  async function create(
    connected = true,
    status: ProtocolsIOSessionProtocolStatus[] = [lysis, digest],
    runs: ProtocolsIORun[] = [lysisRun]
  ): Promise<void> {
    accountService.getStatus.and.returnValue(of({ connected }));
    protocolsIOSessionService.getStatus.and.returnValue(of(status));
    protocolsIOSessionService.getRuns.and.returnValue(of(runs));
    await TestBed.configureTestingModule({
      imports: [ProtocolsIoSessionExport],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: '7' }) } } },
        { provide: SessionService, useValue: sessionService },
        { provide: ProtocolsIOSessionService, useValue: protocolsIOSessionService },
        { provide: ProtocolsIOAccountService, useValue: accountService },
        { provide: ProtocolsIOBrowseService, useValue: jasmine.createSpyObj('ProtocolsIOBrowseService', { getWorkspaces: of({ items: [], page: 1, totalPages: 1, totalResults: 0, hasNext: false }) }) },
        { provide: AsyncTaskMonitorService, useValue: taskMonitor },
        { provide: ToastService, useValue: toastService }
      ]
    }).compileComponents();
    fixture = TestBed.createComponent(ProtocolsIoSessionExport);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  function element(selector: string): HTMLElement | null {
    fixture.detectChanges();
    return fixture.nativeElement.querySelector(selector);
  }

  function elements(selector: string): HTMLElement[] {
    fixture.detectChanges();
    return Array.from(fixture.nativeElement.querySelectorAll(selector));
  }

  beforeEach(() => {
    sessionService = jasmine.createSpyObj('SessionService', ['getSession']);
    protocolsIOSessionService = jasmine.createSpyObj('ProtocolsIOSessionService', ['exportSession', 'getStatus', 'getRuns']);
    sessionService.getSession.and.returnValue(of({ id: 7, name: 'Run 7', protocols: [12, 15] } as Session));
    accountService = jasmine.createSpyObj('ProtocolsIOAccountService', ['getStatus']);
    toastService = jasmine.createSpyObj('ToastService', ['success', 'error', 'warning', 'info']);
    tasks = signal<AsyncTaskStatus[]>([]);
    taskMonitor = { tasks, pollUntilComplete: jasmine.createSpy('pollUntilComplete') };
  });

  it('should point to the account page without a connected account', async () => {
    await create(false);
    expect(element('.not-connected')).toBeTruthy();
    expect(element('.start-export')).toBeNull();
  });

  it('should select exported protocols and link unexported ones to the protocol export', async () => {
    await create();
    const rows = elements('.protocol-row');
    expect(rows.length).toBe(2);
    expect(component.selected()).toEqual(new Set([12]));
    expect(rows[0].querySelector('.existing-run')?.textContent).toContain('Run 7 - Lysis');
    expect((rows[1].querySelector('input') as HTMLInputElement).disabled).toBeTrue();
    expect(rows[1].querySelector('.export-protocol')).toBeTruthy();
  });

  it('should allow protocols with varied steps that were never exported', async () => {
    await create(true, [lysis, { ...digest, variedSteps: 2 }]);
    const rows = elements('.protocol-row');
    expect(component.selected()).toEqual(new Set([12, 15]));
    expect((rows[1].querySelector('input') as HTMLInputElement).disabled).toBeFalse();
    expect(rows[1].querySelector('.varied-steps')?.textContent).toContain('2 step(s) varied');
    expect(rows[1].querySelector('.export-protocol')).toBeNull();
  });

  it('should start a new run when the variations changed since the last run', async () => {
    await create(true, [{ ...lysis, variedSteps: 1, runIsCurrent: false }, digest]);
    const rows = elements('.protocol-row');
    expect(rows[0].querySelector('.existing-run')).toBeNull();
    expect(rows[0].querySelector('.outdated-run')).toBeTruthy();
    expect(component.createsRuns()).toBeTrue();
  });

  it('should only offer a folder when a run will be created', async () => {
    await create();
    expect(element('.run-folder')).toBeNull();
    component.newRuns.set(true);
    expect(element('.run-folder')).toBeTruthy();
    component.choosingFolder.set(true);
    expect(element('app-protocols-io-browser')).toBeTruthy();
    component.chooseFolder(folder);
    expect(element('app-protocols-io-browser')).toBeNull();
    expect(element('.run-folder')?.textContent).toContain('Toan Phung');
  });

  it('should queue the export with the chosen options and follow the task', async () => {
    protocolsIOSessionService.exportSession.and.returnValue(of({ taskId: 'task-1', message: 'queued' }));
    await create(true, [{ ...lysis, run: null, runIsCurrent: false }, digest], []);
    component.chooseFolder(folder);
    (element('.start-export') as HTMLButtonElement).click();
    const [sessionId, request] = protocolsIOSessionService.exportSession.calls.mostRecent().args;
    expect(sessionId).toBe(7);
    expect(request?.protocols).toEqual([12]);
    expect(request?.newRuns).toBeFalse();
    expect(request?.folder).toBe('C5463D4B');
    expect(taskMonitor.pollUntilComplete).toHaveBeenCalledWith('task-1');
  });

  it('should show progress and then each exported run', async () => {
    protocolsIOSessionService.exportSession.and.returnValue(of({ taskId: 'task-1', message: 'queued' }));
    await create();
    component.startExport();
    tasks.set([task(TaskStatus.STARTED, { progressDescription: 'Exporting comment 1 of 3', progressPercentage: 40 })]);
    expect(element('.progress')).toBeTruthy();
    tasks.set([task(TaskStatus.SUCCESS, {
      result: {
        success: true,
        runs: [{
          runId: 4, protocolId: 12, recordGuid: 'C9B15EBC', recordUrl: 'https://www.protocols.io/run/C9B15EBC',
          title: 'Run 7 - Lysis', created: false, variationsUsed: 2,
          protocolCopyUrl: 'https://www.protocols.io/view/lysis-copy', commentsAdded: 1, commentsUpdated: 2, commentsDeleted: 0,
          commentsUnchanged: 3, filesUploaded: 1, warnings: ['File big.mp4 is larger than the upload limit and was left out']
        }]
      } as unknown as Record<string, unknown>
    })]);
    const runs = element('.export-runs');
    expect(runs?.textContent).toContain('1 added, 2 updated');
    expect(runs?.querySelector('a')?.getAttribute('href')).toBe('https://www.protocols.io/run/C9B15EBC');
    expect(element('.export-warning')?.textContent).toContain('big.mp4');
    expect(element('.protocol-copy a')?.getAttribute('href')).toBe('https://www.protocols.io/view/lysis-copy');
  });

  it('should report a failed export', async () => {
    protocolsIOSessionService.exportSession.and.returnValue(of({ taskId: 'task-1', message: 'queued' }));
    await create();
    component.startExport();
    tasks.set([task(TaskStatus.FAILURE, { errorMessage: 'The protocol changed in Cupcake since it was exported' })]);
    expect(element('.export-failure')?.textContent).toContain('changed in Cupcake');
  });

  it('should show the error when the export cannot be queued', async () => {
    protocolsIOSessionService.exportSession.and.returnValue(
      throwError(() => new HttpErrorResponse({ status: 400, error: { error: 'Connect a protocols.io account first' } }))
    );
    await create();
    component.startExport();
    expect(toastService.error).toHaveBeenCalledWith('Connect a protocols.io account first');
    expect(component.taskId()).toBeNull();
  });

  it('should list earlier runs of the session', async () => {
    await create();
    expect(element('.session-runs')?.textContent).toContain('Run 7 - Lysis');
  });
});
