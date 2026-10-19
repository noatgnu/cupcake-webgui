import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { ToastService } from '@noatgnu/cupcake-core';
import { ProtocolsIOAccountService, ProtocolsIOAccountStatus } from '@noatgnu/cupcake-red-velvet';

import { ProtocolsIoAccount } from './protocols-io-account';

describe('ProtocolsIoAccount', () => {
  let component: ProtocolsIoAccount;
  let fixture: ComponentFixture<ProtocolsIoAccount>;
  let accountService: jasmine.SpyObj<ProtocolsIOAccountService>;
  let toastService: jasmine.SpyObj<ToastService>;

  const connected: ProtocolsIOAccountStatus = {
    connected: true,
    username: 'toan-phung',
    name: 'Toan K Phung',
    connectedAt: '2026-10-19T08:00:00Z',
    lastUsedAt: null
  };

  async function create(status: ProtocolsIOAccountStatus): Promise<void> {
    accountService.getStatus.and.returnValue(of(status));
    await TestBed.configureTestingModule({
      imports: [ProtocolsIoAccount],
      providers: [
        provideRouter([]),
        { provide: ProtocolsIOAccountService, useValue: accountService },
        { provide: ToastService, useValue: toastService }
      ]
    }).compileComponents();
    fixture = TestBed.createComponent(ProtocolsIoAccount);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  function text(): string {
    return (fixture.nativeElement as HTMLElement).textContent || '';
  }

  beforeEach(() => {
    accountService = jasmine.createSpyObj('ProtocolsIOAccountService', ['getStatus', 'connect', 'disconnect']);
    toastService = jasmine.createSpyObj('ToastService', ['success', 'error', 'warning', 'info']);
  });

  it('should ask for a token when no account is connected', async () => {
    await create({ connected: false });
    expect(text()).toContain('protocols.io developer page');
    expect(text()).toContain('Connect');
  });

  it('should show the connected account', async () => {
    await create(connected);
    const name = fixture.nativeElement.querySelector('.account-name') as HTMLElement;
    expect(name.textContent).toContain('Toan K Phung (toan-phung)');
    expect(text()).toContain('Not used yet');
  });

  it('should connect with the trimmed token and clear the field', async () => {
    await create({ connected: false });
    accountService.connect.and.returnValue(of(connected));
    component.token.set('  personal-token  ');
    component.connect();
    expect(accountService.connect).toHaveBeenCalledWith('personal-token');
    expect(component.status()).toEqual(connected);
    expect(component.token()).toBe('');
    expect(toastService.success).toHaveBeenCalledWith('Connected to protocols.io as toan-phung');
  });

  it('should not send a blank token', async () => {
    await create({ connected: false });
    component.token.set('   ');
    component.connect();
    expect(accountService.connect).not.toHaveBeenCalled();
    expect(toastService.warning).toHaveBeenCalled();
  });

  it('should show the reason a token was rejected', async () => {
    await create({ connected: false });
    accountService.connect.and.returnValue(throwError(() => new HttpErrorResponse({
      status: 400,
      error: { error: 'protocols.io did not accept this token' }
    })));
    component.token.set('wrong');
    component.connect();
    expect(toastService.error).toHaveBeenCalledWith('protocols.io did not accept this token');
    expect(component.saving()).toBeFalse();
  });

  it('should ask for confirmation before disconnecting', async () => {
    await create(connected);
    accountService.disconnect.and.returnValue(of(undefined));
    (fixture.nativeElement.querySelector('.start-disconnect') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(accountService.disconnect).not.toHaveBeenCalled();
    (fixture.nativeElement.querySelector('.confirm-disconnect') as HTMLButtonElement).click();
    expect(accountService.disconnect).toHaveBeenCalled();
    expect(component.status()).toEqual({ connected: false });
  });

  it('should report a failure to load the status', async () => {
    accountService.getStatus.and.returnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
    await TestBed.configureTestingModule({
      imports: [ProtocolsIoAccount],
      providers: [
        provideRouter([]),
        { provide: ProtocolsIOAccountService, useValue: accountService },
        { provide: ToastService, useValue: toastService }
      ]
    }).compileComponents();
    fixture = TestBed.createComponent(ProtocolsIoAccount);
    fixture.detectChanges();
    expect(toastService.error).toHaveBeenCalledWith('Failed to load the protocols.io account');
  });
});
