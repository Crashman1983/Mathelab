/**
 * CelebrationEffect — Canvas-Overlay für richtige Antworten.
 *
 * 5 Varianten:
 * 0 = Checkmark + Burst (Original)
 * 1 = Stern-Regen (goldene Sterne fallen von oben)
 * 2 = Spiral-Konfetti (Partikel in Spiralbahnen)
 * 3 = Feuerwerk (3 zeitversetzte Bursts)
 * 4 = Daumen-hoch + Glitzer
 *
 * Läuft ~1100ms, dann inaktiv. Respektiert prefers-reduced-motion (E4).
 * Wird via CanvasScene.triggerCelebration() ausgelöst.
 */

import { getPalette } from "@core/design";
import { prefersReducedMotion } from "./scene";

// ─── Typen ───────────────────────────────────────────────────────────────────

interface Particle {
  x: number;
  y: number;
  vx: number; // px/ms
  vy: number; // px/ms
  size: number;
  color: string;
  shape: "circle" | "star" | "square" | "heart";
  alpha: number;
  rotation: number;
  rotSpeed: number; // rad/ms
  /** Extra data for variant-specific behavior */
  phase?: number;
  amplitude?: number;
  startX?: number;
}

// ─── Konstanten ──────────────────────────────────────────────────────────────

const DURATION = 1100;       // ms Gesamtdauer
const VARIANT_COUNT = 5;
const REDUCED_MOTION_DURATION = 400; // ms for reduced motion fade

// ─── CelebrationEffect ───────────────────────────────────────────────────────

export class CelebrationEffect {
  private particles: Particle[] = [];
  private elapsed = 0;
  private _active = false;
  private cx = 0;
  private cy = 0;
  private variant = 0;
  private reducedMotion = false;

  get isActive(): boolean {
    return this._active;
  }

  /** Celebration starten, zentriert auf (cx, cy) in CSS-Pixeln */
  trigger(cx: number, cy: number, variant?: number): void {
    this.reducedMotion = prefersReducedMotion();
    this.cx = cx;
    this.cy = cy;
    this.elapsed = 0;
    this.particles = []; // Clear previous particles to prevent stacking
    this._active = true;
    this.variant = variant ?? Math.floor(Math.random() * VARIANT_COUNT);

    if (this.reducedMotion) {
      // No particles for reduced motion — just icon fade
      this.particles = [];
      return;
    }

    switch (this.variant) {
      case 1: this.particles = this.spawnStarRain(cx, cy); break;
      case 2: this.particles = this.spawnSpiralConfetti(cx, cy); break;
      case 3: this.particles = this.spawnFirework(cx, cy); break;
      case 4: this.particles = this.spawnGlitter(cx, cy); break;
      default: this.particles = this.spawnBurst(cx, cy); break;
    }
  }

  // ─── Spawn functions ────────────────────────────────────────────────────

  /** Variant 0: Original checkmark burst */
  private spawnBurst(cx: number, cy: number): Particle[] {
    const p = getPalette();
    const colors = [p.ok, p.accent, p.warn, p.canvasSuccess, p.canvasPrimary, p.coinGold, p.canvasSecondary];
    const shapes: Particle["shape"][] = ["circle", "star", "square"];
    const result: Particle[] = [];
    for (let i = 0; i < 36; i++) {
      const angle = (Math.PI * 2 * i) / 36 + (Math.random() - 0.5) * 0.4;
      const speed = 0.18 + Math.random() * 0.32;
      result.push({
        x: cx, y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.22,
        size: 4 + Math.random() * 7,
        color: colors[Math.floor(Math.random() * colors.length)],
        shape: shapes[Math.floor(Math.random() * shapes.length)],
        alpha: 1,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.006,
      });
    }
    return result;
  }

  /** Variant 1: Stars falling from top with gentle sway */
  private spawnStarRain(cx: number, _cy: number): Particle[] {
    const p = getPalette();
    const colors = [p.coinGold, p.warn, p.accent, p.canvasPrimary, p.ok];
    const result: Particle[] = [];
    for (let i = 0; i < 24; i++) {
      const startX = cx + (Math.random() - 0.5) * cx * 1.6;
      result.push({
        x: startX, y: -10 - Math.random() * 60,
        vx: 0, vy: 0.12 + Math.random() * 0.15,
        size: 5 + Math.random() * 8,
        color: colors[Math.floor(Math.random() * colors.length)],
        shape: "star",
        alpha: 1,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.004,
        phase: Math.random() * Math.PI * 2,
        amplitude: 15 + Math.random() * 25,
        startX,
      });
    }
    return result;
  }

  /** Variant 2: Spiral confetti — particles fly outward in spiral paths */
  private spawnSpiralConfetti(cx: number, cy: number): Particle[] {
    const p = getPalette();
    const colors = [p.ok, p.accent, p.warn, p.bad, p.canvasSuccess, p.coinGold];
    const shapes: Particle["shape"][] = ["circle", "square", "heart", "star"];
    const result: Particle[] = [];
    for (let i = 0; i < 30; i++) {
      const baseAngle = (Math.PI * 2 * i) / 30;
      result.push({
        x: cx, y: cy,
        vx: Math.cos(baseAngle) * 0.15,
        vy: Math.sin(baseAngle) * 0.15,
        size: 4 + Math.random() * 6,
        color: colors[Math.floor(Math.random() * colors.length)],
        shape: shapes[Math.floor(Math.random() * shapes.length)],
        alpha: 1,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.008,
        phase: baseAngle,
      });
    }
    return result;
  }

  /** Variant 3: Firework — 3 staggered burst centers */
  private spawnFirework(cx: number, cy: number): Particle[] {
    const p = getPalette();
    const colorSets = [
      [p.ok, p.canvasSuccess],
      [p.accent, p.canvasPrimary],
      [p.warn, p.coinGold],
    ];
    const offsets = [
      { dx: -cx * 0.25, dy: -cy * 0.1, delay: 0 },
      { dx: 0, dy: -cy * 0.2, delay: 150 },
      { dx: cx * 0.25, dy: -cy * 0.05, delay: 300 },
    ];
    const result: Particle[] = [];
    for (let b = 0; b < 3; b++) {
      const { dx, dy } = offsets[b];
      const colors = colorSets[b];
      for (let i = 0; i < 14; i++) {
        const angle = (Math.PI * 2 * i) / 14 + (Math.random() - 0.5) * 0.3;
        const speed = 0.12 + Math.random() * 0.22;
        result.push({
          x: cx + dx, y: cy + dy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 0.18,
          size: 3 + Math.random() * 5,
          color: colors[Math.floor(Math.random() * colors.length)],
          shape: Math.random() > 0.5 ? "circle" : "star",
          alpha: offsets[b].delay === 0 ? 1 : 0,
          rotation: Math.random() * Math.PI * 2,
          rotSpeed: (Math.random() - 0.5) * 0.005,
          phase: offsets[b].delay,
        });
      }
    }
    return result;
  }

  /** Variant 4: Glitter around thumbs-up */
  private spawnGlitter(cx: number, cy: number): Particle[] {
    const p = getPalette();
    const colors = [p.coinGold, p.warn, p.accent, p.ok];
    const result: Particle[] = [];
    for (let i = 0; i < 18; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 30 + Math.random() * 80;
      result.push({
        x: cx + Math.cos(angle) * dist,
        y: cy + Math.sin(angle) * dist,
        vx: (Math.random() - 0.5) * 0.05,
        vy: (Math.random() - 0.5) * 0.05,
        size: 3 + Math.random() * 5,
        color: colors[Math.floor(Math.random() * colors.length)],
        shape: "star",
        alpha: 0,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.004,
        phase: Math.random() * 400,
      });
    }
    return result;
  }

  // ─── Tick ───────────────────────────────────────────────────────────────

  /** Zustand um dt Millisekunden vorwärts ticken */
  tick(dt: number): void {
    if (!this._active) return;
    this.elapsed += dt;

    const totalDur = this.reducedMotion ? REDUCED_MOTION_DURATION : DURATION;
    if (this.elapsed >= totalDur) {
      this._active = false;
      return;
    }

    if (this.reducedMotion) return;

    const progress = this.elapsed / DURATION;

    switch (this.variant) {
      case 1: this.tickStarRain(dt, progress); break;
      case 2: this.tickSpiral(dt, progress); break;
      case 3: this.tickFirework(dt, progress); break;
      case 4: this.tickGlitter(dt, progress); break;
      default: this.tickBurst(dt, progress); break;
    }
  }

  private tickBurst(dt: number, progress: number): void {
    for (const p of this.particles) {
      p.vy += 0.0012 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rotation += p.rotSpeed * dt;
      p.alpha = Math.max(0, 1 - Math.max(0, progress - 0.6) / 0.4);
    }
  }

  private tickStarRain(dt: number, progress: number): void {
    for (const p of this.particles) {
      p.y += p.vy * dt;
      // Gentle horizontal sway
      p.x = (p.startX ?? p.x) + Math.sin(this.elapsed * 0.003 + (p.phase ?? 0)) * (p.amplitude ?? 20);
      p.rotation += p.rotSpeed * dt;
      p.alpha = progress < 0.1
        ? progress / 0.1
        : Math.max(0, 1 - Math.max(0, progress - 0.65) / 0.35);
    }
  }

  private tickSpiral(dt: number, progress: number): void {
    const t = this.elapsed;
    for (const p of this.particles) {
      // Spiral outward: increase velocity over time
      const spiralAngle = (p.phase ?? 0) + t * 0.004;
      const accel = 0.00008;
      p.vx += Math.cos(spiralAngle) * accel * dt;
      p.vy += Math.sin(spiralAngle) * accel * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rotation += p.rotSpeed * dt;
      p.alpha = Math.max(0, 1 - Math.max(0, progress - 0.5) / 0.5);
    }
  }

  private tickFirework(dt: number, _progress: number): void {
    for (const p of this.particles) {
      const delay = p.phase ?? 0;
      const localElapsed = this.elapsed - delay;
      if (localElapsed < 0) {
        p.alpha = 0;
        continue;
      }
      p.vy += 0.001 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rotation += p.rotSpeed * dt;
      const localProgress = localElapsed / (DURATION - delay);
      p.alpha = localProgress < 0.1
        ? localProgress / 0.1
        : Math.max(0, 1 - Math.max(0, localProgress - 0.5) / 0.5);
    }
  }

  private tickGlitter(_dt: number, _progress: number): void {
    for (const p of this.particles) {
      const delay = p.phase ?? 0;
      const localElapsed = this.elapsed - delay;
      if (localElapsed < 0) {
        p.alpha = 0;
        continue;
      }
      // Twinkle: fade in then out
      const localProgress = localElapsed / (DURATION - delay);
      if (localProgress < 0.3) {
        p.alpha = localProgress / 0.3;
      } else if (localProgress > 0.6) {
        p.alpha = Math.max(0, 1 - (localProgress - 0.6) / 0.4);
      } else {
        p.alpha = 0.7 + Math.sin(this.elapsed * 0.015 + (p.phase ?? 0)) * 0.3;
      }
      p.rotation += 0.003 * 16; // Steady spin
    }
  }

  // ─── Draw ───────────────────────────────────────────────────────────────

  /** Overlay auf ctx zeichnen (CSS-Pixel-Koordinaten) */
  draw(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    if (!this._active) return;
    ctx.save();

    if (this.reducedMotion) {
      this.drawReducedMotion(ctx, w, h);
      ctx.restore();
      return;
    }

    switch (this.variant) {
      case 4: this.drawThumbsUp(ctx, w, h); break;
      default: this.drawCenterIcon(ctx, w, h); break;
    }

    // Draw particles for all variants
    this.drawParticles(ctx);
    ctx.restore();
  }

  /** Reduced motion: simple opacity fade of icon, no particles */
  private drawReducedMotion(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const progress = this.elapsed / REDUCED_MOTION_DURATION;
    const alpha = progress < 0.5 ? 1 : Math.max(0, 1 - (progress - 0.5) / 0.5);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(this.cx, this.cy);
    const palette = getPalette();
    const fontSize = Math.min(w, h) * 0.18;
    ctx.font = `700 ${fontSize}px 'Atkinson Hyperlegible', system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = palette.ok;
    ctx.fillText(this.variant === 4 ? "👍" : "✓", 0, 0);
    ctx.restore();
  }

  /** Central ✓ icon (variants 0, 1, 2, 3) */
  private drawCenterIcon(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const progress = this.elapsed / DURATION;
    if (progress >= 0.45) return;
    const t = Math.min(1, progress / 0.35);
    const scale = springEase(t);
    const alpha = 1 - Math.max(0, (progress - 0.28) / 0.17);
    ctx.save();
    ctx.translate(this.cx, this.cy);
    ctx.scale(scale, scale);
    ctx.globalAlpha = Math.max(0, alpha);
    const palette = getPalette();
    const fontSize = Math.min(w, h) * 0.22;
    ctx.font = `700 ${fontSize}px 'Atkinson Hyperlegible', system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = palette.ok;
    ctx.shadowBlur = fontSize * 0.5;
    ctx.fillStyle = palette.ok;
    ctx.fillText("✓", 0, 0);
    ctx.restore();
  }

  /** Variant 4: 👍 with bounce */
  private drawThumbsUp(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const progress = this.elapsed / DURATION;
    if (progress >= 0.55) return;
    const t = Math.min(1, progress / 0.3);
    const scale = springEase(t);
    const alpha = progress < 0.35 ? 1 : Math.max(0, 1 - (progress - 0.35) / 0.2);
    ctx.save();
    ctx.translate(this.cx, this.cy);
    ctx.scale(scale, scale);
    ctx.globalAlpha = Math.max(0, alpha);
    const fontSize = Math.min(w, h) * 0.20;
    ctx.font = `${fontSize}px 'Atkinson Hyperlegible', system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("👍", 0, 0);
    ctx.restore();
  }

  /** Draw all particles */
  private drawParticles(ctx: CanvasRenderingContext2D): void {
    for (const p of this.particles) {
      if (p.alpha <= 0) continue;
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.fillStyle = p.color;
      switch (p.shape) {
        case "circle":
          ctx.beginPath();
          ctx.arc(0, 0, p.size, 0, Math.PI * 2);
          ctx.fill();
          break;
        case "star":
          drawStar(ctx, p.size, p.size * 0.45, 5);
          ctx.fill();
          break;
        case "square":
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
          break;
        case "heart":
          drawHeart(ctx, p.size);
          ctx.fill();
          break;
      }
      ctx.restore();
    }
  }
}

// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────

/** Elastisches Overshoot-Easing (ähnlich easing.spring) */
function springEase(t: number): number {
  if (t === 0) return 0;
  if (t === 1) return 1;
  const c4 = (2 * Math.PI) / 3;
  return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
}

/** Stern-Pfad zentriert auf (0,0) */
function drawStar(
  ctx: CanvasRenderingContext2D,
  outerR: number,
  innerR: number,
  points: number,
): void {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = (i * Math.PI) / points - Math.PI / 2;
    if (i === 0) ctx.moveTo(r * Math.cos(angle), r * Math.sin(angle));
    else ctx.lineTo(r * Math.cos(angle), r * Math.sin(angle));
  }
  ctx.closePath();
}

/** Herz-Pfad zentriert auf (0,0) */
function drawHeart(ctx: CanvasRenderingContext2D, size: number): void {
  const s = size * 0.6;
  ctx.beginPath();
  ctx.moveTo(0, s * 0.4);
  ctx.bezierCurveTo(-s, -s * 0.3, -s * 0.5, -s, 0, -s * 0.4);
  ctx.bezierCurveTo(s * 0.5, -s, s, -s * 0.3, 0, s * 0.4);
  ctx.closePath();
}
