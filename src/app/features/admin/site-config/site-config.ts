import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SiteConfigService, ToastService, AuthService } from '@noatgnu/cupcake-core';
import type { SiteConfig as SiteConfigModel, SiteConfigUpdateRequest } from '@noatgnu/cupcake-core';
import { AdminNavbar } from '../admin-navbar/admin-navbar';

@Component({
  selector: 'app-site-config',
  imports: [CommonModule, FormsModule, AdminNavbar],
  templateUrl: './site-config.html',
  styleUrl: './site-config.scss'
})
export class SiteConfig implements OnInit {
  private siteConfigService = inject(SiteConfigService);
  private toastService = inject(ToastService);
  private authService = inject(AuthService);

  config = signal<SiteConfigModel | null>(null);
  loading = signal(false);
  saving = signal(false);

  formData = signal<SiteConfigUpdateRequest>({
    siteName: '',
    primaryColor: '#1976d2',
    showPoweredBy: true,
    allowUserRegistration: false,
    enableOrcidLogin: false,
    bookingDeletionWindowMinutes: 30,
    whisperCppModel: ''
  });

  availableWhisperModels = signal<any[]>([]);
  loadingWhisperModels = signal(false);
  refreshingWhisperModels = signal(false);

  canEdit = signal(false);
  Object = Object;
  parseInt = parseInt;

  ngOnInit(): void {
    this.checkPermissions();
    this.loadConfig();
    this.loadAvailableWhisperModels();
  }

  checkPermissions(): void {
    this.authService.currentUser$.subscribe(user => {
      if (user && (user.isStaff || user.isSuperuser)) {
        this.canEdit.set(true);
      } else {
        this.canEdit.set(false);
      }
    });
  }

  loadConfig(): void {
    this.loading.set(true);
    this.siteConfigService.getCurrentConfig().subscribe({
      next: (config) => {
        this.config.set(config);
        const formDataValue: SiteConfigUpdateRequest = {
          siteName: config.siteName,
          primaryColor: config.primaryColor,
          showPoweredBy: config.showPoweredBy,
          allowUserRegistration: config.allowUserRegistration,
          enableOrcidLogin: config.enableOrcidLogin,
          bookingDeletionWindowMinutes: config.bookingDeletionWindowMinutes,
          logoUrl: config.logoUrl,
          whisperCppModel: config.whisperCppModel
        };
        if (config.uiFeaturesWithDefaults) {
          formDataValue.uiFeatures = this.convertUIFeaturesToSnakeCase(config.uiFeaturesWithDefaults);
        }
        this.formData.set(formDataValue);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error loading site config:', err);
        this.toastService.error('Failed to load site configuration');
        this.loading.set(false);
      }
    });
  }

  updateField(field: keyof SiteConfigUpdateRequest, value: any): void {
    this.formData.update(data => ({
      ...data,
      [field]: value
    }));
  }

  saveConfig(): void {
    if (!this.canEdit()) {
      this.toastService.error('You do not have permission to update site configuration');
      return;
    }

    this.saving.set(true);
    this.siteConfigService.updateConfig(this.formData()).subscribe({
      next: (config) => {
        this.config.set(config);
        this.toastService.success('Site configuration updated successfully');
        this.saving.set(false);
      },
      error: (err) => {
        console.error('Error updating site config:', err);
        this.toastService.error('Failed to update site configuration');
        this.saving.set(false);
      }
    });
  }

  updateUIFeature(featureName: string, value: boolean): void {
    this.formData.update(data => {
      const uiFeatures = { ...data.uiFeatures };
      uiFeatures[featureName] = value;
      return {
        ...data,
        uiFeatures
      };
    });
  }

  convertUIFeaturesToSnakeCase(features: any): any {
    const snakeCaseFeatures: any = {};
    Object.entries(features).forEach(([key, value]) => {
      const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      snakeCaseFeatures[snakeKey] = value;
    });
    return snakeCaseFeatures;
  }

  resetForm(): void {
    const currentConfig = this.config();
    if (currentConfig) {
      const formDataValue: SiteConfigUpdateRequest = {
        siteName: currentConfig.siteName,
        primaryColor: currentConfig.primaryColor,
        showPoweredBy: currentConfig.showPoweredBy,
        allowUserRegistration: currentConfig.allowUserRegistration,
        enableOrcidLogin: currentConfig.enableOrcidLogin,
        bookingDeletionWindowMinutes: currentConfig.bookingDeletionWindowMinutes,
        logoUrl: currentConfig.logoUrl,
        whisperCppModel: currentConfig.whisperCppModel
      };
      if (currentConfig.uiFeaturesWithDefaults) {
        formDataValue.uiFeatures = this.convertUIFeaturesToSnakeCase(currentConfig.uiFeaturesWithDefaults);
      }
      this.formData.set(formDataValue);
    }
  }

  loadAvailableWhisperModels(): void {
    this.loadingWhisperModels.set(true);
    this.siteConfigService.getAvailableWhisperModels().subscribe({
      next: (response: {models: any[], count: number}) => {
        this.availableWhisperModels.set(response.models);
        this.loadingWhisperModels.set(false);
      },
      error: (err: any) => {
        console.error('Error loading Whisper models:', err);
        this.toastService.error('Failed to load available Whisper models');
        this.loadingWhisperModels.set(false);
      }
    });
  }

  refreshWhisperModels(): void {
    this.refreshingWhisperModels.set(true);
    this.siteConfigService.refreshWhisperModels().subscribe({
      next: (response: {status: string, message: string, job_id: string}) => {
        this.toastService.success(response.message || 'Whisper models refresh started');
        this.refreshingWhisperModels.set(false);
        setTimeout(() => {
          this.loadAvailableWhisperModels();
        }, 2000);
      },
      error: (err: any) => {
        console.error('Error refreshing Whisper models:', err);
        this.toastService.error('Failed to refresh Whisper models');
        this.refreshingWhisperModels.set(false);
      }
    });
  }
}
