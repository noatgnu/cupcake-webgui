import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { CUPCAKE_CORE_CONFIG, ToastService, ApiService, SiteConfigService } from '@noatgnu/cupcake-core';
import { ReagentService } from '@noatgnu/cupcake-macaron';
import { StoredReagentAnnotationsModal } from './stored-reagent-annotations-modal';

describe('StoredReagentAnnotationsModal', () => {
  let component: StoredReagentAnnotationsModal;
  let fixture: ComponentFixture<StoredReagentAnnotationsModal>;

  beforeEach(async () => {
    const mockActiveModal = jasmine.createSpyObj('NgbActiveModal', ['close', 'dismiss']);
    const mockReagentService = jasmine.createSpyObj('ReagentService', [
      'getStoredReagentFolders', 'getAnnotationsForStoredReagent'
    ]);
    mockReagentService.getStoredReagentFolders.and.returnValue(of([]));
    mockReagentService.getAnnotationsForStoredReagent.and.returnValue(of({ count: 0, results: [] }));
    const mockApiService = jasmine.createSpyObj('ApiService', ['getAnnotation']);
    const mockToastService = jasmine.createSpyObj('ToastService', ['success', 'error', 'info', 'show']);
    const mockSiteConfigService = jasmine.createSpyObj('SiteConfigService', ['getMaxChunkedUploadSize', 'formatFileSize'], {
      siteConfig: signal({ uiFeaturesWithDefaults: {} })
    });
    mockSiteConfigService.getMaxChunkedUploadSize.and.returnValue(100 * 1024 * 1024);
    mockSiteConfigService.formatFileSize.and.returnValue('100 MB');

    await TestBed.configureTestingModule({
      imports: [StoredReagentAnnotationsModal],
      providers: [
        { provide: CUPCAKE_CORE_CONFIG, useValue: { apiUrl: 'http://localhost:8000' } },
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: NgbActiveModal, useValue: mockActiveModal },
        { provide: ReagentService, useValue: mockReagentService },
        { provide: ApiService, useValue: mockApiService },
        { provide: ToastService, useValue: mockToastService },
        { provide: SiteConfigService, useValue: mockSiteConfigService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(StoredReagentAnnotationsModal);
    component = fixture.componentInstance;
    component.storedReagent = {
      id: 1,
      reagent: 1,
      reagentName: 'Test Reagent',
      quantity: 100,
      currentQuantity: 100,
      shareable: false,
      accessAll: false,
      notifyOnLowStock: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    } as any;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('availableFolders signal starts empty', () => {
    expect(component.availableFolders()).toEqual([]);
  });

  it('loading signal starts as false after folders load', () => {
    expect(component.loading()).toBeFalse();
  });
});
