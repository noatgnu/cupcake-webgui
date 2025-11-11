import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AsyncTaskFloatingPanel } from './async-task-floating-panel';

describe('AsyncTaskFloatingPanel', () => {
  let component: AsyncTaskFloatingPanel;
  let fixture: ComponentFixture<AsyncTaskFloatingPanel>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AsyncTaskFloatingPanel]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AsyncTaskFloatingPanel);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
