import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { CUPCAKE_CORE_CONFIG, ToastService } from '@noatgnu/cupcake-core';
import { MaintenanceService, MaintenanceType, Status } from '@noatgnu/cupcake-macaron';
import { MaintenanceLogEditModal } from './maintenance-log-edit-modal';

describe('MaintenanceLogEditModal', () => {
  let component: MaintenanceLogEditModal;
  let fixture: ComponentFixture<MaintenanceLogEditModal>;
  let mockMaintenanceService: jasmine.SpyObj<MaintenanceService>;
  let mockToastService: jasmine.SpyObj<ToastService>;
  let mockActiveModal: jasmine.SpyObj<NgbActiveModal>;

  beforeEach(async () => {
    mockMaintenanceService = jasmine.createSpyObj('MaintenanceService', [
      'createMaintenanceLog', 'updateMaintenanceLog', 'getMaintenanceTemplates'
    ]);
    mockMaintenanceService.getMaintenanceTemplates.and.returnValue(of({ count: 0, results: [] }));

    mockToastService = jasmine.createSpyObj('ToastService', ['success', 'error', 'info', 'show']);
    mockActiveModal = jasmine.createSpyObj('NgbActiveModal', ['close', 'dismiss']);

    await TestBed.configureTestingModule({
      imports: [MaintenanceLogEditModal],
      providers: [
        { provide: CUPCAKE_CORE_CONFIG, useValue: { apiUrl: 'http://localhost:8000' } },
        { provide: NgbActiveModal, useValue: mockActiveModal },
        { provide: MaintenanceService, useValue: mockMaintenanceService },
        { provide: ToastService, useValue: mockToastService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(MaintenanceLogEditModal);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('isEdit starts as false in create mode', () => {
    expect(component.isEdit).toBeFalse();
  });

  it('loadTemplates() calls MaintenanceService.getMaintenanceTemplates()', () => {
    expect(mockMaintenanceService.getMaintenanceTemplates).toHaveBeenCalled();
  });

  it('maintenanceType defaults to ROUTINE', () => {
    expect(component.maintenanceType).toBe(MaintenanceType.ROUTINE);
  });

  it('status defaults to PENDING', () => {
    expect(component.status).toBe(Status.PENDING);
  });
});
