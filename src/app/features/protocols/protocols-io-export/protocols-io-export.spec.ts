import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal, WritableSignal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AsyncTaskMonitorService, AsyncTaskStatus, TaskStatus, TaskType, ToastService } from '@noatgnu/cupcake-core';
import { ProtocolModel, ProtocolService } from '@noatgnu/cupcake-red-velvet';
import {
  ProtocolsIOAccountService,
  ProtocolsIOBrowseService,
  ProtocolsIOProtocolEntry,
  ProtocolsIOProtocolService
} from '@noatgnu/cupcake-protocols-io';

import { ProtocolsIoExport } from './protocols-io-export';

describe('ProtocolsIoExport', () => {
  let component: ProtocolsIoExport;
  let fixture: ComponentFixture<ProtocolsIoExport>;
  let protocolService: jasmine.SpyObj<ProtocolService>;
  let protocolsIOProtocolService: jasmine.SpyObj<ProtocolsIOProtocolService>;
  let accountService: jasmine.SpyObj<ProtocolsIOAccountService>;
  let toastService: jasmine.SpyObj<ToastService>;
  let tasks: WritableSignal<AsyncTaskStatus[]>;
  let taskMonitor: { tasks: WritableSignal<AsyncTaskStatus[]>; pollUntilComplete: jasmine.Spy };

  const entry: ProtocolsIOProtocolEntry = {
    kind: 'protocol', title: 'Cupcake export test', id: 340067, uri: 'cupcake-export-test-kqcbcvssp',
    protocolType: 'protocol', importable: true, lastModified: null, workspace: { id: 59673, title: 'lrrk2' }
  };

  function task(status: TaskStatus, extra: Partial<AsyncTaskStatus> = {}): AsyncTaskStatus {
    return { id: 'task-1', taskType: TaskType.EXPORT_PROTOCOLS_IO, status, user: 1, createdAt: '2026-10-19T10:00:00Z', ...extra };
  }

  async function create(connected = true): Promise<void> {
    accountService.getStatus.and.returnValue(of({ connected }));
    await TestBed.configureTestingModule({
      imports: [ProtocolsIoExport],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: '12' }) } } },
        { provide: ProtocolService, useValue: protocolService },
        { provide: ProtocolsIOProtocolService, useValue: protocolsIOProtocolService },
        { provide: ProtocolsIOAccountService, useValue: accountService },
        { provide: ProtocolsIOBrowseService, useValue: jasmine.createSpyObj('ProtocolsIOBrowseService', { getWorkspaces: of({ items: [], page: 1, totalPages: 1, totalResults: 0, hasNext: false }) }) },
        { provide: AsyncTaskMonitorService, useValue: taskMonitor },
        { provide: ToastService, useValue: toastService }
      ]
    }).compileComponents();
    fixture = TestBed.createComponent(ProtocolsIoExport);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  function element(selector: string): HTMLElement | null {
    fixture.detectChanges();
    return fixture.nativeElement.querySelector(selector);
  }

  beforeEach(() => {
    protocolService = jasmine.createSpyObj('ProtocolService', ['getProtocol']);
    protocolsIOProtocolService = jasmine.createSpyObj('ProtocolsIOProtocolService', ['exportProtocol']);
    protocolService.getProtocol.and.returnValue(of({ id: 12, protocolTitle: 'Cell lysis' } as ProtocolModel));
    accountService = jasmine.createSpyObj('ProtocolsIOAccountService', ['getStatus']);
    toastService = jasmine.createSpyObj('ToastService', ['success', 'error', 'warning', 'info']);
    tasks = signal<AsyncTaskStatus[]>([]);
    taskMonitor = { tasks, pollUntilComplete: jasmine.createSpy('pollUntilComplete') };
  });

  it('should point to the account page without a connected account', async () => {
    await create(false);
    expect(element('.not-connected')).toBeTruthy();
    expect(element('app-protocols-io-browser')).toBeNull();
  });

  it('should confirm the chosen target with its workspace before exporting', async () => {
    await create();
    expect(element('app-protocols-io-browser')).toBeTruthy();
    component.chooseProtocol(entry);
    const confirmation = element('.confirm-target')?.textContent || '';
    expect(confirmation).toContain('Cupcake export test');
    expect(confirmation).toContain('lrrk2');
    expect(protocolsIOProtocolService.exportProtocol).not.toHaveBeenCalled();
    expect(element('app-protocols-io-browser')).toBeNull();
  });

  it('should accept a pasted address', async () => {
    await create();
    component.pastedAddress.set('  https://www.protocols.io/edit/lysis-abc  ');
    component.usePastedAddress();
    expect(component.target()).toEqual({ reference: 'https://www.protocols.io/edit/lysis-abc', title: 'https://www.protocols.io/edit/lysis-abc', workspace: null });
  });

  it('should queue the export and follow its task', async () => {
    await create();
    protocolsIOProtocolService.exportProtocol.and.returnValue(of({ taskId: 'task-1', message: 'protocols.io export queued' }));
    component.chooseProtocol(entry);
    component.scalingFactor.set(2);
    component.startExport();
    expect(protocolsIOProtocolService.exportProtocol).toHaveBeenCalledWith(12, { target: 'cupcake-export-test-kqcbcvssp', scalingFactor: 2 });
    expect(taskMonitor.pollUntilComplete).toHaveBeenCalledWith('task-1');
    tasks.set([task(TaskStatus.STARTED, { progressPercentage: 50, progressDescription: 'Saving steps' })]);
    expect(element('.progress-bar')?.style.width).toBe('50%');
    expect(fixture.nativeElement.textContent).toContain('Saving steps');
  });

  it('should show the result and warnings when the export succeeds', async () => {
    await create();
    component.taskId.set('task-1');
    tasks.set([task(TaskStatus.SUCCESS, {
      result: {
        success: true, protocolUri: 'cupcake-export-test-kqcbcvssp', protocolUrl: 'https://www.protocols.io/view/cupcake-export-test-kqcbcvssp',
        stepsSaved: 3, stepsDeleted: ['A'], imagesUploaded: 1, warnings: ['1 step(s) outside any section were not exported'], unresolvedTemplates: []
      }
    })]);
    expect(element('.export-success')?.textContent).toContain('Exported 3 step(s)');
    expect(element('.export-warnings')?.textContent).toContain('outside any section');
  });

  it('should show why an export failed', async () => {
    await create();
    component.taskId.set('task-1');
    tasks.set([task(TaskStatus.FAILURE, { errorMessage: 'protocols.io export failed: protocol does not exist' })]);
    expect(element('.export-failure')?.textContent).toContain('protocol does not exist');
  });

  it('should refuse a scaling factor that is not positive', async () => {
    await create();
    component.chooseProtocol(entry);
    component.scalingFactor.set(0);
    component.startExport();
    expect(protocolsIOProtocolService.exportProtocol).not.toHaveBeenCalled();
    expect(toastService.warning).toHaveBeenCalled();
  });

  it('should report an export that could not be queued', async () => {
    await create();
    protocolsIOProtocolService.exportProtocol.and.returnValue(throwError(() => new HttpErrorResponse({
      status: 400, error: { error: 'Connect a protocols.io account first' }
    })));
    component.chooseProtocol(entry);
    component.startExport();
    expect(toastService.error).toHaveBeenCalledWith('Connect a protocols.io account first');
    expect(component.queuing()).toBeFalse();
    expect(component.taskId()).toBeNull();
  });
});
