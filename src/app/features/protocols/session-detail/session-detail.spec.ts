import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Subject, of } from 'rxjs';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { CUPCAKE_CORE_CONFIG, ToastService, AuthService, SiteConfigService, ThemeService } from '@noatgnu/cupcake-core';
import {
  SessionService, ProtocolService, ProtocolSectionService, ProtocolStepService,
  StepReagentService, StepAnnotationService, TimeKeeperService, AnnotationChunkedUploadService,
  CCRVNotificationWebSocketService, InstrumentUsageStepAnnotationService, TimeKeeperWebSocketService
} from '@noatgnu/cupcake-red-velvet';
import { InstrumentUsageService, ReagentActionService, InstrumentService, ReagentService, ActionType } from '@noatgnu/cupcake-macaron';
import type { ReagentAction } from '@noatgnu/cupcake-macaron';
import { Websocket } from '@noatgnu/cupcake-vanilla';
import { SessionDetail } from './session-detail';

describe('SessionDetail', () => {
  let component: SessionDetail;
  let fixture: ComponentFixture<SessionDetail>;
  let timerEvents: Subject<any>;

  beforeEach(async () => {
    const mockSessionService = jasmine.createSpyObj('SessionService', ['getSession', 'getSessions']);
    const mockProtocolService = jasmine.createSpyObj('ProtocolService', ['getProtocol', 'getProtocols']);
    const mockSectionService = jasmine.createSpyObj('ProtocolSectionService', ['getSections']);
    const mockStepService = jasmine.createSpyObj('ProtocolStepService', ['getProtocolStep', 'getProtocolSteps']);
    const mockStepReagentService = jasmine.createSpyObj('StepReagentService', ['getStepReagents']);
    const mockStepAnnotationService = jasmine.createSpyObj('StepAnnotationService', ['getStepAnnotations']);
    const mockInstrumentUsageStepAnnotationService = jasmine.createSpyObj('InstrumentUsageStepAnnotationService', ['getLinks']);
    const mockInstrumentUsageService = jasmine.createSpyObj('InstrumentUsageService', ['getInstrumentUsage', 'createInstrumentUsage']);
    const mockInstrumentService = jasmine.createSpyObj('InstrumentService', ['getInstruments']);
    const mockReagentActionService = jasmine.createSpyObj('ReagentActionService', ['getReagentActions']);
    const mockReagentService = jasmine.createSpyObj('ReagentService', ['getReagents']);
    const mockTimeKeeperService = jasmine.createSpyObj('TimeKeeperService', ['getTimeKeepers', 'getTimeKeeper']);
    const mockAnnotationUploadService = jasmine.createSpyObj('AnnotationChunkedUploadService', ['uploadChunk']);
    const mockToastService = jasmine.createSpyObj('ToastService', ['success', 'error', 'info', 'show']);
    const mockModalService = jasmine.createSpyObj('NgbModal', ['open']);

    const mockAuthService = jasmine.createSpyObj('AuthService', ['getAccessToken', 'logout'], {
      currentUser: signal(null)
    });
    mockAuthService.getAccessToken.and.returnValue(null);

    const mockSiteConfigService = jasmine.createSpyObj('SiteConfigService', ['getSiteConfig'], {
      siteConfig: signal({ uiFeaturesWithDefaults: {} })
    });

    const mockThemeService = jasmine.createSpyObj('ThemeService', ['toggleMode'], {
      isDark: signal(false)
    });

    const mockNotificationWs = jasmine.createSpyObj('CCRVNotificationWebSocketService', ['connect', 'disconnect'], {
      transcriptionStarted$: new Subject<any>().asObservable(),
      transcriptionCompleted$: new Subject<any>().asObservable(),
      transcriptionFailed$: new Subject<any>().asObservable()
    });

    timerEvents = new Subject<any>();
    const mockTimeKeeperWs = jasmine.createSpyObj('TimeKeeperWebSocketService', ['connect', 'disconnect'], {
      messages$: timerEvents.asObservable()
    });

    const mockCCVWsService = jasmine.createSpyObj('Websocket', ['connect', 'disconnect', 'filterMessages']);
    mockCCVWsService.filterMessages.and.returnValue(new Subject<any>().asObservable());

    await TestBed.configureTestingModule({
      imports: [SessionDetail],
      providers: [
        { provide: CUPCAKE_CORE_CONFIG, useValue: { apiUrl: 'http://localhost:8000' } },
        provideRouter([]),
        provideHttpClient(withXhr()),
        provideHttpClientTesting(),
        { provide: NgbModal, useValue: mockModalService },
        { provide: SessionService, useValue: mockSessionService },
        { provide: ProtocolService, useValue: mockProtocolService },
        { provide: ProtocolSectionService, useValue: mockSectionService },
        { provide: ProtocolStepService, useValue: mockStepService },
        { provide: StepReagentService, useValue: mockStepReagentService },
        { provide: StepAnnotationService, useValue: mockStepAnnotationService },
        { provide: InstrumentUsageStepAnnotationService, useValue: mockInstrumentUsageStepAnnotationService },
        { provide: InstrumentUsageService, useValue: mockInstrumentUsageService },
        { provide: InstrumentService, useValue: mockInstrumentService },
        { provide: ReagentActionService, useValue: mockReagentActionService },
        { provide: ReagentService, useValue: mockReagentService },
        { provide: TimeKeeperService, useValue: mockTimeKeeperService },
        { provide: AnnotationChunkedUploadService, useValue: mockAnnotationUploadService },
        { provide: ToastService, useValue: mockToastService },
        { provide: AuthService, useValue: mockAuthService },
        { provide: SiteConfigService, useValue: mockSiteConfigService },
        { provide: ThemeService, useValue: mockThemeService },
        { provide: CCRVNotificationWebSocketService, useValue: mockNotificationWs },
        { provide: TimeKeeperWebSocketService, useValue: mockTimeKeeperWs },
        { provide: Websocket, useValue: mockCCVWsService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(SessionDetail);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('session signal starts as null', () => {
    expect(component.session()).toBeNull();
  });

  it('sections signal starts empty', () => {
    expect(component.sections()).toEqual([]);
  });

  it('loading signal starts as false', () => {
    expect(component.loading()).toBeFalse();
  });

  it('lists bookings under the step reagent they were made for, including alternatives', () => {
    spyOn(component as any, 'currentStep').and.returnValue({ id: 6 });
    const action = (id: number, reagent: number, stepReagent?: number) =>
      ({ id, reagent, quantity: 1, actionType: ActionType.RESERVE, stepReagent }) as ReagentAction;
    component.reagentActions.set(new Map([[6, [action(1, 100, 9), action(2, 200, 9), action(3, 100, 8), action(4, 100)]]]));
    component.storedReagentCache.set(new Map([[100, { reagent: 50 }], [200, { reagent: 70 }]]));

    const listed = component.getActionsForStepReagent({ id: 9, reagentId: 50 }).map(a => a.id);

    expect(listed).toEqual([1, 2, 4]);
  });

  it('reloads the session timers when a participant changes one of them', () => {
    component.session.set({ id: 3 } as any);
    const reload = spyOn(component, 'loadTimersFromBackend');
    component.setupTimerListeners();

    timerEvents.next({ type: 'timekeeper.started', timekeeperId: '1', sessionId: '3', startTime: '', timestamp: '' });
    timerEvents.next({ type: 'timekeeper.stopped', timekeeperId: '2', sessionId: '4', timestamp: '' });

    expect(reload).toHaveBeenCalledOnceWith(true);
  });

  it('ignores the echo of its own timer change and applies others right away', () => {
    component.session.set({ id: 3 } as any);
    const reload = spyOn(component, 'loadTimersFromBackend');
    component.timer.timeKeeper['5'] = { started: false, current: 590, previousStop: 590, duration: 600, startTime: 0 } as any;
    component.setupTimerListeners();

    timerEvents.next({ type: 'timekeeper.stopped', timekeeperId: '1', sessionId: '3', stepId: '5', duration: 590, timestamp: '' });
    expect(reload).not.toHaveBeenCalled();

    timerEvents.next({ type: 'timekeeper.started', timekeeperId: '1', sessionId: '3', stepId: '5', startTime: '', timestamp: '' });
    expect(reload).toHaveBeenCalledOnceWith(true);
  });

  it('shares annotation links through the session unique id', () => {
    const copy = spyOn(navigator.clipboard, 'writeText').and.returnValue(Promise.resolve());
    component.session.set({ id: 3, uniqueId: 'a1b2c3d4-0000-4000-8000-000000000000' } as any);

    component.shareAnnotation({ id: 7 } as any);

    expect(copy.calls.mostRecent().args[0]).toContain('/protocols/sessions/a1b2c3d4-0000-4000-8000-000000000000?annotationId=7');
  });
});
