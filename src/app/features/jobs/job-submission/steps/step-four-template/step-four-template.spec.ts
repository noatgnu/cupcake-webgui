import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { CUPCAKE_CORE_CONFIG, LabGroupService } from '@noatgnu/cupcake-core';
import { InstrumentJobService } from '@noatgnu/cupcake-macaron';
import { ProjectService } from '@noatgnu/cupcake-red-velvet';
import { MetadataTableTemplateService } from '@noatgnu/cupcake-vanilla';
import { JobSubmissionStateService } from '../../services/job-submission-state';
import { StepFourTemplateComponent } from './step-four-template';

describe('StepFourTemplateComponent', () => {
  let component: StepFourTemplateComponent;
  let fixture: ComponentFixture<StepFourTemplateComponent>;

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
      imports: [StepFourTemplateComponent],
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

    fixture = TestBed.createComponent(StepFourTemplateComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('canGoNext() returns false when selectedTemplateId is null', () => {
    expect(component.canGoNext()).toBeFalse();
  });

  it('canGoNext() returns true when selectedTemplateId is set', () => {
    component.state.selectedTemplateId.set(1);
    expect(component.canGoNext()).toBeTrue();
  });

  it('pages through all of a lab group\'s templates ten at a time', () => {
    const templates = Array.from({ length: 10 }, (_, index) => ({ id: index + 1, name: `template ${index + 1}` }));
    mockTemplateService.getMetadataTableTemplates.and.returnValue(of({ count: 23, results: templates }));
    component.state.loadLabGroupTemplates(4);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.template-list button').length).toBe(10);
    expect(fixture.nativeElement.querySelector('ngb-pagination')).not.toBeNull();
    component.state.goToTemplatePage(2);
    expect(mockTemplateService.getMetadataTableTemplates).toHaveBeenCalledWith(
      jasmine.objectContaining({ labGroupId: 4, limit: 10, offset: 20 })
    );
  });

  it('searches templates on the server', () => {
    component.state.loadLabGroupTemplates(4);
    component.state.templateSearch.set('phospho');
    component.state.loadTemplates();
    expect(mockTemplateService.getMetadataTableTemplates).toHaveBeenCalledWith(
      jasmine.objectContaining({ labGroupId: 4, search: 'phospho', offset: 0 })
    );
  });

  it('keeps the chosen template while browsing other pages', () => {
    component.state.selectTemplate({ id: 7, name: 'phospho samples' } as any);
    component.state.goToTemplatePage(1);
    expect(component.state.selectedTemplateId()).toBe(7);
    expect(component.state.selectedTemplate()?.name).toBe('phospho samples');
    expect(component.canGoNext()).toBeTrue();
  });
});
