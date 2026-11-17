import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { SignInMode, SignInSettings, WailsService } from '../../core/services/wails.service';

export const SESSION_DAY_CHOICES = [1, 7, 14, 30, 90];

@Component({
  selector: 'app-sign-in',
  imports: [FormsModule],
  templateUrl: './sign-in.html',
  styleUrl: './sign-in.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SignIn implements OnInit {
  private wails = inject(WailsService);

  readonly modes = SignInMode;
  readonly dayChoices = SESSION_DAY_CHOICES;

  mode = signal<SignInMode>(SignInMode.SignInLogin);
  username = signal('');
  sessionDays = signal(30);
  accounts = signal<string[]>([]);
  loading = signal(true);
  saving = signal(false);
  error = signal<string | null>(null);
  saved = signal(false);

  canSave = computed(() => !this.saving() && (this.mode() === SignInMode.SignInLogin || !!this.username()));
  saveHint = computed(() =>
    this.mode() === SignInMode.SignInAutomatic && !this.username() ? 'Choose the account to sign in automatically' : ''
  );

  async ngOnInit(): Promise<void> {
    try {
      const [settings, accounts] = await Promise.all([this.wails.getSignInSettings(), this.wails.listUsers()]);
      this.accounts.set(accounts);
      this.mode.set(settings.mode || SignInMode.SignInLogin);
      this.username.set(settings.username || (accounts.length === 1 ? accounts[0] : ''));
      this.sessionDays.set(settings.sessionDays || 30);
    } catch (err) {
      this.error.set(`Could not read the sign-in settings: ${err}`);
    } finally {
      this.loading.set(false);
    }
  }

  choose(mode: SignInMode): void {
    this.mode.set(mode);
    this.saved.set(false);
  }

  async save(): Promise<void> {
    this.saving.set(true);
    this.error.set(null);
    this.saved.set(false);
    try {
      await this.wails.saveSignInSettings(
        new SignInSettings({ mode: this.mode(), username: this.username(), sessionDays: this.sessionDays() })
      );
      this.saved.set(true);
    } catch (err) {
      this.error.set(`${err}`);
    } finally {
      this.saving.set(false);
    }
  }

  close(): void {
    this.wails.closeSignInWindow();
  }
}
