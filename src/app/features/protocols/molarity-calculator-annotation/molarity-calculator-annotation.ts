import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbTypeahead, NgbHighlight } from '@ng-bootstrap/ng-bootstrap';
import { ToastService } from '@noatgnu/cupcake-core';
import { ReagentService, StoredReagent } from '@noatgnu/cupcake-macaron';
import { Observable } from 'rxjs';
import { debounceTime, map, switchMap } from 'rxjs/operators';

interface HistoryEntry {
  id: string;
  data: any;
  operationType: string;
  result: number;
  timestamp: Date;
  calculatedField?: string;
  scratched?: boolean;
}

type CalculationMode = 'dynamic' | 'massFromVolumeAndConcentration' | 'volumeFromMassAndConcentration' | 'concentrationFromMassAndVolume' | 'volumeFromStockVolumeAndConcentration';

@Component({
  selector: 'app-molarity-calculator-annotation',
  imports: [CommonModule, FormsModule, NgbTypeahead, NgbHighlight],
  templateUrl: './molarity-calculator-annotation.html',
  styleUrl: './molarity-calculator-annotation.scss'
})
export class MolarityCalculatorAnnotation implements OnInit {
  private toastService = inject(ToastService);
  private reagentService = inject(ReagentService);

  private idCounter = 0;

  selectedForm = signal<CalculationMode>('dynamic');
  dataLog = signal<HistoryEntry[]>([]);

  decimalPlaces = signal(3);
  defaultVolumeUnit = signal('mL');

  concentration = signal<number | null>(null);
  concentrationUnit = signal('mM');
  volume = signal<number | null>(null);
  volumeUnit = signal('mL');
  molecularWeight = signal<number | null>(null);
  weight = signal<number | null>(null);
  weightUnit = signal('mg');

  stockConcentration = signal<number | null>(null);
  stockConcentrationUnit = signal('mM');
  targetConcentration = signal<number | null>(null);
  targetConcentrationUnit = signal('mM');
  stockVolume = signal<number | null>(null);
  stockVolumeUnit = signal('mL');

  private readonly massUnitMap: Record<string, { name: string; unit: string; baseConversion: number }> = {
    'ng': { name: 'Nanogram', unit: 'ng', baseConversion: 1 },
    'μg': { name: 'Microgram', unit: 'μg', baseConversion: 1000 },
    'mg': { name: 'Milligram', unit: 'mg', baseConversion: 1000000 },
    'g': { name: 'Gram', unit: 'g', baseConversion: 1000000000 },
    'kg': { name: 'Kilogram', unit: 'kg', baseConversion: 1000000000000 }
  };

  private readonly volumeUnitMap: Record<string, { name: string; unit: string; baseConversion: number }> = {
    'nL': { name: 'Nanoliter', unit: 'nL', baseConversion: 1 },
    'μL': { name: 'Microliter', unit: 'μL', baseConversion: 1000 },
    'mL': { name: 'Milliliter', unit: 'mL', baseConversion: 1000000 },
    'L': { name: 'Liter', unit: 'L', baseConversion: 1000000000 }
  };

  private readonly molarityUnitMap: Record<string, { name: string; unit: string; baseConversion: number }> = {
    'nM': { name: 'Nanomolar', unit: 'nM', baseConversion: 1 },
    'μM': { name: 'Micromolar', unit: 'μM', baseConversion: 1000 },
    'mM': { name: 'Millimolar', unit: 'mM', baseConversion: 1000000 },
    'M': { name: 'Molar', unit: 'M', baseConversion: 1000000000 }
  };

  readonly massUnits = ['ng', 'μg', 'mg', 'g', 'kg'];
  readonly volumeUnits = ['nL', 'μL', 'mL', 'L'];
  readonly molarityUnits = ['nM', 'μM', 'mM', 'M'];

  searchReagents = (text$: Observable<string>): Observable<StoredReagent[]> => {
    return text$.pipe(
      debounceTime(200),
      switchMap(term => {
        if (!term || term.length < 2) {
          return new Observable<StoredReagent[]>(observer => {
            observer.next([]);
            observer.complete();
          });
        }
        return this.reagentService.getStoredReagents({
          search: term,
          molecularWeight__isnull: false,
          limit: 10
        }).pipe(
          map(response => response.results)
        );
      })
    );
  };

  formatReagent = (reagent: StoredReagent | string) => {
    if (typeof reagent === 'string') {
      return reagent;
    }
    return `${reagent.reagentName} (${reagent.molecularWeight} g/mol)`;
  };

  resultFormatter = (reagent: StoredReagent) => {
    if (typeof reagent === 'string') {
      return reagent;
    }
    return `${reagent.reagentName} (${reagent.molecularWeight} g/mol)`;
  };

  onSelectReagent(event: any): void {
    event.preventDefault();
    const reagent = event.item as StoredReagent;
    if (reagent.molecularWeight) {
      this.molecularWeight.set(reagent.molecularWeight);
      this.toastService.success(`Loaded MW: ${reagent.molecularWeight} g/mol from ${reagent.reagentName}`);
    }
  }

  visibleHistory = computed(() => {
    return [...this.dataLog()].reverse();
  });

  filledFieldsCount = computed(() => {
    if (this.selectedForm() !== 'dynamic') return 0;
    return [
      this.concentration(),
      this.volume(),
      this.molecularWeight(),
      this.weight()
    ].filter(v => v !== null && v !== undefined).length;
  });

  ngOnInit(): void {
    this.loadSettings();
  }

  private generateUniqueId(): string {
    return `molarity-${Date.now()}-${++this.idCounter}`;
  }

  private convertMass(value: number, fromUnit: string, toUnit: string): number {
    return value * this.massUnitMap[fromUnit].baseConversion / this.massUnitMap[toUnit].baseConversion;
  }

  private convertVolume(value: number, fromUnit: string, toUnit: string): number {
    return value * this.volumeUnitMap[fromUnit].baseConversion / this.volumeUnitMap[toUnit].baseConversion;
  }

  private convertMolarity(value: number, fromUnit: string, toUnit: string): number {
    return value * this.molarityUnitMap[fromUnit].baseConversion / this.molarityUnitMap[toUnit].baseConversion;
  }

  clearForm(): void {
    this.concentration.set(null);
    this.volume.set(null);
    this.molecularWeight.set(null);
    this.weight.set(null);
    this.stockConcentration.set(null);
    this.targetConcentration.set(null);
    this.stockVolume.set(null);
  }

  calculateDynamic(): void {
    const filledCount = this.filledFieldsCount();
    if (filledCount < 3) {
      this.toastService.error('Please fill at least 3 values to calculate the 4th');
      return;
    }

    let calculateField = '';
    if (this.concentration() === null || this.concentration() === undefined) calculateField = 'concentration';
    else if (this.volume() === null || this.volume() === undefined) calculateField = 'volume';
    else if (this.molecularWeight() === null || this.molecularWeight() === undefined) calculateField = 'molecularWeight';
    else if (this.weight() === null || this.weight() === undefined) calculateField = 'weight';

    if (!calculateField) {
      this.toastService.error('All fields are filled. Please clear one field to calculate');
      return;
    }

    let result = 0;
    let resultUnit = '';

    try {
      const concentrationInM = this.concentration() ?
        this.convertMolarity(this.concentration()!, this.concentrationUnit(), 'M') : 0;
      const volumeInL = this.volume() ?
        this.convertVolume(this.volume()!, this.volumeUnit(), 'L') : 0;
      const weightInG = this.weight() ?
        this.convertMass(this.weight()!, this.weightUnit(), 'g') : 0;
      const mw = this.molecularWeight() || 0;

      switch (calculateField) {
        case 'weight':
          result = concentrationInM * volumeInL * mw;
          result = this.convertMass(result, 'g', this.weightUnit());
          resultUnit = this.weightUnit();
          this.weight.set(result);
          break;
        case 'volume':
          result = weightInG / (concentrationInM * mw);
          result = this.convertVolume(result, 'L', this.volumeUnit());
          resultUnit = this.volumeUnit();
          this.volume.set(result);
          break;
        case 'concentration':
          result = weightInG / (volumeInL * mw);
          result = this.convertMolarity(result, 'M', this.concentrationUnit());
          resultUnit = this.concentrationUnit();
          this.concentration.set(result);
          break;
        case 'molecularWeight':
          result = weightInG / (concentrationInM * volumeInL);
          resultUnit = 'g/mol';
          this.molecularWeight.set(result);
          break;
      }

      const historyEntry: HistoryEntry = {
        id: this.generateUniqueId(),
        data: {
          concentration: this.concentration(),
          concentrationUnit: this.concentrationUnit(),
          volume: this.volume(),
          volumeUnit: this.volumeUnit(),
          molecularWeight: this.molecularWeight(),
          weight: this.weight(),
          weightUnit: this.weightUnit()
        },
        operationType: 'dynamic',
        result: result,
        calculatedField: calculateField,
        timestamp: new Date()
      };

      this.dataLog.update(log => [...log, historyEntry]);
      this.toastService.success(`${calculateField.charAt(0).toUpperCase() + calculateField.slice(1)}: ${this.formatNumber(result)} ${resultUnit}`);
    } catch (error) {
      this.toastService.error('Calculation error');
    }
  }

  calculateMassFromVolumeAndConcentration(): void {
    if (!this.concentration() || !this.volume() || !this.molecularWeight()) {
      this.toastService.error('Please fill all required fields');
      return;
    }

    try {
      const concentrationInM = this.convertMolarity(this.concentration()!, this.concentrationUnit(), 'M');
      const volumeInL = this.convertVolume(this.volume()!, this.volumeUnit(), 'L');
      const mass = concentrationInM * volumeInL * this.molecularWeight()!;
      const finalWeight = this.convertMass(mass, 'g', this.weightUnit());

      const historyEntry: HistoryEntry = {
        id: this.generateUniqueId(),
        data: {
          concentration: this.concentration(),
          concentrationUnit: this.concentrationUnit(),
          volume: this.volume(),
          volumeUnit: this.volumeUnit(),
          molecularWeight: this.molecularWeight(),
          weightUnit: this.weightUnit()
        },
        operationType: 'massFromVolumeAndConcentration',
        result: finalWeight,
        timestamp: new Date()
      };

      this.dataLog.update(log => [...log, historyEntry]);
      this.toastService.success(`Mass: ${this.formatNumber(finalWeight)} ${this.weightUnit()}`);
    } catch (error) {
      this.toastService.error('Calculation error');
    }
  }

  calculateVolumeFromMassAndConcentration(): void {
    if (!this.weight() || !this.concentration() || !this.molecularWeight()) {
      this.toastService.error('Please fill all required fields');
      return;
    }

    try {
      const weightInG = this.convertMass(this.weight()!, this.weightUnit(), 'g');
      const concentrationInM = this.convertMolarity(this.concentration()!, this.concentrationUnit(), 'M');
      const volume = weightInG / (concentrationInM * this.molecularWeight()!);
      const finalVolume = this.convertVolume(volume, 'L', this.volumeUnit());

      const historyEntry: HistoryEntry = {
        id: this.generateUniqueId(),
        data: {
          weight: this.weight(),
          weightUnit: this.weightUnit(),
          concentration: this.concentration(),
          concentrationUnit: this.concentrationUnit(),
          molecularWeight: this.molecularWeight(),
          volumeUnit: this.volumeUnit()
        },
        operationType: 'volumeFromMassAndConcentration',
        result: finalVolume,
        timestamp: new Date()
      };

      this.dataLog.update(log => [...log, historyEntry]);
      this.toastService.success(`Volume: ${this.formatNumber(finalVolume)} ${this.volumeUnit()}`);
    } catch (error) {
      this.toastService.error('Calculation error');
    }
  }

  calculateConcentrationFromMassAndVolume(): void {
    if (!this.weight() || !this.volume() || !this.molecularWeight()) {
      this.toastService.error('Please fill all required fields');
      return;
    }

    try {
      const weightInG = this.convertMass(this.weight()!, this.weightUnit(), 'g');
      const volumeInL = this.convertVolume(this.volume()!, this.volumeUnit(), 'L');
      const concentration = weightInG / (volumeInL * this.molecularWeight()!);
      const finalConcentration = this.convertMolarity(concentration, 'M', this.concentrationUnit());

      const historyEntry: HistoryEntry = {
        id: this.generateUniqueId(),
        data: {
          weight: this.weight(),
          weightUnit: this.weightUnit(),
          volume: this.volume(),
          volumeUnit: this.volumeUnit(),
          molecularWeight: this.molecularWeight(),
          concentrationUnit: this.concentrationUnit()
        },
        operationType: 'concentrationFromMassAndVolume',
        result: finalConcentration,
        timestamp: new Date()
      };

      this.dataLog.update(log => [...log, historyEntry]);
      this.toastService.success(`Concentration: ${this.formatNumber(finalConcentration)} ${this.concentrationUnit()}`);
    } catch (error) {
      this.toastService.error('Calculation error');
    }
  }

  calculateVolumeFromStockVolumeAndConcentration(): void {
    if (!this.stockConcentration() || !this.targetConcentration() || !this.stockVolume()) {
      this.toastService.error('Please fill all required fields');
      return;
    }

    try {
      const stockConcInM = this.convertMolarity(this.stockConcentration()!, this.stockConcentrationUnit(), 'M');
      const targetConcInM = this.convertMolarity(this.targetConcentration()!, this.targetConcentrationUnit(), 'M');
      const stockVolumeInL = this.convertVolume(this.stockVolume()!, this.stockVolumeUnit(), 'L');

      const finalVolumeInL = (stockConcInM * stockVolumeInL) / targetConcInM;
      const finalVolume = this.convertVolume(finalVolumeInL, 'L', this.volumeUnit());

      const historyEntry: HistoryEntry = {
        id: this.generateUniqueId(),
        data: {
          stockConcentration: this.stockConcentration(),
          stockConcentrationUnit: this.stockConcentrationUnit(),
          targetConcentration: this.targetConcentration(),
          targetConcentrationUnit: this.targetConcentrationUnit(),
          stockVolume: this.stockVolume(),
          stockVolumeUnit: this.stockVolumeUnit(),
          volumeUnit: this.volumeUnit()
        },
        operationType: 'volumeFromStockVolumeAndConcentration',
        result: finalVolume,
        timestamp: new Date()
      };

      this.dataLog.update(log => [...log, historyEntry]);
      this.toastService.success(`Final Volume: ${this.formatNumber(finalVolume)} ${this.volumeUnit()}`);
    } catch (error) {
      this.toastService.error('Calculation error');
    }
  }

  clearHistory(): void {
    this.dataLog.set([]);
    this.toastService.success('History cleared');
  }

  removeHistoryItem(entry: HistoryEntry): void {
    this.dataLog.update(log => log.filter(item => item.id !== entry.id));
  }

  exportHistory(): void {
    if (this.dataLog().length === 0) {
      this.toastService.error('No calculations to export');
      return;
    }

    const csvContent = this.generateHistoryCSV();
    this.downloadFile(csvContent, 'molarity-calculations.csv', 'text/csv');
  }

  private generateHistoryCSV(): string {
    let csv = 'Timestamp,Operation,Result,Unit\n';

    this.dataLog().forEach(entry => {
      const timestamp = entry.timestamp.toISOString();
      const operation = this.getOperationName(entry.operationType);
      const result = this.formatNumber(entry.result);
      const unit = this.getResultUnit(entry);

      csv += `"${timestamp}","${operation}","${result}","${unit}"\n`;
    });

    return csv;
  }

  private downloadFile(content: string, filename: string, type: string): void {
    const blob = new Blob([content], { type });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    window.URL.revokeObjectURL(url);

    this.toastService.success(`${filename} downloaded successfully`);
  }

  formatNumber(value: number): string {
    return Number(value.toFixed(this.decimalPlaces())).toString();
  }

  formatTimestamp(timestamp: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - timestamp.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Now';
    if (diffMins < 60) return `${diffMins}m ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    return timestamp.toLocaleDateString();
  }

  getOperationName(operationType: string): string {
    const names: Record<string, string> = {
      'dynamic': 'Dynamic Calculation',
      'massFromVolumeAndConcentration': 'Mass Calculation',
      'volumeFromMassAndConcentration': 'Volume Calculation',
      'concentrationFromMassAndVolume': 'Concentration Calculation',
      'volumeFromStockVolumeAndConcentration': 'Dilution Calculation'
    };
    return names[operationType] || operationType;
  }

  getResultUnit(entry: HistoryEntry): string {
    switch (entry.operationType) {
      case 'massFromVolumeAndConcentration':
        return entry.data.weightUnit;
      case 'volumeFromMassAndConcentration':
      case 'volumeFromStockVolumeAndConcentration':
        return entry.data.volumeUnit;
      case 'concentrationFromMassAndVolume':
        return entry.data.concentrationUnit;
      case 'dynamic':
        switch (entry.calculatedField) {
          case 'weight': return entry.data.weightUnit;
          case 'volume': return entry.data.volumeUnit;
          case 'concentration': return entry.data.concentrationUnit;
          case 'molecularWeight': return 'g/mol';
          default: return '';
        }
      default:
        return '';
    }
  }

  private saveSettings(): void {
    const settings = {
      decimalPlaces: this.decimalPlaces(),
      defaultVolumeUnit: this.defaultVolumeUnit()
    };
    localStorage.setItem('molarity-calculator-settings', JSON.stringify(settings));
  }

  private loadSettings(): void {
    const saved = localStorage.getItem('molarity-calculator-settings');
    if (saved) {
      try {
        const settings = JSON.parse(saved);
        this.decimalPlaces.set(settings.decimalPlaces || 3);
        this.defaultVolumeUnit.set(settings.defaultVolumeUnit || 'mL');
      } catch (error) {
        // Ignore parsing errors
      }
    }
  }

  toggleHistoryEntryScratched(entry: HistoryEntry): void {
    this.dataLog.update(log =>
      log.map(item =>
        item.id === entry.id
          ? { ...item, scratched: !item.scratched }
          : item
      )
    );
  }

  trackByHistoryId(index: number, item: HistoryEntry): string {
    return item.id;
  }
}
