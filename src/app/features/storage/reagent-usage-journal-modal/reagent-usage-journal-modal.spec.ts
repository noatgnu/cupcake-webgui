import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { CUPCAKE_CORE_CONFIG } from '@noatgnu/cupcake-core';
import { ReagentActionService } from '@noatgnu/cupcake-macaron';
import { ReagentUsageJournalModal } from './reagent-usage-journal-modal';

describe('ReagentUsageJournalModal', () => {
  let fixture: ComponentFixture<ReagentUsageJournalModal>;
  let actions: jasmine.SpyObj<ReagentActionService>;
  let activeModal: jasmine.SpyObj<NgbActiveModal>;

  beforeEach(async () => {
    actions = jasmine.createSpyObj('ReagentActionService', ['getReagentActions']);
    actions.getReagentActions.and.returnValue(of({ count: 0, results: [] }));
    activeModal = jasmine.createSpyObj('NgbActiveModal', ['dismiss']);

    await TestBed.configureTestingModule({
      imports: [ReagentUsageJournalModal],
      providers: [
        { provide: CUPCAKE_CORE_CONFIG, useValue: { apiUrl: 'http://localhost:8000' } },
        { provide: ReagentActionService, useValue: actions },
        { provide: NgbActiveModal, useValue: activeModal }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ReagentUsageJournalModal);
    fixture.componentInstance.storedReagent = {
      id: 42, reagent: 7, reagentName: 'Trypsin', reagentUnit: 'mg', quantity: 10, currentQuantity: 12
    } as any;
    fixture.detectChanges();
  });

  it('shows the usage of the stored reagent, not of every stock of the same reagent', () => {
    expect(actions.getReagentActions).toHaveBeenCalledWith(jasmine.objectContaining({ reagent: 42 }));
  });

  it('closes', () => {
    fixture.componentInstance.close();
    expect(activeModal.dismiss).toHaveBeenCalled();
  });
});
