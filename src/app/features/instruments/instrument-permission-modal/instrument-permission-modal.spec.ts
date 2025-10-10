import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InstrumentPermissionModal } from './instrument-permission-modal';

describe('InstrumentPermissionModal', () => {
  let component: InstrumentPermissionModal;
  let fixture: ComponentFixture<InstrumentPermissionModal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InstrumentPermissionModal]
    })
    .compileComponents();

    fixture = TestBed.createComponent(InstrumentPermissionModal);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
