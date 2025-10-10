import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BarcodeSearchModal } from './barcode-search-modal';

describe('BarcodeSearchModal', () => {
  let component: BarcodeSearchModal;
  let fixture: ComponentFixture<BarcodeSearchModal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BarcodeSearchModal]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BarcodeSearchModal);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
