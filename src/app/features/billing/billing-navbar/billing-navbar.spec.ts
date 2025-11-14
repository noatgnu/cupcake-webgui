import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BillingNavbar } from './billing-navbar';

describe('BillingNavbar', () => {
  let component: BillingNavbar;
  let fixture: ComponentFixture<BillingNavbar>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BillingNavbar]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BillingNavbar);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
