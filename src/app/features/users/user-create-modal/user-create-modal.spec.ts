import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UserCreateModal } from './user-create-modal';

describe('UserCreateModal', () => {
  let component: UserCreateModal;
  let fixture: ComponentFixture<UserCreateModal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UserCreateModal]
    })
    .compileComponents();

    fixture = TestBed.createComponent(UserCreateModal);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
