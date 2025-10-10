import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Protocols } from './protocols';

describe('Protocols', () => {
  let component: Protocols;
  let fixture: ComponentFixture<Protocols>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Protocols]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Protocols);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
