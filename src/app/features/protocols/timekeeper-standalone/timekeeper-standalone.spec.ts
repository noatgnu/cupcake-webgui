import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TimekeeperStandalone } from './timekeeper-standalone';

describe('TimekeeperStandalone', () => {
  let component: TimekeeperStandalone;
  let fixture: ComponentFixture<TimekeeperStandalone>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TimekeeperStandalone]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TimekeeperStandalone);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
