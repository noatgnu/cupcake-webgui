import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BillingRecords } from './billing-records';

describe('BillingRecords', () => {
  let component: BillingRecords;
  let fixture: ComponentFixture<BillingRecords>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BillingRecords]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BillingRecords);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
