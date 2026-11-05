import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { CUPCAKE_CORE_CONFIG, ToastService } from '@noatgnu/cupcake-core';
import { SessionService, ProtocolService, StepAnnotationService, SessionAnnotationService } from '@noatgnu/cupcake-red-velvet';
import { SessionList } from './session-list';

describe('SessionList', () => {
  let component: SessionList;
  let fixture: ComponentFixture<SessionList>;
  let mockSessionService: jasmine.SpyObj<SessionService>;
  let mockProtocolService: jasmine.SpyObj<ProtocolService>;
  let mockToastService: jasmine.SpyObj<ToastService>;
  let mockModalService: jasmine.SpyObj<NgbModal>;

  let mockStepAnnotationService: jasmine.SpyObj<StepAnnotationService>;
  let mockSessionAnnotationService: jasmine.SpyObj<SessionAnnotationService>;

  beforeEach(async () => {
    mockSessionService = jasmine.createSpyObj('SessionService', ['getSessions', 'deleteSession', 'updateSession']);
    mockSessionService.getSessions.and.returnValue(of({ count: 0, results: [] }));
    mockSessionService.deleteSession.and.returnValue(of(undefined));
    mockStepAnnotationService = jasmine.createSpyObj('StepAnnotationService', ['getAnnotationsForSession']);
    mockStepAnnotationService.getAnnotationsForSession.and.returnValue(of({ count: 2, results: [] }));
    mockSessionAnnotationService = jasmine.createSpyObj('SessionAnnotationService', ['getSessionAnnotations']);
    mockSessionAnnotationService.getSessionAnnotations.and.returnValue(of({ count: 1, results: [] }));

    mockProtocolService = jasmine.createSpyObj('ProtocolService', ['getProtocols', 'getProtocol']);
    mockProtocolService.getProtocols.and.returnValue(of({ count: 0, results: [] }));

    mockToastService = jasmine.createSpyObj('ToastService', ['show', 'success', 'error', 'info']);

    mockModalService = jasmine.createSpyObj('NgbModal', ['open']);

    await TestBed.configureTestingModule({
      imports: [SessionList],
      providers: [
        { provide: CUPCAKE_CORE_CONFIG, useValue: { apiUrl: 'http://localhost:8000' } },
        provideRouter([]),
        { provide: SessionService, useValue: mockSessionService },
        { provide: ProtocolService, useValue: mockProtocolService },
        { provide: StepAnnotationService, useValue: mockStepAnnotationService },
        { provide: SessionAnnotationService, useValue: mockSessionAnnotationService },
        { provide: ToastService, useValue: mockToastService },
        { provide: NgbModal, useValue: mockModalService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(SessionList);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should call getSessions on init via loadSessions', () => {
    expect(mockSessionService.getSessions).toHaveBeenCalled();
  });

  it('should start with empty sessions signal', () => {
    expect(component.sessions()).toEqual([]);
  });

  it('warns how many annotations and files go with the session before deleting it', () => {
    const ask = spyOn(window, 'confirm').and.returnValue(true);

    component.deleteSession(4, new Event('click'));

    expect(ask.calls.mostRecent().args[0]).toContain('up to 3 annotations and their uploaded files');
    expect(mockSessionService.deleteSession).toHaveBeenCalledWith(4);
  });

  it('keeps the session when the warning is cancelled', () => {
    spyOn(window, 'confirm').and.returnValue(false);

    component.deleteSession(4, new Event('click'));

    expect(mockSessionService.deleteSession).not.toHaveBeenCalled();
  });
});
