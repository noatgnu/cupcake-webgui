import { Injectable } from '@angular/core';
import * as App from '@cupcake-wails-bindings/github.com/noatgnu/cupcake-webgui/cupcake-wails/app';

@Injectable({ providedIn: 'root' })
export class WailsService {
  readonly isWails = typeof window !== 'undefined' && '_wails' in window;

  async getBackendPort(): Promise<number> {
    if (!this.isWails) return 8000;
    return App.GetBackendPort();
  }

  async isBackendReady(): Promise<boolean> {
    if (!this.isWails) return false;
    return App.IsBackendReady();
  }

  async logToFile(message: string): Promise<void> {
    if (!this.isWails) return;
    return App.LogToFile(message);
  }

  async openFile(title: string): Promise<string> {
    if (!this.isWails) return '';
    return App.OpenFile(title);
  }

  async openDirectory(title: string): Promise<string> {
    if (!this.isWails) return '';
    return App.OpenDirectory(title);
  }
}
