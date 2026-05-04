import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { CUPCAKE_CORE_CONFIG } from '@noatgnu/cupcake-core';
import { InstrumentJobService } from '@noatgnu/cupcake-macaron';
import { ProjectService } from '@noatgnu/cupcake-red-velvet';
import { LabGroupService } from '@noatgnu/cupcake-core';
import { MetadataTableTemplateService } from '@noatgnu/cupcake-vanilla';
import { JobSubmissionStateService } from './job-submission-state';

describe('JobSubmissionStateService', () => {
  let service: JobSubmissionStateService;

  beforeEach(() => {
    const mockInstrumentJobService = jasmine.createSpyObj('InstrumentJobService', ['getInstrumentJobs']);
    mockInstrumentJobService.getInstrumentJobs.and.returnValue(of({ count: 0, results: [] }));

    const mockProjectService = jasmine.createSpyObj('ProjectService', ['getProjects']);
    mockProjectService.getProjects.and.returnValue(of({ count: 0, results: [] }));

    const mockLabGroupService = jasmine.createSpyObj('LabGroupService', ['getLabGroups', 'getLabGroupMembers']);
    mockLabGroupService.getLabGroups.and.returnValue(of({ count: 0, results: [] }));
    mockLabGroupService.getLabGroupMembers.and.returnValue(of({ count: 0, results: [] }));

    const mockTemplateService = jasmine.createSpyObj('MetadataTableTemplateService', ['getMetadataTableTemplates']);
    mockTemplateService.getMetadataTableTemplates.and.returnValue(of({ count: 0, results: [] }));

    TestBed.configureTestingModule({
      providers: [
        { provide: CUPCAKE_CORE_CONFIG, useValue: { apiUrl: 'http://localhost:8000' } },
        JobSubmissionStateService,
        { provide: InstrumentJobService, useValue: mockInstrumentJobService },
        { provide: ProjectService, useValue: mockProjectService },
        { provide: LabGroupService, useValue: mockLabGroupService },
        { provide: MetadataTableTemplateService, useValue: mockTemplateService }
      ]
    });
    service = TestBed.inject(JobSubmissionStateService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('jobId starts as null', () => {
    expect(service.jobId()).toBeNull();
  });

  it('selectedProjectId starts as null', () => {
    expect(service.selectedProjectId()).toBeNull();
  });

  it('selectedLabGroupId starts as null', () => {
    expect(service.selectedLabGroupId()).toBeNull();
  });

  it('sampleNumber starts as 1', () => {
    expect(service.sampleNumber()).toBe(1);
  });
});
