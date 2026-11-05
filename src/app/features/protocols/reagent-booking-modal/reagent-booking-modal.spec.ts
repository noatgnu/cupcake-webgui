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

  it('looks up the step reagent from its nested reagent', () => {
    component.stepReagent = { id: 1, reagent: { id: 44 }, quantity: 5 } as any;
    component.setMatchingOnly(true);
    expect(mockReagentService.getStoredReagents.calls.mostRecent().args[0]).toEqual(
      jasmine.objectContaining({ reagent: 44 })
    );
  });

  it('starts the quantity at what is still needed', () => {
    component.alreadyBooked = 2;
    component.ngOnInit();
    expect(component.stillNeeded()).toBe(3);
    expect(component.quantity()).toBe(3);
  });

  it('looks up the step reagent first', () => {
    expect(mockReagentService.getStoredReagents.calls.mostRecent().args[0]).toEqual(
      jasmine.objectContaining({ reagent: 10 })
    );
  });

  it('searches every accessible stored reagent when matching only is turned off', () => {
    component.setMatchingOnly(false);
    const params = mockReagentService.getStoredReagents.calls.mostRecent().args[0]!;
    expect(params.reagent).toBeUndefined();
    expect(component.selectedReagent()).toBeNull();
  });

  it('books the selected stored reagent for the step reagent', () => {
    mockReagentActionService.createReagentAction.and.returnValue(of({ id: 5 } as any));
    component.selectReagent({ id: 30, currentQuantity: 100 } as any);
    component.updateQuantity('5');

    component.bookReagent();

    expect(mockReagentActionService.createReagentAction).toHaveBeenCalledWith(
      jasmine.objectContaining({ reagent: 30, quantity: 5, session: 1, step: 1, stepReagent: 1 })
    );
  });
});
