import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Subject, of } from 'rxjs';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { CUPCAKE_CORE_CONFIG, ToastService, AuthService } from '@noatgnu/cupcake-core';
import {
  InstrumentJobAnnotationService,
  AnnotationChunkedUploadService,
  InstrumentUsageService,
  InstrumentUsageJobAnnotationService,
  InstrumentService,
  CCMNotificationWebSocketService
} from '@noatgnu/cupcake-macaron';
import { Websocket } from '@noatgnu/cupcake-vanilla';
import { JobAnnotationsSection } from './job-annotations-section';

describe('JobAnnotationsSection', () => {
  let component: JobAnnotationsSection;
  let fixture: ComponentFixture<JobAnnotationsSection>;

  beforeEach(async () => {
    const mockAnnotationService = jasmine.createSpyObj('InstrumentJobAnnotationService', ['getInstrumentJobAnnotations']);
    mockAnnotationService.getInstrumentJobAnnotations.and.returnValue(of({ count: 0, results: [] }));

    const mockChunkedUploadService = jasmine.createSpyObj('AnnotationChunkedUploadService', ['uploadChunk']);
    const mockInstrumentUsageService = jasmine.createSpyObj('InstrumentUsageService', ['getInstrumentUsage', 'createInstrumentUsage']);
    const mockUsageAnnotationLinkService = jasmine.createSpyObj('InstrumentUsageJobAnnotationService', ['createLink']);
    const mockInstrumentService = jasmine.createSpyObj('InstrumentService', ['getInstruments']);
    const mockToastService = jasmine.createSpyObj('ToastService', ['success', 'error', 'info', 'show']);
    const mockModalService = jasmine.createSpyObj('NgbModal', ['open']);

    const mockAuthService = jasmine.createSpyObj('AuthService', ['logout'], {
      currentUser: signal(null)
    });

    const mockCCMWsService = jasmine.createSpyObj('CCMNotificationWebSocketService', ['connect', 'disconnect'], {
      transcriptionStarted$: new Subject<any>().asObservable(),
      transcriptionCompleted$: new Subject<any>().asObservable()
    });

    const mockCCVWsService = jasmine.createSpyObj('Websocket', ['connect', 'disconnect', 'filterMessages']);
    mockCCVWsService.filterMessages.and.returnValue(new Subject<any>().asObservable());

    await TestBed.configureTestingModule({
      imports: [JobAnnotationsSection],
      providers: [
        { provide: CUPCAKE_CORE_CONFIG, useValue: { apiUrl: 'http://localhost:8000' } },
        { provide: InstrumentJobAnnotationService, useValue: mockAnnotationService },
        { provide: AnnotationChunkedUploadService, useValue: mockChunkedUploadService },
        { provide: InstrumentUsageService, useValue: mockInstrumentUsageService },
        { provide: InstrumentUsageJobAnnotationService, useValue: mockUsageAnnotationLinkService },
        { provide: InstrumentService, useValue: mockInstrumentService },
        { provide: ToastService, useValue: mockToastService },
        { provide: AuthService, useValue: mockAuthService },
        { provide: NgbModal, useValue: mockModalService },
        { provide: CCMNotificationWebSocketService, useValue: mockCCMWsService },
        { provide: Websocket, useValue: mockCCVWsService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(JobAnnotationsSection);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('jobId input defaults to unset', () => {
    expect(component.jobId).toBeUndefined();
  });
});
