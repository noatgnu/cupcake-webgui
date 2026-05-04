import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { CUPCAKE_CORE_CONFIG } from '@noatgnu/cupcake-core';
import { InstrumentJobService } from '@noatgnu/cupcake-macaron';
import { SessionService } from '@noatgnu/cupcake-red-velvet';
import { ProjectDetail } from './project-detail';

describe('ProjectDetail', () => {
  let component: ProjectDetail;
  let fixture: ComponentFixture<ProjectDetail>;
  let mockInstrumentJobService: jasmine.SpyObj<InstrumentJobService>;
  let mockSessionService: jasmine.SpyObj<SessionService>;

  const mockProject = {
    id: 1,
    projectName: 'Test Project',
    projectDescription: 'Description',
    owner: 1,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01'
  };

  beforeEach(async () => {
    mockInstrumentJobService = jasmine.createSpyObj('InstrumentJobService', ['getInstrumentJobs']);
    mockInstrumentJobService.getInstrumentJobs.and.returnValue(of({ count: 0, results: [] }));

    mockSessionService = jasmine.createSpyObj('SessionService', ['getSessions']);
    mockSessionService.getSessions.and.returnValue(of({ count: 0, results: [] }));

    await TestBed.configureTestingModule({
      imports: [ProjectDetail],
      providers: [
        { provide: CUPCAKE_CORE_CONFIG, useValue: { apiUrl: 'http://localhost:8000' } },
        provideRouter([]),
        { provide: InstrumentJobService, useValue: mockInstrumentJobService },
        { provide: SessionService, useValue: mockSessionService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ProjectDetail);
    component = fixture.componentInstance;
    component.project = mockProject as any;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should call InstrumentJobService.getInstrumentJobs() on init', () => {
    expect(mockInstrumentJobService.getInstrumentJobs).toHaveBeenCalledWith(
      jasmine.objectContaining({ project: 1 })
    );
  });

  it('should call SessionService.getSessions() on init', () => {
    expect(mockSessionService.getSessions).toHaveBeenCalledWith(
      jasmine.objectContaining({ projects: 1 })
    );
  });

  it('jobs starts empty', () => {
    expect(component.jobs()).toEqual([]);
  });

  it('loadProjectData() does nothing when project has no id', () => {
    component.project = null as any;
    component.loadProjectData();
    expect(mockInstrumentJobService.getInstrumentJobs).toHaveBeenCalledTimes(1);
  });
});
