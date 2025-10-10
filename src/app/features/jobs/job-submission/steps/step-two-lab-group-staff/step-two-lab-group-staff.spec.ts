import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StepTwoLabGroupStaff } from './step-two-lab-group-staff';

describe('StepTwoLabGroupStaff', () => {
  let component: StepTwoLabGroupStaff;
  let fixture: ComponentFixture<StepTwoLabGroupStaff>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StepTwoLabGroupStaff]
    })
    .compileComponents();

    fixture = TestBed.createComponent(StepTwoLabGroupStaff);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
