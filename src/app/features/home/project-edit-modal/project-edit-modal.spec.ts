import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProjectEditModal } from './project-edit-modal';

describe('ProjectEditModal', () => {
  let component: ProjectEditModal;
  let fixture: ComponentFixture<ProjectEditModal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProjectEditModal]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProjectEditModal);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
