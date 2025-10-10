import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProtocolsNavbar } from './protocols-navbar';

describe('ProtocolsNavbar', () => {
  let component: ProtocolsNavbar;
  let fixture: ComponentFixture<ProtocolsNavbar>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProtocolsNavbar]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProtocolsNavbar);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
