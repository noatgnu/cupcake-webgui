import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { CUPCAKE_CORE_CONFIG, LabGroupInvitation, LabGroupService, ToastService } from '@noatgnu/cupcake-core';

import { LabGroupInvitationAccept } from './lab-group-invitation-accept';

describe('LabGroupInvitationAccept', () => {
  let component: LabGroupInvitationAccept;
  let fixture: ComponentFixture<LabGroupInvitationAccept>;
  let mockLabGroupService: jasmine.SpyObj<LabGroupService>;
  let mockToastService: jasmine.SpyObj<ToastService>;
  let mockRouter: jasmine.SpyObj<Router>;

  const invitation: LabGroupInvitation = {
    id: 7,
    labGroup: 1,
    labGroupName: 'Test Lab',
    inviter: 2,
    inviterName: 'admin',
    invitedEmail: 'testuser@example.com',
    status: 'pending' as any,
    invitationToken: 'token',
    expiresAt: new Date().toISOString(),
    canAccept: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  } as LabGroupInvitation;

  function configureTestBed(invitationId: string): void {
    mockLabGroupService = jasmine.createSpyObj('LabGroupService', [
      'getMyPendingInvitations',
      'acceptLabGroupInvitation',
      'rejectLabGroupInvitation'
    ]);
    mockLabGroupService.getMyPendingInvitations.and.returnValue(of([invitation]));

    mockToastService = jasmine.createSpyObj('ToastService', ['show', 'success', 'error', 'info']);
    mockRouter = jasmine.createSpyObj('Router', ['navigate']);

    TestBed.configureTestingModule({
      imports: [LabGroupInvitationAccept],
      providers: [
        { provide: CUPCAKE_CORE_CONFIG, useValue: { apiUrl: 'http://localhost:8000' } },
        { provide: LabGroupService, useValue: mockLabGroupService },
        { provide: ToastService, useValue: mockToastService },
        { provide: Router, useValue: mockRouter },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ id: invitationId }) } }
        }
      ]
    });
  }

  it('should create and load a matching pending invitation', () => {
    configureTestBed('7');
    fixture = TestBed.createComponent(LabGroupInvitationAccept);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component).toBeTruthy();
    expect(component.loading()).toBe(false);
    expect(component.notFound()).toBe(false);
    expect(component.invitation()?.id).toBe(7);
  });

  it('should mark as not found when no pending invitation matches the route id', () => {
    configureTestBed('999');
    fixture = TestBed.createComponent(LabGroupInvitationAccept);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.notFound()).toBe(true);
    expect(component.invitation()).toBeNull();
  });

  it('should mark as not found when loading invitations fails', () => {
    configureTestBed('7');
    mockLabGroupService.getMyPendingInvitations.and.returnValue(throwError(() => new Error('fail')));
    fixture = TestBed.createComponent(LabGroupInvitationAccept);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.notFound()).toBe(true);
    expect(component.loading()).toBe(false);
  });

  it('should accept the invitation and navigate to lab groups', () => {
    configureTestBed('7');
    mockLabGroupService.acceptLabGroupInvitation.and.returnValue(of({ message: 'Joined Test Lab', invitation }));
    fixture = TestBed.createComponent(LabGroupInvitationAccept);
    component = fixture.componentInstance;
    fixture.detectChanges();

    component.accept();

    expect(mockLabGroupService.acceptLabGroupInvitation).toHaveBeenCalledWith(7);
    expect(mockToastService.success).toHaveBeenCalledWith('Joined Test Lab');
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/home/lab-groups']);
  });

  it('should show an error and stay on the page when accepting fails', () => {
    configureTestBed('7');
    mockLabGroupService.acceptLabGroupInvitation.and.returnValue(
      throwError(() => ({ error: { detail: 'Invitation expired' } }))
    );
    fixture = TestBed.createComponent(LabGroupInvitationAccept);
    component = fixture.componentInstance;
    fixture.detectChanges();

    component.accept();

    expect(mockToastService.error).toHaveBeenCalledWith('Invitation expired');
    expect(mockRouter.navigate).not.toHaveBeenCalled();
    expect(component.responding()).toBe(false);
  });

  it('should reject the invitation and navigate to lab groups', () => {
    configureTestBed('7');
    mockLabGroupService.rejectLabGroupInvitation.and.returnValue(of({ message: 'Invitation rejected', invitation }));
    fixture = TestBed.createComponent(LabGroupInvitationAccept);
    component = fixture.componentInstance;
    fixture.detectChanges();

    component.reject();

    expect(mockLabGroupService.rejectLabGroupInvitation).toHaveBeenCalledWith(7);
    expect(mockToastService.success).toHaveBeenCalledWith('Invitation rejected');
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/home/lab-groups']);
  });
});
