import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SketchAnnotation } from './sketch-annotation';

describe('SketchAnnotation', () => {
  let component: SketchAnnotation;
  let fixture: ComponentFixture<SketchAnnotation>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SketchAnnotation]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SketchAnnotation);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
