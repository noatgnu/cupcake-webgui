import { ComponentFixture, TestBed } from '@angular/core/testing';

import { JobsNavbar } from './jobs-navbar';

describe('JobsNavbar', () => {
  let component: JobsNavbar;
  let fixture: ComponentFixture<JobsNavbar>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [JobsNavbar]
    })
    .compileComponents();

    fixture = TestBed.createComponent(JobsNavbar);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
