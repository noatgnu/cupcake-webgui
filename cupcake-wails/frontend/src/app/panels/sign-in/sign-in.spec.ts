import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SignInMode, SignInSettings, WailsService } from '../../core/services/wails.service';
import { SignIn } from './sign-in';

describe('SignIn', () => {
  let fixture: ComponentFixture<SignIn>;
  let component: SignIn;
  let wails: jasmine.SpyObj<WailsService>;

  async function open(settings: Partial<SignInSettings>, accounts: string[] = ['bench-owner', 'second']): Promise<void> {
    wails = jasmine.createSpyObj('WailsService', ['getSignInSettings', 'saveSignInSettings', 'listUsers', 'closeSignInWindow']);
    wails.getSignInSettings.and.resolveTo(new SignInSettings({ mode: SignInMode.SignInLogin, username: '', sessionDays: 30, ...settings }));
    wails.listUsers.and.resolveTo(accounts);
    wails.saveSignInSettings.and.resolveTo();
    await TestBed.configureTestingModule({
      imports: [SignIn],
      providers: [{ provide: WailsService, useValue: wails }]
    }).compileComponents();
    fixture = TestBed.createComponent(SignIn);
    component = fixture.componentInstance;
    fixture.detectChanges();
    while (component.loading()) {
      await new Promise(resolve => setTimeout(resolve));
    }
    fixture.detectChanges();
  }

  function element(selector: string): HTMLElement {
    return fixture.nativeElement.querySelector(selector);
  }

  it('shows the saved choice: the login screen and how long a sign-in lasts', async () => {
    await open({ sessionDays: 7 });
    expect(component.mode()).toBe(SignInMode.SignInLogin);
    expect(element('.choice[data-mode="login"]').classList).toContain('active');
    expect((element('#sessionDays') as HTMLSelectElement).value).toBe('7');
    expect(element('#account')).toBeNull();
  });

  it('shows the account chosen for automatic sign-in', async () => {
    await open({ mode: SignInMode.SignInAutomatic, username: 'second' });
    expect(element('.choice[data-mode="automatic"]').classList).toContain('active');
    expect(component.username()).toBe('second');
  });

  it('suggests the only account when there is one', async () => {
    await open({}, ['bench-owner']);
    expect(component.username()).toBe('bench-owner');
  });

  it('saves automatic sign-in for the chosen account', async () => {
    await open({});
    component.choose(SignInMode.SignInAutomatic);
    component.username.set('bench-owner');
    await component.save();
    const saved = wails.saveSignInSettings.calls.mostRecent().args[0];
    expect(saved.mode).toBe(SignInMode.SignInAutomatic);
    expect(saved.username).toBe('bench-owner');
    expect(component.saved()).toBeTrue();
  });

  it('saves the login screen with the chosen length', async () => {
    await open({ mode: SignInMode.SignInAutomatic, username: 'bench-owner' });
    component.choose(SignInMode.SignInLogin);
    component.sessionDays.set(14);
    await component.save();
    const saved = wails.saveSignInSettings.calls.mostRecent().args[0];
    expect(saved.mode).toBe(SignInMode.SignInLogin);
    expect(saved.sessionDays).toBe(14);
  });

  it('will not save automatic sign-in without an account and says why', async () => {
    await open({}, ['a', 'b']);
    component.choose(SignInMode.SignInAutomatic);
    fixture.detectChanges();
    const save = element('.btn-primary') as HTMLButtonElement;
    expect(save.disabled).toBeTrue();
    expect(save.title).toBe('Choose the account to sign in automatically');
  });

  it('shows why saving failed', async () => {
    await open({});
    wails.saveSignInSettings.and.rejectWith('there is no account named ghost');
    await component.save();
    fixture.detectChanges();
    expect(element('.msg-bar.error').textContent).toContain('there is no account named ghost');
    expect(component.saved()).toBeFalse();
  });

  it('closes its window', async () => {
    await open({});
    component.close();
    expect(wails.closeSignInWindow).toHaveBeenCalled();
  });
});
