import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { CUPCAKE_CORE_CONFIG, ToastService, ApiService, SiteConfigService } from '@noatgnu/cupcake-core';
import { InstrumentService } from '@noatgnu/cupcake-macaron';
import { InstrumentAnnotationsModal } from './instrument-annotations-modal';

describe('InstrumentAnnotationsModal', () => {
  let component: InstrumentAnnotationsModal;
  let fixture: ComponentFixture<InstrumentAnnotationsModal>;
  let mockInstrumentService: jasmine.SpyObj<InstrumentService>;
  let mockApiService: jasmine.SpyObj<ApiService>;
  let mockToastService: jasmine.SpyObj<ToastService>;
  let mockSiteConfigService: jasmine.SpyObj<SiteConfigService>;
  let mockActiveModal: jasmine.SpyObj<NgbActiveModal>;

  const mockInstrument = { id: 1, instrumentName: 'Test', metadataTable: null } as any;

  beforeEach(async () => {
    mockInstrumentService = jasmine.createSpyObj('InstrumentService', [
      'getInstrumentFolders', 'getAnnotationsForInstrument', 'uploadAnnotation', 'deleteInstrumentAnnotation'
    ]);
    mockInstrumentService.getInstrumentFolders.and.returnValue(of([]));
    mockInstrumentService.getAnnotationsForInstrument.and.returnValue(of({ count: 0, results: [] }));

    mockApiService = jasmine.createSpyObj('ApiService', ['getAnnotation']);
    mockToastService = jasmine.createSpyObj('ToastService', ['success', 'error', 'info', 'show']);
    mockActiveModal = jasmine.createSpyObj('NgbActiveModal', ['close', 'dismiss']);

    mockSiteConfigService = jasmine.createSpyObj('SiteConfigService', ['getMaxChunkedUploadSize', 'formatFileSize'], {
      siteConfig: { uiFeaturesWithDefaults: {} }
    });
    mockSiteConfigService.getMaxChunkedUploadSize.and.returnValue(100 * 1024 * 1024);
    mockSiteConfigService.formatFileSize.and.returnValue('100 MB');

    await TestBed.configureTestingModule({
      imports: [InstrumentAnnotationsModal],
      providers: [
        { provide: CUPCAKE_CORE_CONFIG, useValue: { apiUrl: 'http://localhost:8000' } },
        { provide: NgbActiveModal, useValue: mockActiveModal },
        { provide: InstrumentService, useValue: mockInstrumentService },
        { provide: ApiService, useValue: mockApiService },
        { provide: ToastService, useValue: mockToastService },
        { provide: SiteConfigService, useValue: mockSiteConfigService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(InstrumentAnnotationsModal);
    component = fixture.componentInstance;
    component.instrument = mockInstrument;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('loadFolders() calls InstrumentService.getInstrumentFolders()', () => {
    expect(mockInstrumentService.getInstrumentFolders).toHaveBeenCalledWith(mockInstrument.id);
  });

  it('availableFolders signal starts as empty array', () => {
    expect(component.availableFolders()).toEqual([]);
  });
});
