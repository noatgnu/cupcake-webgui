import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SiteConfigService, ToastService, AuthService } from '@noatgnu/cupcake-core';
import type { SiteConfig as SiteConfigModel, SiteConfigUpdateRequest } from '@noatgnu/cupcake-core';

@Component({
  selector: 'app-site-config',
  imports: [CommonModule, FormsModule],
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
    bookingDeletionWindowMinutes: 30
  });

  canEdit = signal(false);
  Object = Object;
  parseInt = parseInt;

  ngOnInit(): void {
    this.checkPermissions();
    this.loadConfig();
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
          logoUrl: config.logoUrl
        };
        if (config.uiFeatures) {
          formDataValue.uiFeatures = config.uiFeatures;
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
        logoUrl: currentConfig.logoUrl
      };
      if (currentConfig.uiFeatures) {
        formDataValue.uiFeatures = currentConfig.uiFeatures;
      }
      this.formData.set(formDataValue);
    }
  }
}
