import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { DOCUMENT } from '@angular/common';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { CUPCAKE_CORE_CONFIG, ToastService, SiteConfigService, ThemeService } from '@noatgnu/cupcake-core';
import { InstrumentService, InstrumentUsageService, InstrumentPermissionService, ReagentService } from '@noatgnu/cupcake-macaron';
import { AnnotationModal } from './annotation-modal';

describe('AnnotationModal', () => {
  let component: AnnotationModal;
  let fixture: ComponentFixture<AnnotationModal>;
  let mockActiveModal: jasmine.SpyObj<NgbActiveModal>;
  let mockToastService: jasmine.SpyObj<ToastService>;
  let mockSiteConfigService: jasmine.SpyObj<SiteConfigService>;
  let mockThemeService: jasmine.SpyObj<ThemeService>;
  let mockInstrumentService: jasmine.SpyObj<InstrumentService>;
  let mockInstrumentUsageService: jasmine.SpyObj<InstrumentUsageService>;
  let mockInstrumentPermissionService: jasmine.SpyObj<InstrumentPermissionService>;
  let mockReagentService: jasmine.SpyObj<ReagentService>;

  beforeEach(async () => {
    mockActiveModal = jasmine.createSpyObj('NgbActiveModal', ['close', 'dismiss']);

    mockToastService = jasmine.createSpyObj('ToastService', ['show', 'success', 'error', 'info']);

    mockSiteConfigService = jasmine.createSpyObj('SiteConfigService', ['getMaxChunkedUploadSize', 'formatFileSize']);
    mockSiteConfigService.getMaxChunkedUploadSize.and.returnValue(100 * 1024 * 1024);
    mockSiteConfigService.formatFileSize.and.returnValue('100 MB');

    mockThemeService = jasmine.createSpyObj('ThemeService', ['toggleMode'], {
      isDark: signal(false)
    });

    mockInstrumentService = jasmine.createSpyObj('InstrumentService', ['getInstruments']);
    mockInstrumentService.getInstruments.and.returnValue(of({ count: 0, results: [] }));

    mockInstrumentUsageService = jasmine.createSpyObj('InstrumentUsageService', ['getInstrumentUsage']);
    mockInstrumentUsageService.getInstrumentUsage.and.returnValue(of({ count: 0, results: [] }));

    mockInstrumentPermissionService = jasmine.createSpyObj('InstrumentPermissionService', ['getBookingPermissions']);
    mockInstrumentPermissionService.getBookingPermissions.and.returnValue(of({ count: 0, results: [] }));

    mockReagentService = jasmine.createSpyObj('ReagentService', ['getStoredReagents', 'getReagents']);
    mockReagentService.getStoredReagents.and.returnValue(of({ count: 0, results: [] }));
    mockReagentService.getReagents.and.returnValue(of({ count: 0, results: [] }));

    Object.defineProperty(navigator, 'mediaDevices', {
      value: {
        enumerateDevices: jasmine.createSpy('enumerateDevices').and.returnValue(Promise.resolve([])),
        getUserMedia: jasmine.createSpy('getUserMedia').and.returnValue(Promise.resolve(null))
      },
      configurable: true
    });

    await TestBed.configureTestingModule({
      imports: [AnnotationModal],
      providers: [
        { provide: CUPCAKE_CORE_CONFIG, useValue: { apiUrl: 'http://localhost:8000' } },
        { provide: NgbActiveModal, useValue: mockActiveModal },
        { provide: ToastService, useValue: mockToastService },
        { provide: SiteConfigService, useValue: mockSiteConfigService },
        { provide: ThemeService, useValue: mockThemeService },
        { provide: InstrumentService, useValue: mockInstrumentService },
        { provide: InstrumentUsageService, useValue: mockInstrumentUsageService },
        { provide: InstrumentPermissionService, useValue: mockInstrumentPermissionService },
        { provide: ReagentService, useValue: mockReagentService },
        { provide: DOCUMENT, useValue: document }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AnnotationModal);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should default annotationMode to text', () => {
    expect(component.annotationMode).toBe('text');
  });

  it('should default selectedFile signal to null', () => {
    expect(component.selectedFile()).toBeNull();
  });
});
