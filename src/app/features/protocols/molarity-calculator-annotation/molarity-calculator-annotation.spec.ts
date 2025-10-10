import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MolarityCalculatorAnnotation } from './molarity-calculator-annotation';

describe('MolarityCalculatorAnnotation', () => {
  let component: MolarityCalculatorAnnotation;
  let fixture: ComponentFixture<MolarityCalculatorAnnotation>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MolarityCalculatorAnnotation]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MolarityCalculatorAnnotation);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
