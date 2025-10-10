import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StepThreeSamples } from './step-three-samples';

describe('StepThreeSamples', () => {
  let component: StepThreeSamples;
  let fixture: ComponentFixture<StepThreeSamples>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StepThreeSamples]
    })
    .compileComponents();

    fixture = TestBed.createComponent(StepThreeSamples);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
