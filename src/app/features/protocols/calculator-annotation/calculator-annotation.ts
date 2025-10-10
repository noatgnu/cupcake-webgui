import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastService } from '@noatgnu/cupcake-core';

interface HistoryEntry {
  id: string;
  inputPromptFirstValue: number;
  inputPromptSecondValue: number;
  operation: string;
  result: number;
  timestamp: Date;
  scratched?: boolean;
}

@Component({
  selector: 'app-calculator-annotation',
  imports: [CommonModule, FormsModule],
  templateUrl: './calculator-annotation.html',
  styleUrl: './calculator-annotation.scss'
})
export class CalculatorAnnotation implements OnInit {
  private toastService = inject(ToastService);

  private idCounter = 0;

  executionMode = signal<'initial' | 'second'>('initial');
  operation = signal<'+' | '-' | '*' | '/' | '^' | null>(null);
  calculatorMode = signal<'standard' | 'scientific'>('standard');
  angleMode = signal<'deg' | 'rad'>('deg');

  firstValue = signal('0');
  secondValue = signal('');

  memoryValue = signal(0);
  dataLog = signal<HistoryEntry[]>([]);

  readonly CONSTANTS = {
    pi: Math.PI,
    e: Math.E
  };

  displayExpression = computed(() => {
    if (this.executionMode() === 'second' && this.operation()) {
      const op = this.operation();
      const opSymbol = this.getOperationSymbol(op || '+');
      return `${this.firstValue()} ${opSymbol}`;
    }
    return '';
  });

  currentDisplay = computed(() => {
    return this.executionMode() === 'second' ? this.secondValue() : this.firstValue();
  });

  hasMemory = computed(() => this.memoryValue() !== 0);

  visibleHistory = computed(() => {
    return [...this.dataLog()].reverse();
  });

  ngOnInit(): void {
    this.loadSettings();
  }

  private generateUniqueId(): string {
    return `calc-${Date.now()}-${++this.idCounter}`;
  }

  formNumber(inputNumber: number): void {
    if (this.executionMode() === 'initial') {
      const current = this.firstValue();
      if (current === '0' || current === '') {
        this.firstValue.set(inputNumber.toString());
      } else if (current.endsWith('.')) {
        this.firstValue.set(current + inputNumber.toString());
      } else {
        const value = parseFloat(current) * 10 + inputNumber;
        this.firstValue.set(value.toString());
      }
    } else {
      const current = this.secondValue();
      if (current === '' || current === '0') {
        this.secondValue.set(inputNumber.toString());
      } else if (current.endsWith('.')) {
        this.secondValue.set(current + inputNumber.toString());
      } else {
        const value = parseFloat(current) * 10 + inputNumber;
        this.secondValue.set(value.toString());
      }
    }
  }

  formDecimal(): void {
    if (this.executionMode() === 'initial') {
      const current = this.firstValue();
      if (!current.includes('.')) {
        this.firstValue.set(current + '.');
      }
    } else {
      const current = this.secondValue();
      if (!current.includes('.')) {
        this.secondValue.set(current + '.');
      }
    }
  }

  formOperation(op: '+' | '-' | '*' | '/' | '=' | '^'): void {
    if (op === '=' && this.executionMode() === 'second') {
      this.executeBinaryOperation();
      this.executionMode.set('initial');
      this.operation.set(null);
      return;
    }

    if (this.executionMode() === 'initial') {
      if (this.firstValue() === '' || this.firstValue() === '0') {
        return;
      }
      this.executionMode.set('second');
      if (op !== '=') {
        this.operation.set(op);
      }
    } else {
      if (this.secondValue() === '') {
        if (op !== '=') {
          this.operation.set(op);
        }
        return;
      }
      this.executeBinaryOperation();
      if (op !== '=') {
        this.operation.set(op);
      } else {
        this.executionMode.set('initial');
        this.operation.set(null);
      }
    }
  }

  private executeBinaryOperation(): void {
    const first = parseFloat(this.firstValue());
    const second = parseFloat(this.secondValue());
    const op = this.operation();

    if (!op) return;

    let result = 0;

    switch (op) {
      case '+':
        result = first + second;
        break;
      case '-':
        result = first - second;
        break;
      case '*':
        result = first * second;
        break;
      case '/':
        if (second === 0) {
          this.toastService.error('Cannot divide by zero');
          return;
        }
        result = first / second;
        break;
      case '^':
        result = Math.pow(first, second);
        break;
    }

    if (!isFinite(result)) {
      this.toastService.error('Result is not a finite number');
      return;
    }

    const entry: HistoryEntry = {
      id: this.generateUniqueId(),
      inputPromptFirstValue: first,
      inputPromptSecondValue: second,
      operation: op,
      result: result,
      timestamp: new Date()
    };

    this.dataLog.update(log => [...log, entry]);
    this.firstValue.set(result.toString());
    this.secondValue.set('');
  }

  scientificOperation(operation: 'sin' | 'cos' | 'tan' | 'asin' | 'acos' | 'atan' | 'ln' | 'exp' | 'factorial' | 'square' | 'cube' | 'reciprocal' | 'abs' | 'sqrt' | 'log2' | 'log10'): void {
    if (this.executionMode() === 'second') {
      return;
    }

    const value = parseFloat(this.firstValue() || '0');
    let result = 0;
    let isValid = true;

    try {
      switch (operation) {
        case 'log2':
          result = Math.log2(value);
          break;
        case 'log10':
          result = Math.log10(value);
          break;
        case 'ln':
          result = Math.log(value);
          break;
        case 'sqrt':
          result = Math.sqrt(value);
          break;
        case 'abs':
          result = Math.abs(value);
          break;
        case 'sin':
          result = this.angleMode() === 'deg' ? Math.sin(value * Math.PI / 180) : Math.sin(value);
          break;
        case 'cos':
          result = this.angleMode() === 'deg' ? Math.cos(value * Math.PI / 180) : Math.cos(value);
          break;
        case 'tan':
          result = this.angleMode() === 'deg' ? Math.tan(value * Math.PI / 180) : Math.tan(value);
          break;
        case 'asin':
          result = this.angleMode() === 'deg' ? Math.asin(value) * 180 / Math.PI : Math.asin(value);
          break;
        case 'acos':
          result = this.angleMode() === 'deg' ? Math.acos(value) * 180 / Math.PI : Math.acos(value);
          break;
        case 'atan':
          result = this.angleMode() === 'deg' ? Math.atan(value) * 180 / Math.PI : Math.atan(value);
          break;
        case 'exp':
          result = Math.exp(value);
          break;
        case 'factorial':
          if (value < 0 || !Number.isInteger(value) || value > 170) {
            isValid = false;
          } else {
            result = this.factorial(value);
          }
          break;
        case 'square':
          result = value * value;
          break;
        case 'cube':
          result = value * value * value;
          break;
        case 'reciprocal':
          if (value === 0) {
            isValid = false;
          } else {
            result = 1 / value;
          }
          break;
      }

      if (!isValid || !isFinite(result)) {
        this.toastService.error('Invalid operation or result');
        return;
      }

      const entry: HistoryEntry = {
        id: this.generateUniqueId(),
        inputPromptFirstValue: value,
        inputPromptSecondValue: 0,
        operation: operation,
        result: result,
        timestamp: new Date()
      };

      this.dataLog.update(log => [...log, entry]);
      this.firstValue.set(result.toString());
    } catch (error) {
      this.toastService.error('Calculation error');
    }
  }

  private factorial(n: number): number {
    if (n <= 1) return 1;
    return n * this.factorial(n - 1);
  }

  insertConstant(constant: 'pi' | 'e'): void {
    if (this.executionMode() === 'second') {
      return;
    }
    const value = this.CONSTANTS[constant];
    this.firstValue.set(value.toString());
  }

  memoryOperation(op: 'MC' | 'MR' | 'M+' | 'M-' | 'MS'): void {
    switch (op) {
      case 'MC':
        this.memoryValue.set(0);
        this.toastService.success('Memory cleared');
        break;
      case 'MR':
        this.firstValue.set(this.memoryValue().toString());
        this.executionMode.set('initial');
        break;
      case 'M+':
        this.memoryValue.update(val => val + this.getCurrentValue());
        this.toastService.success(`Added to memory: ${this.formatNumber(this.memoryValue())}`);
        break;
      case 'M-':
        this.memoryValue.update(val => val - this.getCurrentValue());
        this.toastService.success(`Subtracted from memory: ${this.formatNumber(this.memoryValue())}`);
        break;
      case 'MS':
        this.memoryValue.set(this.getCurrentValue());
        this.toastService.success(`Stored in memory: ${this.formatNumber(this.memoryValue())}`);
        break;
    }
    this.saveSettings();
  }

  private getCurrentValue(): number {
    if (this.executionMode() === 'second') {
      return parseFloat(this.secondValue() || '0');
    }
    return parseFloat(this.firstValue() || '0');
  }

  clearAll(): void {
    this.firstValue.set('0');
    this.secondValue.set('');
    this.executionMode.set('initial');
    this.operation.set(null);
  }

  clearEntry(): void {
    if (this.executionMode() === 'initial') {
      this.firstValue.set('0');
    } else {
      this.secondValue.set('0');
    }
  }

  formDelete(): void {
    if (this.executionMode() === 'initial') {
      const current = this.firstValue();
      if (current === '' || current === '0') return;
      this.firstValue.set(current.slice(0, -1) || '0');
    } else {
      const current = this.secondValue();
      if (current === '') return;
      this.secondValue.set(current.slice(0, -1));
    }
  }

  setCalculatorMode(mode: 'standard' | 'scientific'): void {
    this.calculatorMode.set(mode);
    this.saveSettings();
  }

  toggleAngleMode(): void {
    this.angleMode.update(mode => mode === 'deg' ? 'rad' : 'deg');
    this.saveSettings();
  }

  revertValueTo(entry: HistoryEntry): void {
    this.firstValue.set(entry.result.toString());
    this.secondValue.set('');
    this.executionMode.set('initial');
    this.operation.set(null);
  }

  removeHistoryItem(entry: HistoryEntry): void {
    this.dataLog.update(log => log.filter(item => item.id !== entry.id));
  }

  clearHistory(): void {
    this.dataLog.set([]);
    this.toastService.success('History cleared');
  }

  exportHistory(): void {
    if (this.dataLog().length === 0) {
      this.toastService.error('No calculations to export');
      return;
    }

    const csvContent = this.generateHistoryCSV();
    this.downloadFile(csvContent, 'calculator-history.csv', 'text/csv');
  }

  private generateHistoryCSV(): string {
    let csv = 'Timestamp,Expression,Result\n';

    this.dataLog().forEach(entry => {
      const timestamp = entry.timestamp.toISOString();
      let expression = '';

      if (entry.inputPromptSecondValue !== 0) {
        expression = `${entry.inputPromptFirstValue} ${entry.operation} ${entry.inputPromptSecondValue}`;
      } else {
        expression = `${entry.operation}(${entry.inputPromptFirstValue})`;
      }

      csv += `"${timestamp}","${expression}","${entry.result}"\n`;
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
    if (Math.abs(value) < 1e-10 && value !== 0) {
      return value.toExponential(6);
    }
    if (Math.abs(value) > 1e12) {
      return value.toExponential(6);
    }
    return parseFloat(value.toPrecision(12)).toString();
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

  private getOperationSymbol(operation: string): string {
    switch (operation) {
      case '+': return '+';
      case '-': return '−';
      case '*': return '×';
      case '/': return '÷';
      case '^': return '^';
      default: return operation;
    }
  }

  private saveSettings(): void {
    const settings = {
      calculatorMode: this.calculatorMode(),
      angleMode: this.angleMode(),
      memoryValue: this.memoryValue()
    };
    localStorage.setItem('calculator-settings', JSON.stringify(settings));
  }

  private loadSettings(): void {
    const saved = localStorage.getItem('calculator-settings');
    if (saved) {
      try {
        const settings = JSON.parse(saved);
        this.calculatorMode.set(settings.calculatorMode || 'standard');
        this.angleMode.set(settings.angleMode || 'deg');
        this.memoryValue.set(settings.memoryValue || 0);
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
