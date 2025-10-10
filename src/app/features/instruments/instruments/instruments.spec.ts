import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Instruments } from './instruments';

describe('Instruments', () => {
  let component: Instruments;
  let fixture: ComponentFixture<Instruments>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Instruments]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Instruments);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
