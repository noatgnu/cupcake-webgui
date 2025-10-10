import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SessionDetail } from './session-detail';

describe('SessionDetail', () => {
  let component: SessionDetail;
  let fixture: ComponentFixture<SessionDetail>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SessionDetail]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SessionDetail);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
