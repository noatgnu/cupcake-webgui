import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ReagentBookingModal } from './reagent-booking-modal';

describe('ReagentBookingModal', () => {
  let component: ReagentBookingModal;
  let fixture: ComponentFixture<ReagentBookingModal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReagentBookingModal]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ReagentBookingModal);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
