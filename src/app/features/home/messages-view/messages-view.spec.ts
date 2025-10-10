import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MessagesView } from './messages-view';

describe('MessagesView', () => {
  let component: MessagesView;
  let fixture: ComponentFixture<MessagesView>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MessagesView]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MessagesView);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
