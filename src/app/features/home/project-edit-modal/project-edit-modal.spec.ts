import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { of } from 'rxjs';
import { CUPCAKE_CORE_CONFIG, ToastService } from '@noatgnu/cupcake-core';
import { ProjectService } from '@noatgnu/cupcake-red-velvet';
import { ProjectEditModal } from './project-edit-modal';

describe('ProjectEditModal', () => {
  let component: ProjectEditModal;
  let fixture: ComponentFixture<ProjectEditModal>;
  let mockProjectService: jasmine.SpyObj<ProjectService>;
  let mockToastService: jasmine.SpyObj<ToastService>;
  let mockActiveModal: jasmine.SpyObj<NgbActiveModal>;

  const mockProject = {
    id: 1,
    projectName: 'Test Project',
    projectDescription: 'Description',
    owner: 1,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01'
  };

  beforeEach(async () => {
    mockProjectService = jasmine.createSpyObj('ProjectService', ['createProject', 'updateProject']);
    mockToastService = jasmine.createSpyObj('ToastService', ['success', 'error', 'info', 'show']);
    mockActiveModal = jasmine.createSpyObj('NgbActiveModal', ['close', 'dismiss']);

    await TestBed.configureTestingModule({
      imports: [ProjectEditModal],
      providers: [
        { provide: CUPCAKE_CORE_CONFIG, useValue: { apiUrl: 'http://localhost:8000' } },
        { provide: NgbActiveModal, useValue: mockActiveModal },
        { provide: ProjectService, useValue: mockProjectService },
        { provide: ToastService, useValue: mockToastService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ProjectEditModal);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('mode defaults to create', () => {
    expect(component.mode).toBe('create');
  });

  it('save() shows error when project name is empty', () => {
    component.projectName.set('');
    component.save();
    expect(mockToastService.error).toHaveBeenCalledWith('Project name is required');
    expect(mockProjectService.createProject).not.toHaveBeenCalled();
  });

  it('save() calls createProject() in create mode', () => {
    mockProjectService.createProject.and.returnValue(of(mockProject as any));
    component.projectName.set('New Project');
    component.save();
    expect(mockProjectService.createProject).toHaveBeenCalled();
    expect(mockActiveModal.close).toHaveBeenCalledWith(mockProject);
  });

  it('save() calls updateProject() in edit mode', () => {
    mockProjectService.updateProject.and.returnValue(of(mockProject as any));
    component.mode = 'edit';
    component.project = mockProject as any;
    component.projectName.set('Updated Project');
    component.save();
    expect(mockProjectService.updateProject).toHaveBeenCalledWith(1, jasmine.any(Object));
    expect(mockActiveModal.close).toHaveBeenCalled();
  });

  it('ngOnInit() populates fields from project in edit mode', () => {
    component.mode = 'edit';
    component.project = mockProject as any;
    component.ngOnInit();
    expect(component.projectName()).toBe('Test Project');
    expect(component.projectDescription()).toBe('Description');
  });

  it('cancel() calls activeModal.dismiss()', () => {
    component.cancel();
    expect(mockActiveModal.dismiss).toHaveBeenCalled();
  });
});
