import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Subject, of } from 'rxjs';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { CUPCAKE_CORE_CONFIG, ToastService, AuthService, SiteConfigService, ThemeService } from '@noatgnu/cupcake-core';
import {
  SessionService, ProtocolService, ProtocolSectionService, ProtocolStepService,
  StepReagentService, StepAnnotationService, TimeKeeperService, AnnotationChunkedUploadService,
  CCRVNotificationWebSocketService, InstrumentUsageStepAnnotationService
} from '@noatgnu/cupcake-red-velvet';
import { InstrumentUsageService, ReagentActionService, InstrumentService, ReagentService } from '@noatgnu/cupcake-macaron';
import { Websocket } from '@noatgnu/cupcake-vanilla';
import { SessionDetail } from './session-detail';

describe('SessionDetail', () => {
  let component: SessionDetail;
  let fixture: ComponentFixture<SessionDetail>;

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

    const mockThemeService = jasmine.createSpyObj('ThemeService', ['toggleTheme'], {
      isDark: signal(false)
    });

    const mockNotificationWs = jasmine.createSpyObj('CCRVNotificationWebSocketService', ['connect', 'disconnect'], {
      transcriptionStarted$: new Subject<any>().asObservable(),
      transcriptionCompleted$: new Subject<any>().asObservable(),
      transcriptionFailed$: new Subject<any>().asObservable()
    });

    const mockCCVWsService = jasmine.createSpyObj('Websocket', ['connect', 'disconnect', 'filterMessages']);
    mockCCVWsService.filterMessages.and.returnValue(new Subject<any>().asObservable());

    await TestBed.configureTestingModule({
      imports: [SessionDetail],
      providers: [
        { provide: CUPCAKE_CORE_CONFIG, useValue: { apiUrl: 'http://localhost:8000' } },
        provideRouter([]),
        provideHttpClient(),
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
});
