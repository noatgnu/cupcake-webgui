import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InstrumentUsageModal } from './instrument-usage-modal';

describe('InstrumentUsageModal', () => {
  let component: InstrumentUsageModal;
  let fixture: ComponentFixture<InstrumentUsageModal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InstrumentUsageModal]
    })
    .compileComponents();

    fixture = TestBed.createComponent(InstrumentUsageModal);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
