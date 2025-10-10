import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MessagingDropdown } from './messaging-dropdown';

describe('MessagingDropdown', () => {
  let component: MessagingDropdown;
  let fixture: ComponentFixture<MessagingDropdown>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MessagingDropdown]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MessagingDropdown);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
