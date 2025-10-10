import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InstrumentEditModal } from './instrument-edit-modal';

describe('InstrumentEditModal', () => {
  let component: InstrumentEditModal;
  let fixture: ComponentFixture<InstrumentEditModal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InstrumentEditModal]
    })
    .compileComponents();

    fixture = TestBed.createComponent(InstrumentEditModal);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
