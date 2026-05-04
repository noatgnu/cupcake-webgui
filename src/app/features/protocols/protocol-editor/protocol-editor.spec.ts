import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { provideRouter } from '@angular/router';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { CUPCAKE_CORE_CONFIG, ToastService } from '@noatgnu/cupcake-core';
import { ProtocolService, ProtocolSectionService, ProtocolStepService, StepReagentService } from '@noatgnu/cupcake-red-velvet';
import { ProtocolEditor } from './protocol-editor';

describe('ProtocolEditor', () => {
  let component: ProtocolEditor;
  let fixture: ComponentFixture<ProtocolEditor>;

  beforeEach(async () => {
    const mockProtocolService = jasmine.createSpyObj('ProtocolService', ['getProtocol', 'getProtocols', 'updateProtocol']);
    const mockSectionService = jasmine.createSpyObj('ProtocolSectionService', ['getProtocolSections', 'createProtocolSection']);
    const mockStepService = jasmine.createSpyObj('ProtocolStepService', ['getProtocolSteps', 'createProtocolStep']);
    const mockStepReagentService = jasmine.createSpyObj('StepReagentService', ['getReagentsByStep']);
    mockStepReagentService.getReagentsByStep.and.returnValue(of({ count: 0, results: [] }));
    const mockToastService = jasmine.createSpyObj('ToastService', ['success', 'error', 'info', 'show']);
    const mockModalService = jasmine.createSpyObj('NgbModal', ['open']);

    await TestBed.configureTestingModule({
      imports: [ProtocolEditor],
      providers: [
        { provide: CUPCAKE_CORE_CONFIG, useValue: { apiUrl: 'http://localhost:8000' } },
        provideRouter([]),
        { provide: ProtocolService, useValue: mockProtocolService },
        { provide: ProtocolSectionService, useValue: mockSectionService },
        { provide: ProtocolStepService, useValue: mockStepService },
        { provide: StepReagentService, useValue: mockStepReagentService },
        { provide: ToastService, useValue: mockToastService },
        { provide: NgbModal, useValue: mockModalService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ProtocolEditor);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('protocol signal starts as null', () => {
    expect(component.protocol()).toBeNull();
  });

  it('sections signal starts empty', () => {
    expect(component.sections()).toEqual([]);
  });

  it('loading signal starts as false', () => {
    expect(component.loading()).toBeFalse();
  });
});
