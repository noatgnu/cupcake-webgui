import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InstrumentAnnotationsModal } from './instrument-annotations-modal';

describe('InstrumentAnnotationsModal', () => {
  let component: InstrumentAnnotationsModal;
  let fixture: ComponentFixture<InstrumentAnnotationsModal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InstrumentAnnotationsModal]
    })
    .compileComponents();

    fixture = TestBed.createComponent(InstrumentAnnotationsModal);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
