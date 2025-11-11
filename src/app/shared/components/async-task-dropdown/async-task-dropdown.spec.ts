import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AsyncTaskDropdown } from './async-task-dropdown';

describe('AsyncTaskDropdown', () => {
  let component: AsyncTaskDropdown;
  let fixture: ComponentFixture<AsyncTaskDropdown>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AsyncTaskDropdown]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AsyncTaskDropdown);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
