import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { AuthService, ConfirmDialogService, CUPCAKE_CORE_CONFIG, ToastService } from '@noatgnu/cupcake-core';
import { MessageThreadService, MessageService, UserBlockService } from '@noatgnu/cupcake-mint-chocolate';
import { MessagesView } from './messages-view';

describe('MessagesView', () => {
  let component: MessagesView;
  let fixture: ComponentFixture<MessagesView>;
  let mockMessageThreadService: jasmine.SpyObj<MessageThreadService>;
  let mockMessageService: jasmine.SpyObj<MessageService>;
  let mockModalService: jasmine.SpyObj<NgbModal>;
  let mockUserBlockService: jasmine.SpyObj<UserBlockService>;

  beforeEach(async () => {
    mockMessageThreadService = jasmine.createSpyObj('MessageThreadService', [
      'getMessageThreads',
      'getMessageThread'
    ]);
    mockMessageThreadService.getMessageThreads.and.returnValue(of({ count: 0, results: [] }));

    mockMessageService = jasmine.createSpyObj('MessageService', ['getMessages', 'createMessage']);
    mockMessageService.getMessages.and.returnValue(of({ count: 0, results: [] }));

    mockModalService = jasmine.createSpyObj('NgbModal', ['open']);
    mockUserBlockService = jasmine.createSpyObj('UserBlockService', ['block']);
    mockUserBlockService.block.and.returnValue(of({ id: 1, blocked: 4, blockedUsername: 'ada', createdAt: '' }));

    await TestBed.configureTestingModule({
      imports: [MessagesView],
      providers: [
        { provide: CUPCAKE_CORE_CONFIG, useValue: { apiUrl: 'http://localhost:8000' } },
        provideRouter([]),
        { provide: MessageThreadService, useValue: mockMessageThreadService },
        { provide: MessageService, useValue: mockMessageService },
        { provide: NgbModal, useValue: mockModalService },
        { provide: UserBlockService, useValue: mockUserBlockService },
        { provide: ToastService, useValue: jasmine.createSpyObj('ToastService', ['success', 'error']) },
        { provide: AuthService, useValue: { currentUser: signal({ id: 7, username: 'grace' }) } }
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

  it('sends the message on Ctrl+Enter, as the box says', () => {
    mockMessageService.createMessage.and.returnValue(of({ id: 'm1' } as any));
    component.selectedThread.set({ id: 't1', title: 'Sample shipment' } as any);
    component.newMessageContent = 'I will be in from 8';
    fixture.detectChanges();

    const box: HTMLTextAreaElement = fixture.nativeElement.querySelector('textarea');
    box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true }));

    expect(mockMessageService.createMessage).toHaveBeenCalledWith({ thread: 't1', content: 'I will be in from 8' });
  });

  it('keeps Enter alone for a new line', () => {
    component.selectedThread.set({ id: 't1', title: 'Sample shipment' } as any);
    component.newMessageContent = 'First line';
    fixture.detectChanges();

    const box: HTMLTextAreaElement = fixture.nativeElement.querySelector('textarea');
    box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    expect(mockMessageService.createMessage).not.toHaveBeenCalled();
  });

  it('offers to block the senders of other people\'s messages only', () => {
    component.selectedThread.set({ id: 't1', title: 'Shipment' } as any);
    component.messages.set([
      { id: 'm1', sender: 7, senderUsername: 'grace', content: 'Mine', createdAt: '2026-11-28T09:00:00Z' } as any,
      { id: 'm2', sender: 4, senderUsername: 'ada', content: 'Theirs', createdAt: '2026-11-28T09:01:00Z' } as any
    ]);
    fixture.detectChanges();

    const buttons = fixture.nativeElement.querySelectorAll('button[title^="Block"]');
    expect(buttons.length).toBe(1);
    expect(buttons[0].getAttribute('title')).toBe('Block ada');
  });

  it('blocks the sender once confirmed', async () => {
    spyOn(TestBed.inject(ConfirmDialogService), 'confirm').and.resolveTo(true);

    const loadsBefore = mockMessageThreadService.getMessageThreads.calls.count();

    await component.blockSender({ id: 'm2', sender: 4, senderUsername: 'ada' } as any);

    expect(mockUserBlockService.block).toHaveBeenCalledWith(4);
    expect(mockMessageThreadService.getMessageThreads.calls.count()).toBe(loadsBefore + 1);
  });

  it('does not block when the question is cancelled', async () => {
    spyOn(TestBed.inject(ConfirmDialogService), 'confirm').and.resolveTo(false);

    await component.blockSender({ id: 'm2', sender: 4, senderUsername: 'ada' } as any);

    expect(mockUserBlockService.block).not.toHaveBeenCalled();
  });
});
