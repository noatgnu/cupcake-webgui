import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { CUPCAKE_CORE_CONFIG, LabGroupService } from '@noatgnu/cupcake-core';
import { InstrumentJobService } from '@noatgnu/cupcake-macaron';
import { ProjectService } from '@noatgnu/cupcake-red-velvet';
import { MetadataTableTemplateService } from '@noatgnu/cupcake-vanilla';
import { JobSubmissionStateService } from '../../services/job-submission-state';
import { StepTwoLabGroupStaffComponent } from './step-two-lab-group-staff';

describe('StepTwoLabGroupStaffComponent', () => {
  let component: StepTwoLabGroupStaffComponent;
  let fixture: ComponentFixture<StepTwoLabGroupStaffComponent>;

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
      imports: [StepTwoLabGroupStaffComponent],
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

    fixture = TestBed.createComponent(StepTwoLabGroupStaffComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('canGoNext() returns false when selectedLabGroupId is null', () => {
    expect(component.canGoNext()).toBeFalse();
  });

  it('canGoNext() returns true when selectedLabGroupId is set', () => {
    component.state.selectedLabGroupId.set(1);
    expect(component.canGoNext()).toBeTrue();
  });
});
