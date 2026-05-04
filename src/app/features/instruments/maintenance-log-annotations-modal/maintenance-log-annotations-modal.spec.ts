import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { CUPCAKE_CORE_CONFIG, ToastService, ApiService, SiteConfigService } from '@noatgnu/cupcake-core';
import { MaintenanceService } from '@noatgnu/cupcake-macaron';
import { MaintenanceLogAnnotationsModal } from './maintenance-log-annotations-modal';

describe('MaintenanceLogAnnotationsModal', () => {
  let component: MaintenanceLogAnnotationsModal;
  let fixture: ComponentFixture<MaintenanceLogAnnotationsModal>;
  let mockMaintenanceService: jasmine.SpyObj<MaintenanceService>;
  let mockToastService: jasmine.SpyObj<ToastService>;
  let mockActiveModal: jasmine.SpyObj<NgbActiveModal>;

  const mockLog = { id: 1, maintenanceDate: '2024-01-01', maintenanceType: 'routine' } as any;

  beforeEach(async () => {
    mockMaintenanceService = jasmine.createSpyObj('MaintenanceService', ['getAnnotationsForMaintenanceLog']);
    mockMaintenanceService.getAnnotationsForMaintenanceLog.and.returnValue(of({ count: 0, results: [] }));

    mockToastService = jasmine.createSpyObj('ToastService', ['success', 'error', 'info', 'show']);
    mockActiveModal = jasmine.createSpyObj('NgbActiveModal', ['close', 'dismiss']);

    const mockApiService = jasmine.createSpyObj('ApiService', ['getAnnotation']);
    const mockSiteConfigService = jasmine.createSpyObj('SiteConfigService', ['getMaxChunkedUploadSize', 'formatFileSize'], {
      siteConfig: { uiFeaturesWithDefaults: {} }
    });
    mockSiteConfigService.getMaxChunkedUploadSize.and.returnValue(100 * 1024 * 1024);
    mockSiteConfigService.formatFileSize.and.returnValue('100 MB');

    await TestBed.configureTestingModule({
      imports: [MaintenanceLogAnnotationsModal],
      providers: [
        { provide: CUPCAKE_CORE_CONFIG, useValue: { apiUrl: 'http://localhost:8000' } },
        { provide: NgbActiveModal, useValue: mockActiveModal },
        { provide: MaintenanceService, useValue: mockMaintenanceService },
        { provide: ApiService, useValue: mockApiService },
        { provide: ToastService, useValue: mockToastService },
        { provide: SiteConfigService, useValue: mockSiteConfigService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(MaintenanceLogAnnotationsModal);
    component = fixture.componentInstance;
    component.maintenanceLog = mockLog;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('loadAnnotations() calls MaintenanceService.getAnnotationsForMaintenanceLog()', () => {
    expect(mockMaintenanceService.getAnnotationsForMaintenanceLog).toHaveBeenCalledWith(mockLog.id);
  });

  it('loadingAnnotations signal is false after init', () => {
    expect(component.loadingAnnotations()).toBeFalse();
  });
});
