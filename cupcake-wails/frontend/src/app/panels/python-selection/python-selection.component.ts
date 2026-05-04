import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WailsService, PythonCandidate, ValidationResult } from '../../core/services/wails.service';

@Component({
  selector: 'app-python-selection',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './python-selection.component.html',
  styleUrl: './python-selection.component.scss'
})
export class PythonSelectionComponent implements OnInit {
  private wails = inject(WailsService);

  loading = signal(true);
  candidates = signal<PythonCandidate[]>([]);
  selectedPath = signal<string>('');
  customPath = '';
  createNewVenv = true;
  validationResult = signal<ValidationResult | null>(null);

  canProceed = computed(() => {
    return this.selectedPath() !== '' ||
           (this.customPath !== '' && this.validationResult()?.valid === true);
  });

  async ngOnInit(): Promise<void> {
    try {
      const candidates = await this.wails.detectPythonCandidates();
      this.candidates.set(candidates);

      if (candidates.length > 0) {
        this.selectedPath.set(candidates[0].path);
      }
    } finally {
      this.loading.set(false);
    }
  }

  selectCandidate(candidate: PythonCandidate): void {
    this.selectedPath.set(candidate.path);
    this.customPath = '';
    this.validationResult.set(null);
  }

  onCustomPathChange(): void {
    this.selectedPath.set('');
    this.validationResult.set(null);
  }

  async browseForPython(): Promise<void> {
    const path = await this.wails.openFile('Select Python executable');
    if (path) {
      this.customPath = path;
      this.selectedPath.set('');
      await this.verifyCustomPath();
    }
  }

  async verifyCustomPath(): Promise<void> {
    if (!this.customPath) return;

    const result = await this.wails.verifyPython(this.customPath);
    this.validationResult.set(result);

    if (result.valid) {
      this.selectedPath.set('');
    }
  }

  async proceed(): Promise<void> {
    const pythonPath = this.selectedPath() || this.customPath;
    if (!pythonPath) return;

    await this.wails.selectPython(pythonPath, this.createNewVenv);
  }
}
