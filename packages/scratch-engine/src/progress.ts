import { getCtx } from './cover-paint';
import type { ScratchPoint } from './types';

const PROGRESS_RESOLUTION = 48;

export class ProgressTracker {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly scaleX: number;
  private readonly scaleY: number;
  private readonly measurableArea: number;
  private cachedCleared = 0;
  private dirty = false;

  constructor(cssW: number, cssH: number) {
    const ratio = cssW / Math.max(1, cssH);
    const width = ratio >= 1 ? PROGRESS_RESOLUTION : Math.max(8, Math.round(PROGRESS_RESOLUTION * ratio));
    const height = ratio >= 1 ? Math.max(8, Math.round(PROGRESS_RESOLUTION / Math.max(0.1, ratio))) : PROGRESS_RESOLUTION;
    this.canvas = document.createElement('canvas');
    this.canvas.width = width;
    this.canvas.height = height;
    const ctx = getCtx(this.canvas, true);
    if (!ctx) throw new Error('ProgressTracker: 2D context unavailable');
    this.ctx = ctx;
    this.scaleX = width / Math.max(1, cssW);
    this.scaleY = height / Math.max(1, cssH);
    this.ctx.clearRect(0, 0, width, height);
    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(0, 0, width, height);
    this.measurableArea = width * height;
  }

  erase(from: ScratchPoint | null, to: ScratchPoint, radius: number): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const scaledRadius = radius * Math.max(this.scaleX, this.scaleY);
    if (from) {
      ctx.lineWidth = scaledRadius * 2;
      ctx.beginPath();
      ctx.moveTo(from.x * this.scaleX, from.y * this.scaleY);
      ctx.lineTo(to.x * this.scaleX, to.y * this.scaleY);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(to.x * this.scaleX, to.y * this.scaleY, scaledRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    this.dirty = true;
  }

  readCleared(): number {
    if (!this.dirty) return this.cachedCleared;
    const data = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height).data;
    let alphaTotal = 0;
    for (let index = 3; index < data.length; index += 4) {
      alphaTotal += data[index];
    }
    const cleared = this.measurableArea > 0
      ? 1 - alphaTotal / (255 * this.measurableArea)
      : 1;
    this.cachedCleared = Math.max(0, Math.min(1, cleared));
    this.dirty = false;
    return this.cachedCleared;
  }

  destroy(): void {
    this.canvas.width = 0;
    this.canvas.height = 0;
  }
}
