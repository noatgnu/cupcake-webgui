import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InstrumentMetadataModal } from './instrument-metadata-modal';

describe('InstrumentMetadataModal', () => {
  let component: InstrumentMetadataModal;
  let fixture: ComponentFixture<InstrumentMetadataModal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InstrumentMetadataModal]
    })
    .compileComponents();

    fixture = TestBed.createComponent(InstrumentMetadataModal);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
