import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StepSixStaffReview } from './step-six-staff-review';

describe('StepSixStaffReview', () => {
  let component: StepSixStaffReview;
  let fixture: ComponentFixture<StepSixStaffReview>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StepSixStaffReview]
    })
    .compileComponents();

    fixture = TestBed.createComponent(StepSixStaffReview);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
