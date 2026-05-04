import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { NgbActiveModal, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { CUPCAKE_CORE_CONFIG, ToastService } from '@noatgnu/cupcake-core';
import { InstrumentService } from '@noatgnu/cupcake-macaron';
import { MetadataColumnTemplateService, OntologySearchService } from '@noatgnu/cupcake-vanilla';
import { InstrumentMetadataModal } from './instrument-metadata-modal';

describe('InstrumentMetadataModal', () => {
  let component: InstrumentMetadataModal;
  let fixture: ComponentFixture<InstrumentMetadataModal>;
  let mockInstrumentService: jasmine.SpyObj<InstrumentService>;
  let mockToastService: jasmine.SpyObj<ToastService>;
  let mockActiveModal: jasmine.SpyObj<NgbActiveModal>;
  let mockMetadataColumnTemplateService: jasmine.SpyObj<MetadataColumnTemplateService>;
  let mockOntologySearchService: jasmine.SpyObj<OntologySearchService>;
  let mockModalService: jasmine.SpyObj<NgbModal>;

  beforeEach(async () => {
    mockInstrumentService = jasmine.createSpyObj('InstrumentService', [
      'getInstrumentMetadata', 'addMetadataColumn', 'updateMetadataValue', 'removeMetadataColumn'
    ]);
    mockInstrumentService.getInstrumentMetadata.and.returnValue(of({ columns: [] } as any));

    mockToastService = jasmine.createSpyObj('ToastService', ['success', 'error', 'info', 'show']);
    mockActiveModal = jasmine.createSpyObj('NgbActiveModal', ['close', 'dismiss']);

    mockMetadataColumnTemplateService = jasmine.createSpyObj('MetadataColumnTemplateService', ['getMetadataColumnTemplates']);
    mockMetadataColumnTemplateService.getMetadataColumnTemplates.and.returnValue(of({ count: 0, results: [] }));

    mockOntologySearchService = jasmine.createSpyObj('OntologySearchService', ['suggest']);
    mockModalService = jasmine.createSpyObj('NgbModal', ['open']);

    await TestBed.configureTestingModule({
      imports: [InstrumentMetadataModal],
      providers: [
        { provide: CUPCAKE_CORE_CONFIG, useValue: { apiUrl: 'http://localhost:8000' } },
        { provide: NgbActiveModal, useValue: mockActiveModal },
        { provide: InstrumentService, useValue: mockInstrumentService },
        { provide: MetadataColumnTemplateService, useValue: mockMetadataColumnTemplateService },
        { provide: OntologySearchService, useValue: mockOntologySearchService },
        { provide: NgbModal, useValue: mockModalService },
        { provide: ToastService, useValue: mockToastService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(InstrumentMetadataModal);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('metadataFields starts empty', () => {
    expect(component.metadataFields()).toEqual([]);
  });

  it('loadTemplates() calls MetadataColumnTemplateService.getMetadataColumnTemplates()', () => {
    expect(mockMetadataColumnTemplateService.getMetadataColumnTemplates).toHaveBeenCalled();
  });

  it('toggleAddForm() toggles showAddForm', () => {
    expect(component.showAddForm()).toBeFalse();
    component.toggleAddForm();
    expect(component.showAddForm()).toBeTrue();
  });

  it('close() calls NgbActiveModal.close()', () => {
    component.close();
    expect(mockActiveModal.close).toHaveBeenCalledWith(true);
  });
});
