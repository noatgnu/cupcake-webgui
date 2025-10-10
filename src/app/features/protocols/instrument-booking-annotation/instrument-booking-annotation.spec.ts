import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InstrumentBookingAnnotation } from './instrument-booking-annotation';

describe('InstrumentBookingAnnotation', () => {
  let component: InstrumentBookingAnnotation;
  let fixture: ComponentFixture<InstrumentBookingAnnotation>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InstrumentBookingAnnotation]
    })
    .compileComponents();

    fixture = TestBed.createComponent(InstrumentBookingAnnotation);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
