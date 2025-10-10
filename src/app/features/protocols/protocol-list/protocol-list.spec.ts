import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProtocolList } from './protocol-list';

describe('ProtocolList', () => {
  let component: ProtocolList;
  let fixture: ComponentFixture<ProtocolList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProtocolList]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProtocolList);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
