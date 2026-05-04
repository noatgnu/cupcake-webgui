import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { CUPCAKE_CORE_CONFIG, ToastService } from '@noatgnu/cupcake-core';
import { ReagentService, ReagentActionService } from '@noatgnu/cupcake-macaron';
import { ReagentBookingModal } from './reagent-booking-modal';

describe('ReagentBookingModal', () => {
  let component: ReagentBookingModal;
  let fixture: ComponentFixture<ReagentBookingModal>;
  let mockReagentService: jasmine.SpyObj<ReagentService>;
  let mockReagentActionService: jasmine.SpyObj<ReagentActionService>;
  let mockToastService: jasmine.SpyObj<ToastService>;
  let mockActiveModal: jasmine.SpyObj<NgbActiveModal>;

  beforeEach(async () => {
    mockReagentService = jasmine.createSpyObj('ReagentService', ['getStoredReagents']);
    mockReagentService.getStoredReagents.and.returnValue(of({ count: 0, results: [] }));

    mockReagentActionService = jasmine.createSpyObj('ReagentActionService', ['createReagentAction']);

    mockToastService = jasmine.createSpyObj('ToastService', ['show', 'success', 'error', 'info']);

    mockActiveModal = jasmine.createSpyObj('NgbActiveModal', ['close', 'dismiss']);

    await TestBed.configureTestingModule({
      imports: [ReagentBookingModal],
      providers: [
        { provide: CUPCAKE_CORE_CONFIG, useValue: { apiUrl: 'http://localhost:8000' } },
        { provide: NgbActiveModal, useValue: mockActiveModal },
        { provide: ReagentService, useValue: mockReagentService },
        { provide: ReagentActionService, useValue: mockReagentActionService },
        { provide: ToastService, useValue: mockToastService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ReagentBookingModal);
    component = fixture.componentInstance;
    component.stepReagent = { id: 1, reagentId: 10, quantity: 5, scaledQuantity: null } as any;
    component.sessionId = 1;
    component.stepId = 1;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should start with null selected reagent indicating no reserved amount', () => {
    expect(component.selectedReagent()).toBeNull();
  });

  it('should call getStoredReagents on init via loadStoredReagents', () => {
    expect(mockReagentService.getStoredReagents).toHaveBeenCalled();
  });
});
