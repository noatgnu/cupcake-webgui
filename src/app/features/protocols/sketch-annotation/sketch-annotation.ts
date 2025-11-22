import { Component, ElementRef, ViewChild, AfterViewInit, signal, inject, DOCUMENT, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ThemeService } from '@noatgnu/cupcake-core';

interface Point {
  x: number;
  y: number;
}

interface Stroke {
  points: Point[];
  color: string;
  width: number;
}

@Component({
  selector: 'app-sketch-annotation',
  imports: [CommonModule, FormsModule],
  templateUrl: './sketch-annotation.html',
  styleUrl: './sketch-annotation.scss',
})
export class SketchAnnotation implements AfterViewInit {
  @ViewChild('canvas', { static: false }) canvasRef!: ElementRef<HTMLCanvasElement>;

  private themeService = inject(ThemeService);
  private document = inject(DOCUMENT);
  private ctx!: CanvasRenderingContext2D;
  private isDrawing = false;
  private currentStroke: Point[] = [];
  private strokes: Stroke[] = [];
  private undoStack: Stroke[][] = [];

  selectedColor = signal('#000000');
  selectedWidth = signal(2);
  isErasing = signal(false);
  canUndo = signal(false);
  canRedo = signal(false);
  useColorCorrection = signal(true);

  colors = ['#000000', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF', '#FFFFFF'];
  widths = [1, 2, 4, 8, 12];
  eraserWidths = [10, 20, 30, 40];

  private isDarkMode(): boolean {
    return this.themeService.isDark();
  }

  private getContrastAdjustedColor(color: string): string {
    if (!this.useColorCorrection()) {
      return color;
    }

    const isDark = this.isDarkMode();

    if (color === '#000000' || color === '#000') {
      return isDark ? '#FFFFFF' : '#000000';
    }

    if (color === '#FFFFFF' || color === '#FFF' || color.toLowerCase() === 'white') {
      return isDark ? '#FFFFFF' : '#000000';
    }

    return color;
  }

  getColorAdjustmentInfo(color: string): string | null {
    const isDark = this.isDarkMode();
    const adjusted = this.getContrastAdjustedColor(color);

    if (color !== adjusted) {
      const colorName = color === '#000000' ? 'Black' : 'White';
      const adjustedName = adjusted === '#FFFFFF' ? 'White' : 'Black';
      return `${colorName} → ${adjustedName} (${isDark ? 'Dark' : 'Light'} mode)`;
    }

    return null;
  }

  ngAfterViewInit(): void {
    const canvas = this.canvasRef.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error('Could not get canvas context');
      return;
    }
    this.ctx = ctx;

    canvas.width = canvas.offsetWidth;
    canvas.height = 400;

    this.fillBackground();
    this.setupEventListeners();

    effect(() => {
      this.useColorCorrection();
      this.redrawCanvas();
    });
  }

  private fillBackground(): void {
    const canvas = this.canvasRef.nativeElement;
    const bgColor = getComputedStyle(this.document.documentElement).getPropertyValue('--bs-body-bg').trim();
    this.ctx.fillStyle = bgColor || '#ffffff';
    this.ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  private setupEventListeners(): void {
    const canvas = this.canvasRef.nativeElement;

    canvas.addEventListener('mousedown', (e) => this.startDrawing(e));
    canvas.addEventListener('mousemove', (e) => this.draw(e));
    canvas.addEventListener('mouseup', () => this.stopDrawing());
    canvas.addEventListener('mouseleave', () => this.stopDrawing());

    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      const mouseEvent = new MouseEvent('mousedown', {
        clientX: touch.clientX,
        clientY: touch.clientY
      });
      canvas.dispatchEvent(mouseEvent);
    });

    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      const mouseEvent = new MouseEvent('mousemove', {
        clientX: touch.clientX,
        clientY: touch.clientY
      });
      canvas.dispatchEvent(mouseEvent);
    });

    canvas.addEventListener('touchend', (e) => {
      e.preventDefault();
      const mouseEvent = new MouseEvent('mouseup', {});
      canvas.dispatchEvent(mouseEvent);
    });
  }

  private getCanvasPoint(event: MouseEvent): Point {
    const canvas = this.canvasRef.nativeElement;
    const rect = canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
  }

  private startDrawing(event: MouseEvent): void {
    this.isDrawing = true;
    const point = this.getCanvasPoint(event);
    this.currentStroke = [point];
  }

  private draw(event: MouseEvent): void {
    if (!this.isDrawing) return;

    const point = this.getCanvasPoint(event);
    this.currentStroke.push(point);

    if (this.currentStroke.length < 2) return;

    const prevPoint = this.currentStroke[this.currentStroke.length - 2];

    this.ctx.beginPath();
    this.ctx.moveTo(prevPoint.x, prevPoint.y);
    this.ctx.lineTo(point.x, point.y);

    if (this.isErasing()) {
      this.ctx.globalCompositeOperation = 'destination-out';
      this.ctx.strokeStyle = 'rgba(0,0,0,1)';
      this.ctx.lineWidth = this.selectedWidth();
    } else {
      this.ctx.globalCompositeOperation = 'source-over';
      this.ctx.strokeStyle = this.getContrastAdjustedColor(this.selectedColor());
      this.ctx.lineWidth = this.selectedWidth();
    }

    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.ctx.stroke();
  }

  private stopDrawing(): void {
    if (!this.isDrawing) return;

    this.isDrawing = false;
    if (this.currentStroke.length > 0) {
      this.strokes.push({
        points: [...this.currentStroke],
        color: this.isErasing() ? 'eraser' : this.selectedColor(),
        width: this.selectedWidth()
      });
      this.currentStroke = [];
      this.canUndo.set(true);
      this.undoStack = [];
      this.canRedo.set(false);
    }
  }

  clear(): void {
    const canvas = this.canvasRef.nativeElement;
    this.fillBackground();
    this.undoStack.push([...this.strokes]);
    this.strokes = [];
    this.canUndo.set(false);
    this.canRedo.set(true);
  }

  undo(): void {
    if (this.strokes.length === 0) return;

    this.undoStack.push([...this.strokes]);
    this.strokes.pop();
    this.redrawCanvas();
    this.canUndo.set(this.strokes.length > 0);
    this.canRedo.set(true);
  }

  redo(): void {
    if (this.undoStack.length === 0) return;

    const redoStrokes = this.undoStack.pop()!;
    this.strokes = redoStrokes;
    this.redrawCanvas();
    this.canUndo.set(this.strokes.length > 0);
    this.canRedo.set(this.undoStack.length > 0);
  }

  private redrawCanvas(): void {
    const canvas = this.canvasRef.nativeElement;
    this.fillBackground();

    for (const stroke of this.strokes) {
      if (stroke.points.length < 2) continue;

      this.ctx.beginPath();
      this.ctx.moveTo(stroke.points[0].x, stroke.points[0].y);

      for (let i = 1; i < stroke.points.length; i++) {
        this.ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }

      if (stroke.color === 'eraser') {
        this.ctx.globalCompositeOperation = 'destination-out';
        this.ctx.strokeStyle = 'rgba(0,0,0,1)';
      } else {
        this.ctx.globalCompositeOperation = 'source-over';
        this.ctx.strokeStyle = this.getContrastAdjustedColor(stroke.color);
      }

      this.ctx.lineWidth = stroke.width;
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';
      this.ctx.stroke();
    }

    this.ctx.globalCompositeOperation = 'source-over';
  }

  getSketchData(): File | null {
    const canvas = this.canvasRef.nativeElement;
    const bgColor = getComputedStyle(this.document.documentElement).getPropertyValue('--bs-body-bg').trim();

    const vectorData = {
      width: canvas.width,
      height: canvas.height,
      strokes: this.strokes,
      backgroundColor: bgColor || '#ffffff',
      timestamp: Date.now()
    };

    const vectorDataString = JSON.stringify(vectorData);
    const blob = new Blob([vectorDataString], { type: 'application/json' });
    const file = new File([blob], `sketch_${Date.now()}.json`, { type: 'application/json' });

    return file;
  }

  exportAsSVG(): string {
    const canvas = this.canvasRef.nativeElement;
    const bgColor = getComputedStyle(this.document.documentElement).getPropertyValue('--bs-body-bg').trim() || '#ffffff';
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}" viewBox="0 0 ${canvas.width} ${canvas.height}">`;
    svg += `<rect width="100%" height="100%" fill="${bgColor}"/>`;

    for (const stroke of this.strokes) {
      if (stroke.points.length < 2) continue;

      const pathData = stroke.points.map((point, index) => {
        return index === 0 ? `M ${point.x} ${point.y}` : `L ${point.x} ${point.y}`;
      }).join(' ');

      if (stroke.color === 'eraser') {
        svg += `<path d="${pathData}" stroke="white" stroke-width="${stroke.width}" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`;
      } else {
        const adjustedColor = this.getContrastAdjustedColor(stroke.color);
        svg += `<path d="${pathData}" stroke="${adjustedColor}" stroke-width="${stroke.width}" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`;
      }
    }

    svg += '</svg>';
    return svg;
  }

  renderAtResolution(targetWidth: number, targetHeight: number): HTMLCanvasElement {
    const originalCanvas = this.canvasRef.nativeElement;
    const scaleX = targetWidth / originalCanvas.width;
    const scaleY = targetHeight / originalCanvas.height;

    const newCanvas = document.createElement('canvas');
    newCanvas.width = targetWidth;
    newCanvas.height = targetHeight;
    const newCtx = newCanvas.getContext('2d')!;

    const bgColor = getComputedStyle(this.document.documentElement).getPropertyValue('--bs-body-bg').trim() || '#ffffff';
    newCtx.fillStyle = bgColor;
    newCtx.fillRect(0, 0, targetWidth, targetHeight);

    for (const stroke of this.strokes) {
      if (stroke.points.length < 2) continue;

      newCtx.beginPath();
      newCtx.moveTo(stroke.points[0].x * scaleX, stroke.points[0].y * scaleY);

      for (let i = 1; i < stroke.points.length; i++) {
        newCtx.lineTo(stroke.points[i].x * scaleX, stroke.points[i].y * scaleY);
      }

      if (stroke.color === 'eraser') {
        newCtx.globalCompositeOperation = 'destination-out';
        newCtx.strokeStyle = 'rgba(0,0,0,1)';
      } else {
        newCtx.globalCompositeOperation = 'source-over';
        newCtx.strokeStyle = this.getContrastAdjustedColor(stroke.color);
      }

      newCtx.lineWidth = stroke.width * Math.min(scaleX, scaleY);
      newCtx.lineCap = 'round';
      newCtx.lineJoin = 'round';
      newCtx.stroke();
    }

    newCtx.globalCompositeOperation = 'source-over';
    return newCanvas;
  }

  toggleEraser(): void {
    this.isErasing.update(v => !v);
  }

  selectDrawingMode(): void {
    this.isErasing.set(false);
  }
}
