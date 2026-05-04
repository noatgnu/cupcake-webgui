import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal, WritableSignal } from '@angular/core';
import { of } from 'rxjs';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { CUPCAKE_CORE_CONFIG, ToastService, AuthService } from '@noatgnu/cupcake-core';
import { InstrumentJobService } from '@noatgnu/cupcake-macaron';
import { JobDetail } from './job-detail';

describe('JobDetail', () => {
  let component: JobDetail;
  let fixture: ComponentFixture<JobDetail>;
  let mockInstrumentJobService: jasmine.SpyObj<InstrumentJobService>;
  let mockToastService: jasmine.SpyObj<ToastService>;
  let currentUserSignal: WritableSignal<any>;

  beforeEach(async () => {
    currentUserSignal = signal<any>(null);

    mockInstrumentJobService = jasmine.createSpyObj('InstrumentJobService', ['getInstrumentJob', 'updateInstrumentJob']);
    mockToastService = jasmine.createSpyObj('ToastService', ['success', 'error', 'info', 'show']);

    const mockAuthService = jasmine.createSpyObj('AuthService', ['logout'], {
      currentUser: currentUserSignal
    });

    const mockModalService = jasmine.createSpyObj('NgbModal', ['open']);

    await TestBed.configureTestingModule({
      imports: [JobDetail],
      providers: [
        { provide: CUPCAKE_CORE_CONFIG, useValue: { apiUrl: 'http://localhost:8000' } },
        provideRouter([]),
        { provide: InstrumentJobService, useValue: mockInstrumentJobService },
        { provide: ToastService, useValue: mockToastService },
        { provide: AuthService, useValue: mockAuthService },
        { provide: NgbModal, useValue: mockModalService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(JobDetail);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('job signal starts as null', () => {
    expect(component.job()).toBeNull();
  });

  it('canEdit returns false when job is null', () => {
    expect(component.canEdit()).toBeFalse();
  });

  it('isDraft returns false when job is null', () => {
    expect(component.isDraft()).toBeFalse();
  });
});
