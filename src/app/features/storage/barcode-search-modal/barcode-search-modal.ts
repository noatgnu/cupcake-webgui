import { Component, inject, OnInit, signal, ViewChild, ElementRef, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import Quagga from '@ericblade/quagga2';

@Component({
  selector: 'app-barcode-search-modal',
  imports: [CommonModule, FormsModule],
  templateUrl: './barcode-search-modal.html',
  styleUrl: './barcode-search-modal.scss'
})
export class BarcodeSearchModal implements OnInit, OnDestroy {
  private activeModal = inject(NgbActiveModal);

  @ViewChild('scannerContainer') scannerContainer?: ElementRef<HTMLDivElement>;

  scanning = signal(false);
  error = signal<string | null>(null);
  quaggaInitialized = false;
  includeSubStorage = false;

  ngOnInit(): void {
    setTimeout(() => {
      this.startScanning();
    }, 100);
  }

  ngOnDestroy(): void {
    this.stopScanning();
  }

  startScanning(): void {
    this.scanning.set(true);
    this.error.set(null);

    setTimeout(() => {
      if (!this.scannerContainer) {
        this.error.set('Scanner container not found');
        this.stopScanning();
        return;
      }

      Quagga.init({
        inputStream: {
          name: 'Live',
          type: 'LiveStream',
          target: this.scannerContainer.nativeElement,
          constraints: {
            width: 640,
            height: 480,
            facingMode: 'environment'
          }
        },
        decoder: {
          readers: [
            'code_128_reader',
            'ean_reader',
            'ean_8_reader',
            'code_39_reader',
            'code_39_vin_reader',
            'codabar_reader',
            'upc_reader',
            'upc_e_reader',
            'i2of5_reader'
          ]
        },
        locate: true,
        locator: {
          patchSize: 'medium',
          halfSample: true
        },
        numOfWorkers: 2,
        frequency: 10
      }, (err: any) => {
        if (err) {
          console.error('Quagga initialization failed:', err);
          this.error.set('Failed to initialize camera. Please check permissions.');
          this.stopScanning();
          return;
        }

        Quagga.onDetected((result: any) => {
          if (result.codeResult && result.codeResult.code) {
            const code = result.codeResult.code;
            this.onBarcodeDetected(code);
          }
        });

        Quagga.start();
        this.quaggaInitialized = true;
      });
    }, 100);
  }

  stopScanning(): void {
    if (this.quaggaInitialized) {
      try {
        Quagga.stop();
        this.quaggaInitialized = false;
      } catch (err) {
        console.error('Error stopping Quagga:', err);
      }
    }

    this.scanning.set(false);
  }

  onBarcodeDetected(barcode: string): void {
    this.stopScanning();
    this.activeModal.close({ barcode, includeSubStorage: this.includeSubStorage });
  }

  cancel(): void {
    this.stopScanning();
    this.activeModal.dismiss();
  }
}
