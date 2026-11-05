import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { CUPCAKE_CORE_CONFIG, ToastService, User, UserManagementService } from '@noatgnu/cupcake-core';
import { SessionService } from '@noatgnu/cupcake-red-velvet';
import { SessionEditModal } from './session-edit-modal';

describe('SessionEditModal', () => {
  let component: SessionEditModal;
  let fixture: ComponentFixture<SessionEditModal>;
  let sessionService: jasmine.SpyObj<SessionService>;
  let userService: jasmine.SpyObj<UserManagementService>;

  const alice = { id: 2, username: 'alice' } as User;
  const bob = { id: 3, username: 'bob' } as User;
  const carol = { id: 4, username: 'carol' } as User;

  beforeEach(async () => {
    sessionService = jasmine.createSpyObj('SessionService', ['updateSession']);
    sessionService.updateSession.and.returnValue(of({ id: 1 } as any));
    userService = jasmine.createSpyObj('UserManagementService', ['getUser', 'getUsers', 'getUserDisplayName']);
    userService.getUser.and.callFake((id: number) => of([alice, bob, carol].find(u => u.id === id)!));
    userService.getUsers.and.returnValue(of({ count: 1, results: [carol] } as any));
    userService.getUserDisplayName.and.callFake((u: User | null) => u?.username || '');

    await TestBed.configureTestingModule({
      imports: [SessionEditModal],
      providers: [
        { provide: CUPCAKE_CORE_CONFIG, useValue: { apiUrl: 'http://localhost:8000' } },
        { provide: SessionService, useValue: sessionService },
        { provide: UserManagementService, useValue: userService },
        { provide: ToastService, useValue: jasmine.createSpyObj('ToastService', ['success', 'error']) },
        { provide: NgbActiveModal, useValue: jasmine.createSpyObj('NgbActiveModal', ['close', 'dismiss']) }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(SessionEditModal);
    component = fixture.componentInstance;
    component.session = { id: 1, name: 'Run', enabled: false, processing: false, editors: [2], viewers: [3] } as any;
    fixture.detectChanges();
  });

  it('loads the current editors and viewers', () => {
    expect(component.editors()).toEqual([alice]);
    expect(component.viewers()).toEqual([bob]);
  });

  it('searches users once at least two characters are typed', () => {
    component.onSearchChange('c');
    expect(userService.getUsers).not.toHaveBeenCalled();
    component.onSearchChange('ca');
    expect(component.searchResults()).toEqual([carol]);
  });

  it('moves a viewer to the editors when added as editor', () => {
    component.addEditor(bob);
    expect(component.editors()).toEqual([alice, bob]);
    expect(component.viewers()).toEqual([]);
  });

  it('sends the editor and viewer ids when saving', () => {
    component.addViewer(carol);
    component.removeEditor(alice);
    component.updateSession();
    expect(sessionService.updateSession).toHaveBeenCalledWith(1, jasmine.objectContaining({ editors: [], viewers: [3, 4] }));
  });
});
