import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { CUPCAKE_CORE_CONFIG } from '@noatgnu/cupcake-core';
import { LabGroupService } from '@noatgnu/cupcake-core';
import { InstrumentJobService } from '@noatgnu/cupcake-macaron';
import { ProjectService } from '@noatgnu/cupcake-red-velvet';
import { MetadataTableTemplateService } from '@noatgnu/cupcake-vanilla';
import { JobSubmissionStateService } from '../../services/job-submission-state';
import { StepOneJobProjectComponent } from './step-one-job-project';

describe('StepOneJobProjectComponent', () => {
  let component: StepOneJobProjectComponent;
  let fixture: ComponentFixture<StepOneJobProjectComponent>;

  beforeEach(async () => {
    const mockInstrumentJobService = jasmine.createSpyObj('InstrumentJobService', ['getInstrumentJobs']);
    mockInstrumentJobService.getInstrumentJobs.and.returnValue(of({ count: 0, results: [] }));

    const mockProjectService = jasmine.createSpyObj('ProjectService', ['getProjects']);
    mockProjectService.getProjects.and.returnValue(of({ count: 0, results: [] }));

    const mockLabGroupService = jasmine.createSpyObj('LabGroupService', ['getLabGroups', 'getLabGroupMembers']);
    mockLabGroupService.getLabGroups.and.returnValue(of({ count: 0, results: [] }));
    mockLabGroupService.getLabGroupMembers.and.returnValue(of({ count: 0, results: [] }));

    const mockTemplateService = jasmine.createSpyObj('MetadataTableTemplateService', ['getMetadataTableTemplates']);
    mockTemplateService.getMetadataTableTemplates.and.returnValue(of({ count: 0, results: [] }));

    await TestBed.configureTestingModule({
      imports: [StepOneJobProjectComponent],
      providers: [
        { provide: CUPCAKE_CORE_CONFIG, useValue: { apiUrl: 'http://localhost:8000' } },
        JobSubmissionStateService,
        { provide: InstrumentJobService, useValue: mockInstrumentJobService },
        { provide: ProjectService, useValue: mockProjectService },
        { provide: LabGroupService, useValue: mockLabGroupService },
        { provide: MetadataTableTemplateService, useValue: mockTemplateService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(StepOneJobProjectComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('canCreateDraft() returns false when jobTitle or projectTitle is empty', () => {
    expect(component.canCreateDraft()).toBeFalse();
  });

  it('canGoNext() returns false when jobTitle is empty', () => {
    expect(component.canGoNext()).toBeFalse();
  });

  it('canGoNext() returns true when both titles are set', () => {
    component.state.jobTitle.set('Test Job');
    component.state.projectTitle.set('Test Project');
    expect(component.canGoNext()).toBeTrue();
  });
});
