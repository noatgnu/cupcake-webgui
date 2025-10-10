import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InstrumentsNavbar } from './instruments-navbar';

describe('InstrumentsNavbar', () => {
  let component: InstrumentsNavbar;
  let fixture: ComponentFixture<InstrumentsNavbar>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InstrumentsNavbar]
    })
    .compileComponents();

    fixture = TestBed.createComponent(InstrumentsNavbar);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
