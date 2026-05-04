import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { CUPCAKE_CORE_CONFIG } from '@noatgnu/cupcake-core';
import { MessageThreadService, MessageService } from '@noatgnu/cupcake-mint-chocolate';
import { MessagesView } from './messages-view';

describe('MessagesView', () => {
  let component: MessagesView;
  let fixture: ComponentFixture<MessagesView>;
  let mockMessageThreadService: jasmine.SpyObj<MessageThreadService>;
  let mockMessageService: jasmine.SpyObj<MessageService>;
  let mockModalService: jasmine.SpyObj<NgbModal>;

  beforeEach(async () => {
    mockMessageThreadService = jasmine.createSpyObj('MessageThreadService', [
      'getMessageThreads',
      'getMessageThread'
    ]);
    mockMessageThreadService.getMessageThreads.and.returnValue(of({ count: 0, results: [] }));

    mockMessageService = jasmine.createSpyObj('MessageService', ['getMessages', 'createMessage']);
    mockMessageService.getMessages.and.returnValue(of({ count: 0, results: [] }));

    mockModalService = jasmine.createSpyObj('NgbModal', ['open']);

    await TestBed.configureTestingModule({
      imports: [MessagesView],
      providers: [
        { provide: CUPCAKE_CORE_CONFIG, useValue: { apiUrl: 'http://localhost:8000' } },
        provideRouter([]),
        { provide: MessageThreadService, useValue: mockMessageThreadService },
        { provide: MessageService, useValue: mockMessageService },
        { provide: NgbModal, useValue: mockModalService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(MessagesView);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('loadThreads() calls MessageThreadService.getMessageThreads()', () => {
    expect(mockMessageThreadService.getMessageThreads).toHaveBeenCalled();
  });

  it('threads starts empty', () => {
    expect(component.threads()).toEqual([]);
  });

  it('selectedThread starts null', () => {
    expect(component.selectedThread()).toBeNull();
  });

  it('sendMessage() does nothing when no thread is selected', () => {
    component.newMessageContent = 'Hello';
    component.sendMessage();
    expect(mockMessageService.createMessage).not.toHaveBeenCalled();
  });

  it('sendMessage() does nothing when content is empty', () => {
    component.selectedThread.set({ id: '1' } as any);
    component.newMessageContent = '';
    component.sendMessage();
    expect(mockMessageService.createMessage).not.toHaveBeenCalled();
  });
});
