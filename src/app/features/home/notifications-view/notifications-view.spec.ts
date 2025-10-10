import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NotificationsView } from './notifications-view';

describe('NotificationsView', () => {
  let component: NotificationsView;
  let fixture: ComponentFixture<NotificationsView>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NotificationsView]
    })
    .compileComponents();

    fixture = TestBed.createComponent(NotificationsView);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
