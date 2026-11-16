import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { ToastService } from '@noatgnu/cupcake-core';
import { SessionService } from '@noatgnu/cupcake-red-velvet';
import { of } from 'rxjs';

import { SessionCreateModal } from './session-create-modal';

describe('SessionCreateModal', () => {
  let component: SessionCreateModal;
  let fixture: ComponentFixture<SessionCreateModal>;
  let sessionService: jasmine.SpyObj<SessionService>;
  let activeModal: jasmine.SpyObj<NgbActiveModal>;

  beforeEach(async () => {
    sessionService = jasmine.createSpyObj('SessionService', ['createSession']);
    sessionService.createSession.and.returnValue(of({ id: 9, name: 'run' } as any));
    activeModal = jasmine.createSpyObj('NgbActiveModal', ['close', 'dismiss']);
    await TestBed.configureTestingModule({
      imports: [SessionCreateModal],
      providers: [
        provideRouter([]),
        { provide: SessionService, useValue: sessionService },
        { provide: NgbActiveModal, useValue: activeModal },
        { provide: ToastService, useValue: jasmine.createSpyObj('ToastService', ['success', 'error']) }
      ]
    }).compileComponents();
    fixture = TestBed.createComponent(SessionCreateModal);
    component = fixture.componentInstance;
    component.protocol = { id: 3, protocolTitle: 'Digestion' } as any;
    fixture.detectChanges();
  });

  it('starts a new session as private', () => {
    expect(component.sessionForm.value.enabled).toBeFalse();
    expect((fixture.nativeElement.querySelector('#enabled') as HTMLInputElement).checked).toBeFalse();
  });

  it('creates a private session unless Public is ticked', () => {
    component.sessionForm.patchValue({ name: 'Digestion run' });
    component.createSession();
    expect(sessionService.createSession).toHaveBeenCalledWith({ name: 'Digestion run', enabled: false, protocols: [3] });

    component.sessionForm.patchValue({ name: 'Open run', enabled: true });
    component.createSession();
    expect(sessionService.createSession).toHaveBeenCalledWith({ name: 'Open run', enabled: true, protocols: [3] });
  });
});
