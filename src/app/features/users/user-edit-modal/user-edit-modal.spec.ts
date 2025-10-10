import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UserEditModal } from './user-edit-modal';

describe('UserEditModal', () => {
  let component: UserEditModal;
  let fixture: ComponentFixture<UserEditModal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UserEditModal]
    })
    .compileComponents();

    fixture = TestBed.createComponent(UserEditModal);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
