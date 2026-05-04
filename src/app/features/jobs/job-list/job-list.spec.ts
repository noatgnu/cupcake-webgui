import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal, WritableSignal } from '@angular/core';
import { of } from 'rxjs';
import { CUPCAKE_CORE_CONFIG, ToastService, AuthService } from '@noatgnu/cupcake-core';
import { InstrumentJobService, Status } from '@noatgnu/cupcake-macaron';
import { JobList } from './job-list';

describe('JobList', () => {
  let component: JobList;
  let fixture: ComponentFixture<JobList>;
  let mockInstrumentJobService: jasmine.SpyObj<InstrumentJobService>;
  let mockToastService: jasmine.SpyObj<ToastService>;
  let currentUserSignal: WritableSignal<any>;

  beforeEach(async () => {
    currentUserSignal = signal<any>(null);

    mockInstrumentJobService = jasmine.createSpyObj('InstrumentJobService', ['getInstrumentJobs']);
    mockInstrumentJobService.getInstrumentJobs.and.returnValue(of({ count: 0, results: [] }));

    mockToastService = jasmine.createSpyObj('ToastService', ['success', 'error', 'info', 'show']);

    const mockAuthService = jasmine.createSpyObj('AuthService', ['logout'], {
      currentUser: currentUserSignal
    });

    await TestBed.configureTestingModule({
      imports: [JobList],
      providers: [
        { provide: CUPCAKE_CORE_CONFIG, useValue: { apiUrl: 'http://localhost:8000' } },
        provideRouter([]),
        { provide: InstrumentJobService, useValue: mockInstrumentJobService },
        { provide: ToastService, useValue: mockToastService },
        { provide: AuthService, useValue: mockAuthService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(JobList);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('loadJobs() calls InstrumentJobService.getInstrumentJobs() on init', () => {
    expect(mockInstrumentJobService.getInstrumentJobs).toHaveBeenCalled();
  });

  it('jobs starts as empty array', () => {
    expect(component.jobs()).toEqual([]);
  });

  it('canEdit returns false when no job is selected', () => {
    expect(component.canEdit()).toBeFalse();
  });
});
