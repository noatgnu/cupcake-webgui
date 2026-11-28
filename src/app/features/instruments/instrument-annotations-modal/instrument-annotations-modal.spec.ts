import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { CUPCAKE_CORE_CONFIG, ToastService, SiteConfigService } from '@noatgnu/cupcake-core';
import { InstrumentService } from '@noatgnu/cupcake-macaron';
import { InstrumentAnnotationsModal } from './instrument-annotations-modal';

describe('InstrumentAnnotationsModal', () => {
  let component: InstrumentAnnotationsModal;
  let fixture: ComponentFixture<InstrumentAnnotationsModal>;
  let mockInstrumentService: jasmine.SpyObj<InstrumentService>;
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

  it('lists the documents of the open folder from the instrument documents themselves', () => {
    component.availableFolders.set([{ id: 7, folderName: 'Manuals' } as any, { id: 8, folderName: 'Certificates' } as any]);
    component.instrumentAnnotations.set([
      { id: 3, folder: 7, annotation: 5, annotationText: 'Service manual, revision 3', annotationType: 'file',
        fileUrl: 'https://example.org/manual', createdAt: '2026-11-27T10:00:00Z' } as any,
      { id: 4, folder: 8, annotation: 6, annotationText: 'Calibration certificate', annotationType: 'file' } as any
    ]);
    component.activeTabId.set(7);
    fixture.detectChanges();

    expect(component.currentTabAnnotations().map(item => item.id)).toEqual([3]);
    expect(component.annotationsByFolder().map(group => group.annotations.length)).toEqual([1, 1]);
    expect(fixture.nativeElement.textContent).toContain('Service manual, revision 3');
  });
});
