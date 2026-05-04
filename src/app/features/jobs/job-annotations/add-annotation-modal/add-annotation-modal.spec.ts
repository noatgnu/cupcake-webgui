import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { CUPCAKE_CORE_CONFIG, ToastService, SiteConfigService } from '@noatgnu/cupcake-core';
import { InstrumentService, InstrumentUsageService, InstrumentPermissionService } from '@noatgnu/cupcake-macaron';
import { ReagentService } from '@noatgnu/cupcake-macaron';
import { AddAnnotationModal } from './add-annotation-modal';

describe('AddAnnotationModal', () => {
  let component: AddAnnotationModal;
  let fixture: ComponentFixture<AddAnnotationModal>;
  let mockActiveModal: jasmine.SpyObj<NgbActiveModal>;

  beforeEach(async () => {
    mockActiveModal = jasmine.createSpyObj('NgbActiveModal', ['close', 'dismiss']);

    const mockToastService = jasmine.createSpyObj('ToastService', ['success', 'error', 'info', 'show']);
    const mockSiteConfigService = jasmine.createSpyObj('SiteConfigService', ['getMaxChunkedUploadSize', 'formatFileSize'], {
      siteConfig: { uiFeaturesWithDefaults: {} }
    });
    mockSiteConfigService.getMaxChunkedUploadSize.and.returnValue(100 * 1024 * 1024);
    mockSiteConfigService.formatFileSize.and.returnValue('100 MB');

    const mockInstrumentService = jasmine.createSpyObj('InstrumentService', ['getInstruments']);
    mockInstrumentService.getInstruments.and.returnValue(of({ count: 0, results: [] }));

    const mockUsageService = jasmine.createSpyObj('InstrumentUsageService', ['getInstrumentUsage']);
    mockUsageService.getInstrumentUsage.and.returnValue(of({ count: 0, results: [] }));

    const mockPermissionService = jasmine.createSpyObj('InstrumentPermissionService', ['getInstrumentPermissions']);
    mockPermissionService.getInstrumentPermissions.and.returnValue(of({ count: 0, results: [] }));

    const mockReagentService = jasmine.createSpyObj('ReagentService', ['getReagents']);
    mockReagentService.getReagents.and.returnValue(of({ count: 0, results: [] }));

    await TestBed.configureTestingModule({
      imports: [AddAnnotationModal],
      providers: [
        { provide: CUPCAKE_CORE_CONFIG, useValue: { apiUrl: 'http://localhost:8000' } },
        { provide: NgbActiveModal, useValue: mockActiveModal },
        { provide: ToastService, useValue: mockToastService },
        { provide: SiteConfigService, useValue: mockSiteConfigService },
        { provide: InstrumentService, useValue: mockInstrumentService },
        { provide: InstrumentUsageService, useValue: mockUsageService },
        { provide: InstrumentPermissionService, useValue: mockPermissionService },
        { provide: ReagentService, useValue: mockReagentService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AddAnnotationModal);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('annotationMode defaults to text', () => {
    expect(component.annotationMode).toBe('text');
  });

  it('isStaffAnnotation defaults to false', () => {
    expect(component.isStaffAnnotation).toBeFalse();
  });
});
