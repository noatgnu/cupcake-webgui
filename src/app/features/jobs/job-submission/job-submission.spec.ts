import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { CUPCAKE_CORE_CONFIG, ToastService, LabGroupService } from '@noatgnu/cupcake-core';
import { InstrumentJobService } from '@noatgnu/cupcake-macaron';
import { ProjectService } from '@noatgnu/cupcake-red-velvet';
import { MetadataTableTemplateService } from '@noatgnu/cupcake-vanilla';
import { JobSubmission } from './job-submission';

describe('JobSubmission', () => {
  let component: JobSubmission;
  let fixture: ComponentFixture<JobSubmission>;

  beforeEach(async () => {
    const mockInstrumentJobService = jasmine.createSpyObj('InstrumentJobService', [
      'getInstrumentJob', 'getInstrumentJobs', 'createInstrumentJob', 'updateInstrumentJob'
    ]);
    mockInstrumentJobService.getInstrumentJobs.and.returnValue(of({ count: 0, results: [] }));

    const mockProjectService = jasmine.createSpyObj('ProjectService', ['getProject', 'getProjects', 'createProject']);
    mockProjectService.getProjects.and.returnValue(of({ count: 0, results: [] }));

    const mockToastService = jasmine.createSpyObj('ToastService', ['success', 'error', 'info', 'show']);

    const mockLabGroupService = jasmine.createSpyObj('LabGroupService', ['getLabGroups', 'getLabGroupMembers']);
    mockLabGroupService.getLabGroups.and.returnValue(of({ count: 0, results: [] }));
    mockLabGroupService.getLabGroupMembers.and.returnValue(of({ count: 0, results: [] }));

    const mockTemplateService = jasmine.createSpyObj('MetadataTableTemplateService', ['getMetadataTableTemplates']);
    mockTemplateService.getMetadataTableTemplates.and.returnValue(of({ count: 0, results: [] }));

    await TestBed.configureTestingModule({
      imports: [JobSubmission],
      providers: [
        { provide: CUPCAKE_CORE_CONFIG, useValue: { apiUrl: 'http://localhost:8000' } },
        provideRouter([]),
        { provide: InstrumentJobService, useValue: mockInstrumentJobService },
        { provide: ProjectService, useValue: mockProjectService },
        { provide: ToastService, useValue: mockToastService },
        { provide: LabGroupService, useValue: mockLabGroupService },
        { provide: MetadataTableTemplateService, useValue: mockTemplateService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(JobSubmission);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('currentStep starts at 1', () => {
    expect(component.currentStep()).toBe(1);
  });

  it('totalSteps is 6', () => {
    expect(component.totalSteps).toBe(6);
  });
});
