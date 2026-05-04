import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { CUPCAKE_CORE_CONFIG, ToastService } from '@noatgnu/cupcake-core';
import { ProjectService, SessionService } from '@noatgnu/cupcake-red-velvet';
import { InstrumentJobService } from '@noatgnu/cupcake-macaron';
import { Projects } from './projects';

describe('Projects', () => {
  let component: Projects;
  let fixture: ComponentFixture<Projects>;
  let mockProjectService: jasmine.SpyObj<ProjectService>;
  let mockToastService: jasmine.SpyObj<ToastService>;
  let mockModalService: jasmine.SpyObj<NgbModal>;

  const mockProjects = [
    { id: 1, projectName: 'Project A', owner: 1, createdAt: '2024-01-01', updatedAt: '2024-01-01' },
    { id: 2, projectName: 'Project B', owner: 1, createdAt: '2024-01-02', updatedAt: '2024-01-02' }
  ];

  beforeEach(async () => {
    mockProjectService = jasmine.createSpyObj('ProjectService', ['getProjects']);
    mockProjectService.getProjects.and.returnValue(of({ count: 2, results: mockProjects as any }));

    mockToastService = jasmine.createSpyObj('ToastService', ['success', 'error', 'info', 'show']);
    mockModalService = jasmine.createSpyObj('NgbModal', ['open']);

    const mockInstrumentJobService = jasmine.createSpyObj('InstrumentJobService', ['getInstrumentJobs']);
    mockInstrumentJobService.getInstrumentJobs.and.returnValue(of({ count: 0, results: [] }));

    const mockSessionService = jasmine.createSpyObj('SessionService', ['getSessions']);
    mockSessionService.getSessions.and.returnValue(of({ count: 0, results: [] }));

    await TestBed.configureTestingModule({
      imports: [Projects],
      providers: [
        { provide: CUPCAKE_CORE_CONFIG, useValue: { apiUrl: 'http://localhost:8000' } },
        provideRouter([]),
        { provide: ProjectService, useValue: mockProjectService },
        { provide: ToastService, useValue: mockToastService },
        { provide: NgbModal, useValue: mockModalService },
        { provide: InstrumentJobService, useValue: mockInstrumentJobService },
        { provide: SessionService, useValue: mockSessionService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(Projects);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('loadProjects() calls ProjectService.getProjects() on init', () => {
    expect(mockProjectService.getProjects).toHaveBeenCalled();
  });

  it('should populate projects and totalCount on load', () => {
    expect(component.projects().length).toBe(2);
    expect(component.totalCount()).toBe(2);
  });

  it('selectProject() sets selectedProject', () => {
    component.selectProject(mockProjects[0] as any);
    expect(component.selectedProject()).toEqual(mockProjects[0] as any);
  });

  it('deselectProject() clears selectedProject', () => {
    component.selectedProject.set(mockProjects[0] as any);
    component.deselectProject();
    expect(component.selectedProject()).toBeNull();
  });

  it('createProject() opens NgbModal', () => {
    mockModalService.open.and.returnValue({ componentInstance: {}, result: Promise.resolve(null) } as any);
    component.createProject();
    expect(mockModalService.open).toHaveBeenCalled();
  });
});
