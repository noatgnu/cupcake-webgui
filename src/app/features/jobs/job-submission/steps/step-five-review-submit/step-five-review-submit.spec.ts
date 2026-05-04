import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { CUPCAKE_CORE_CONFIG, LabGroupService } from '@noatgnu/cupcake-core';
import { InstrumentJobService } from '@noatgnu/cupcake-macaron';
import { ProjectService } from '@noatgnu/cupcake-red-velvet';
import { MetadataTableTemplateService } from '@noatgnu/cupcake-vanilla';
import { JobSubmissionStateService } from '../../services/job-submission-state';
import { StepFiveReviewSubmitComponent } from './step-five-review-submit';

describe('StepFiveReviewSubmitComponent', () => {
  let component: StepFiveReviewSubmitComponent;
  let fixture: ComponentFixture<StepFiveReviewSubmitComponent>;

  const mockInstrumentJobService = jasmine.createSpyObj('InstrumentJobService', ['getInstrumentJobs']);
  mockInstrumentJobService.getInstrumentJobs.and.returnValue(of({ count: 0, results: [] }));

  const mockProjectService = jasmine.createSpyObj('ProjectService', ['getProjects']);
  mockProjectService.getProjects.and.returnValue(of({ count: 0, results: [] }));

  const mockLabGroupService = jasmine.createSpyObj('LabGroupService', ['getLabGroups', 'getLabGroupMembers']);
  mockLabGroupService.getLabGroups.and.returnValue(of({ count: 0, results: [] }));
  mockLabGroupService.getLabGroupMembers.and.returnValue(of({ count: 0, results: [] }));

  const mockTemplateService = jasmine.createSpyObj('MetadataTableTemplateService', ['getMetadataTableTemplates']);
  mockTemplateService.getMetadataTableTemplates.and.returnValue(of({ count: 0, results: [] }));

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StepFiveReviewSubmitComponent],
      providers: [
        { provide: CUPCAKE_CORE_CONFIG, useValue: { apiUrl: 'http://localhost:8000' } },
        JobSubmissionStateService,
        { provide: InstrumentJobService, useValue: mockInstrumentJobService },
        { provide: ProjectService, useValue: mockProjectService },
        { provide: LabGroupService, useValue: mockLabGroupService },
        { provide: MetadataTableTemplateService, useValue: mockTemplateService }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(StepFiveReviewSubmitComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('state.metadataTableCreated() starts as false', () => {
    expect(component.state.metadataTableCreated()).toBeFalse();
  });
});
