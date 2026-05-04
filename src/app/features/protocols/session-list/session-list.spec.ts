import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { CUPCAKE_CORE_CONFIG, ToastService } from '@noatgnu/cupcake-core';
import { SessionService, ProtocolService } from '@noatgnu/cupcake-red-velvet';
import { SessionList } from './session-list';

describe('SessionList', () => {
  let component: SessionList;
  let fixture: ComponentFixture<SessionList>;
  let mockSessionService: jasmine.SpyObj<SessionService>;
  let mockProtocolService: jasmine.SpyObj<ProtocolService>;
  let mockToastService: jasmine.SpyObj<ToastService>;
  let mockModalService: jasmine.SpyObj<NgbModal>;

  beforeEach(async () => {
    mockSessionService = jasmine.createSpyObj('SessionService', ['getSessions', 'deleteSession', 'updateSession']);
    mockSessionService.getSessions.and.returnValue(of({ count: 0, results: [] }));

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
});
