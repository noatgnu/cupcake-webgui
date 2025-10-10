import { Component, Input, OnInit, OnDestroy, ViewChild, ElementRef, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-audio-visualizer',
  imports: [CommonModule],
  templateUrl: './audio-visualizer.html',
  styleUrl: './audio-visualizer.scss',
})
export class AudioVisualizer implements OnInit, OnDestroy {
  @ViewChild('canvas', { static: true }) canvas!: ElementRef<HTMLCanvasElement>;

  @Input() audioStream: MediaStream | null = null;
  @Input() width = 400;
  @Input() height = 100;
  @Input() barColor = '#4CAF50';
  @Input() barWidth = 2;
  @Input() barGap = 1;

  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private dataArray: Uint8Array<ArrayBuffer> | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private animationId: number | null = null;

  isActive = signal(false);

  constructor() {
    effect(() => {
      if (this.audioStream) {
        this.startVisualization();
      } else {
        this.stopVisualization();
      }
    });
  }

  ngOnInit(): void {
    const canvas = this.canvas.nativeElement;
    canvas.width = this.width;
    canvas.height = this.height;
  }

  ngOnDestroy(): void {
    this.stopVisualization();
  }

  private startVisualization(): void {
    if (!this.audioStream) return;

    try {
      this.audioContext = new AudioContext();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;

      const bufferLength = this.analyser.frequencyBinCount;
      const buffer = new ArrayBuffer(bufferLength);
      this.dataArray = new Uint8Array(buffer);

      this.source = this.audioContext.createMediaStreamSource(this.audioStream);
      this.source.connect(this.analyser);

      this.isActive.set(true);
      this.draw();
    } catch (error) {
      console.error('Error starting audio visualization:', error);
    }
  }

  private stopVisualization(): void {
    this.isActive.set(false);

    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }

    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.analyser = null;
    this.dataArray = null;

    this.clearCanvas();
  }

  private draw(): void {
    if (!this.analyser || !this.dataArray) return;

    this.animationId = requestAnimationFrame(() => this.draw());

    this.analyser.getByteFrequencyData(this.dataArray);

    const canvas = this.canvas.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#f5f5f5';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const barTotalWidth = this.barWidth + this.barGap;
    const barCount = Math.floor(canvas.width / barTotalWidth);

    for (let i = 0; i < barCount; i++) {
      const dataIndex = Math.floor((i / barCount) * this.dataArray.length);
      const value = this.dataArray[dataIndex];
      const barHeight = (value / 255) * canvas.height;

      const x = i * barTotalWidth;
      const y = canvas.height - barHeight;

      ctx.fillStyle = this.barColor;
      ctx.fillRect(x, y, this.barWidth, barHeight);
    }
  }

  private clearCanvas(): void {
    const canvas = this.canvas.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#f5f5f5';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
}
