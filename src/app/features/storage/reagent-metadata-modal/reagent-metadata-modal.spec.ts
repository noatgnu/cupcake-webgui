import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { NgbActiveModal, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { CUPCAKE_CORE_CONFIG, ToastService } from '@noatgnu/cupcake-core';
import { ReagentService } from '@noatgnu/cupcake-macaron';
import { MetadataColumnTemplateService, OntologySearchService } from '@noatgnu/cupcake-vanilla';
import { ReagentMetadataModal } from './reagent-metadata-modal';

describe('ReagentMetadataModal', () => {
  let component: ReagentMetadataModal;
  let fixture: ComponentFixture<ReagentMetadataModal>;

  beforeEach(async () => {
    const mockActiveModal = jasmine.createSpyObj('NgbActiveModal', ['close', 'dismiss']);
    const mockModalService = jasmine.createSpyObj('NgbModal', ['open']);
    const mockReagentService = jasmine.createSpyObj('ReagentService', [
      'getStoredReagentMetadata', 'addStoredReagentMetadataColumn',
      'updateStoredReagentMetadataValue', 'removeStoredReagentMetadataColumn'
    ]);
    const mockTemplateService = jasmine.createSpyObj('MetadataColumnTemplateService', ['getMetadataColumnTemplates']);
    mockTemplateService.getMetadataColumnTemplates.and.returnValue(of({ count: 0, results: [] }));
    const mockOntologyService = jasmine.createSpyObj('OntologySearchService', ['search']);
    mockOntologyService.search.and.returnValue(of([]));
    const mockToastService = jasmine.createSpyObj('ToastService', ['success', 'error', 'info', 'show']);

    await TestBed.configureTestingModule({
      imports: [ReagentMetadataModal],
      providers: [
        { provide: CUPCAKE_CORE_CONFIG, useValue: { apiUrl: 'http://localhost:8000' } },
        { provide: NgbActiveModal, useValue: mockActiveModal },
        { provide: NgbModal, useValue: mockModalService },
        { provide: ReagentService, useValue: mockReagentService },
        { provide: MetadataColumnTemplateService, useValue: mockTemplateService },
        { provide: OntologySearchService, useValue: mockOntologyService },
        { provide: ToastService, useValue: mockToastService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ReagentMetadataModal);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('metadataFields starts empty', () => {
    expect(component.metadataFields()).toEqual([]);
  });

  it('loading starts as false', () => {
    expect(component.loading()).toBeFalse();
  });
});
