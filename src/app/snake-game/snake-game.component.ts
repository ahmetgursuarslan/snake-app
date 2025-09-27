import { Component, OnInit, HostListener, ElementRef, ViewChild, AfterViewInit, PLATFORM_ID, Inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CommonModule } from '@angular/common';

interface Point {
  x: number;
  y: number;
}

@Component({
  selector: 'app-snake-game',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './snake-game.component.html',
  styleUrl: './snake-game.component.css'
})
export class SnakeGameComponent implements OnInit, AfterViewInit {
  @ViewChild('gameCanvas', { static: true }) gameCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('canvasContainer', { static: true }) canvasContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('bottomRow', { static: true }) bottomRow!: ElementRef<HTMLDivElement>;
  private ctx!: CanvasRenderingContext2D;
  private snake: Point[] = [];
  private food: Point = { x: 0, y: 0 };
  private direction: string = 'right';
  // Board is defined in cells (constant). Pixel size is computed responsively.
  private readonly boardSize: number = 20;
  private gridSize: number = 20; // pixels per cell, computed dynamically
  private canvasSize: number = 400; // pixels, computed dynamically
  private animationFrameId: number | null = null;
  private lastTimestamp = 0;
  private accumulator = 0;
  private stepMs: number = 150; // fixed timestep in ms
  public gameOver: boolean = false;
  public paused: boolean = false;
  public score: number = 0;
  public bestScore: number = 0;
  public gameStarted: boolean = false;
  public scorePulse: boolean = false;
  // Legacy in-canvas listeners kept for cleanup when resetting
  
  // Theme presets for quick fine-tuning (classic, neon, pastel)
  private readonly THEMES = {
    classic: {
      colors: {
        border: '#2e7d32',
        headLight: '#66bb6a',
        bodyLight: '#8bc34a',
        bodyDark: '#689f38',
        connector: 'rgba(124, 179, 66, 0.9)'
      },
      eyeScale: 0.14,
      pupilScale: 0.55,
      connectorThickness: 0.78,
      apple: { contourOpacity: 0.25, sparkleScale: 0.08 }
    },
    neon: {
      colors: {
        border: '#00c853',
        headLight: '#00e676',
        bodyLight: '#69f0ae',
        bodyDark: '#00c853',
        connector: 'rgba(0, 230, 118, 0.95)'
      },
      eyeScale: 0.16,
      pupilScale: 0.50,
      connectorThickness: 0.82,
      apple: { contourOpacity: 0.35, sparkleScale: 0.10 }
    },
    pastel: {
      colors: {
        border: '#5da660',
        headLight: '#a8e6a1',
        bodyLight: '#b9f6ca',
        bodyDark: '#81c784',
        connector: 'rgba(129, 199, 132, 0.85)'
      },
      eyeScale: 0.13,
      pupilScale: 0.60,
      connectorThickness: 0.72,
      apple: { contourOpacity: 0.18, sparkleScale: 0.07 }
    }
  } as const;
  public currentThemeKey: keyof typeof this.THEMES = 'classic';
  private get theme() { return this.THEMES[this.currentThemeKey]; }
  public setTheme(key: keyof typeof this.THEMES) { this.currentThemeKey = key; }
  
  constructor(@Inject(PLATFORM_ID) private platformId: Object) {}

  ngOnInit(): void {
    this.resetGame();
    // Load best score from localStorage if available
    if (isPlatformBrowser(this.platformId)) {
      try {
        const saved = localStorage.getItem('bestScore');
        this.bestScore = saved ? parseInt(saved, 10) || 0 : 0;
      } catch {
        this.bestScore = 0;
      }
    }
  }

  ngAfterViewInit(): void {
    // Only execute canvas operations in browser environment
    if (isPlatformBrowser(this.platformId)) {
      const canvas = this.gameCanvas.nativeElement;
      this.ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
      this.resizeCanvas();
      this.drawStartScreen();
    }
  }

  @HostListener('window:keydown', ['$event'])
  handleKeyDown(event: KeyboardEvent): void {
    // If game is over, allow Enter to restart
    if (event.key === 'Enter' && this.gameOver) {
      this.restartGame();
      return;
    }

    if (this.gameOver) return;

    switch (event.key) {
      case 'ArrowUp':
        if (this.direction !== 'down') this.direction = 'up';
        break;
      case 'ArrowDown':
        if (this.direction !== 'up') this.direction = 'down';
        break;
      case 'ArrowLeft':
        if (this.direction !== 'right') this.direction = 'left';
        break;
      case 'ArrowRight':
        if (this.direction !== 'left') this.direction = 'right';
        break;
      case ' ':
        this.togglePause();
        break;
    }
  }

  startGame(): void {
    // Only start game in browser environment
    if (isPlatformBrowser(this.platformId) && this.gameStarted) {
      this.cancelLoop();
      this.lastTimestamp = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const loop = (ts: number) => {
        const now = ts || (typeof performance !== 'undefined' ? performance.now() : Date.now());
        const dt = now - this.lastTimestamp;
        this.lastTimestamp = now;

        if (!this.paused && !this.gameOver) {
          this.accumulator += dt;
          while (this.accumulator >= this.stepMs) {
            this.moveSnake();
            this.checkCollision();
            this.accumulator -= this.stepMs;
            if (this.gameOver) break;
          }
        }

        // Always draw current frame
        this.draw();
        this.animationFrameId = requestAnimationFrame(loop);
      };
      this.animationFrameId = requestAnimationFrame(loop);
    }
  }
  
  startGameWithButton(): void {
    if (!this.gameStarted) {
      this.gameStarted = true;
      this.startGame();
    }
  }

  resetGame(): void {
    this.cancelLoop();
    this.snake = [
      { x: 5, y: 5 },
      { x: 4, y: 5 },
      { x: 3, y: 5 }
    ];
    this.direction = 'right';
    this.gameOver = false;
    this.paused = false;
    this.score = 0;
    this.accumulator = 0;
    this.stepMs = 150;
    
    // Only perform DOM operations in browser environment
    if (isPlatformBrowser(this.platformId)) {
      // Temizle event listener'ları
      const canvas = this.gameCanvas.nativeElement;
      if (this.mouseMoveListener) {
        canvas.removeEventListener('mousemove', this.mouseMoveListener);
        this.mouseMoveListener = null;
      }
      
      if (this.clickListener) {
        canvas.removeEventListener('click', this.clickListener);
        this.clickListener = null;
      }
    }
    
    this.generateFood();
    
    // Oyunu sıfırla ve ana menüye dön
    this.gameStarted = false;
    if (this.ctx) {
      this.resizeCanvas();
      this.drawStartScreen();
    }
  }

  togglePause(): void {
    this.paused = !this.paused;
    if (this.paused) {
      this.drawPauseScreen();
    } else {
      this.startGame();
    }
  }

  moveSnake(): void {
    if (this.gameOver || this.paused) return;

    const head = { ...this.snake[0] };

    switch (this.direction) {
      case 'up':
        head.y -= 1;
        break;
      case 'down':
        head.y += 1;
        break;
      case 'left':
        head.x -= 1;
        break;
      case 'right':
        head.x += 1;
        break;
    }

    this.snake.unshift(head);

    // Check if snake ate food
    if (head.x === this.food.x && head.y === this.food.y) {
      this.score += 10;
      // Trigger score pulse effect
      if (isPlatformBrowser(this.platformId)) {
        this.scorePulse = true;
        setTimeout(() => (this.scorePulse = false), 200);
      }
      this.generateFood();
      // Increase speed every 50 points (reduce stepMs)
      if (this.score % 50 === 0 && this.stepMs > 50) {
        this.stepMs -= 10;
      }
    } else {
      this.snake.pop();
    }
  }

  // Simple touch controls for mobile
  onTouchControl(dir: 'up' | 'down' | 'left' | 'right'): void {
    // Start game automatically on first touch if not started
    if (!this.gameStarted) {
      this.gameStarted = true;
      this.startGame();
    }
    if (dir === 'up' && this.direction !== 'down') this.direction = 'up';
    if (dir === 'down' && this.direction !== 'up') this.direction = 'down';
    if (dir === 'left' && this.direction !== 'right') this.direction = 'left';
    if (dir === 'right' && this.direction !== 'left') this.direction = 'right';
  }

  // Restart helper for overlay button
  restartGame(): void {
    this.resetGame();
    this.gameStarted = true;
    this.startGame();
  }

  checkCollision(): void {
    const head = this.snake[0];

    // Check wall collision
    if (
      head.x < 0 ||
      head.y < 0 ||
      head.x >= this.canvasSize / this.gridSize ||
      head.y >= this.canvasSize / this.gridSize
    ) {
      this.gameOver = true;
      this.persistBestScore();
      this.cancelLoop();
      return;
    }

    // Check self collision (starting from index 1 to avoid checking head against itself)
    for (let i = 1; i < this.snake.length; i++) {
      if (head.x === this.snake[i].x && head.y === this.snake[i].y) {
        this.gameOver = true;
        this.persistBestScore();
        this.cancelLoop();
        return;
      }
    }
  }

  generateFood(): void {
    const maxX = this.canvasSize / this.gridSize - 1;
    const maxY = this.canvasSize / this.gridSize - 1;
    
    let newFood: Point;
    let foodOnSnake: boolean;
    
    do {
      foodOnSnake = false;
      newFood = {
        x: Math.floor(Math.random() * maxX),
        y: Math.floor(Math.random() * maxY)
      };
      
      // Check if food is on snake
      for (const segment of this.snake) {
        if (segment.x === newFood.x && segment.y === newFood.y) {
          foodOnSnake = true;
          break;
        }
      }
    } while (foodOnSnake);
    
    this.food = newFood;
  }

  draw(): void {
    // Only execute canvas operations in browser environment
    if (!isPlatformBrowser(this.platformId) || !this.ctx || !this.gameStarted) return;
    
    // Static background
    this.drawBackground();

    // Draw redesigned snake
    this.drawSnake();

    // Draw apple as food
    this.drawAppleAtCell(this.food.x, this.food.y);

    // Minimal in-game score badge for visibility while playing
    this.drawScoreBadge();
  }
  private drawScoreBadge(): void {
    const pad = Math.max(8, this.gridSize * 0.25);
    const h = Math.max(28, this.gridSize * 1.1);
    const w = Math.max(90, this.gridSize * 3.2);
    const x = pad;
    const y = pad;
    this.ctx.save();
    this.ctx.globalAlpha = 0.85;
    this.ctx.fillStyle = 'rgba(0,0,0,0.35)';
    this.roundRect(x, y, w, h, 8, true, false);
    this.ctx.globalAlpha = 1;
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = `600 ${Math.max(14, Math.floor(this.gridSize * 0.6))}px "Poppins", sans-serif`;
    this.ctx.textBaseline = 'middle';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(`Score: ${this.score}`, x + w / 2, y + h / 2 + 1);
    this.ctx.restore();
  }

  private drawBackground(): void {
    // Static soft gradient background
    const g = this.ctx.createLinearGradient(0, 0, 0, this.canvasSize);
    g.addColorStop(0, '#f3f7f3');
    g.addColorStop(1, '#eaf2ea');
    this.ctx.fillStyle = g;
    this.ctx.fillRect(0, 0, this.canvasSize, this.canvasSize);

    // Subtle static grid for game feel (no animation)
    this.ctx.strokeStyle = 'rgba(0,0,0,0.05)';
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    for (let x = 0; x <= this.canvasSize; x += this.gridSize) {
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, this.canvasSize);
    }
    for (let y = 0; y <= this.canvasSize; y += this.gridSize) {
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(this.canvasSize, y);
    }
    this.ctx.stroke();
  }

  private drawSnake(): void {
    const r = Math.max(4, Math.floor(this.gridSize * 0.22)); // corner radius

    // 1) Connector path to create smooth links between segments
    if (this.snake.length > 1) {
      // use themed thickness
      const themedThick = Math.max(4, this.gridSize * this.theme.connectorThickness);
      this.ctx.save();
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';
      this.ctx.lineWidth = themedThick;
      this.ctx.strokeStyle = this.theme.colors.connector;
      this.ctx.beginPath();
      const last = this.snake.length - 1;
      this.ctx.moveTo(
        this.snake[last].x * this.gridSize + this.gridSize / 2,
        this.snake[last].y * this.gridSize + this.gridSize / 2
      );
      for (let i = last - 1; i >= 0; i--) {
        this.ctx.lineTo(
          this.snake[i].x * this.gridSize + this.gridSize / 2,
          this.snake[i].y * this.gridSize + this.gridSize / 2
        );
      }
      this.ctx.stroke();
      this.ctx.restore();
    }

    // 2) Segment-by-segment rendering with gradient and slight shadow
    this.ctx.save();
    this.ctx.shadowColor = 'rgba(0,0,0,0.12)';
    this.ctx.shadowBlur = Math.max(2, this.gridSize * 0.08);
    this.ctx.shadowOffsetY = Math.max(1, this.gridSize * 0.06);

    for (let i = this.snake.length - 1; i >= 0; i--) {
      const seg = this.snake[i];
      const x = seg.x * this.gridSize;
      const y = seg.y * this.gridSize;

      // Gradient per segment
      const grad = this.ctx.createLinearGradient(x, y, x + this.gridSize, y + this.gridSize);
      if (i === 0) {
        grad.addColorStop(0, this.theme.colors.headLight);
        grad.addColorStop(1, this.theme.colors.bodyDark);
      } else {
        grad.addColorStop(0, this.theme.colors.bodyLight);
        grad.addColorStop(1, this.theme.colors.bodyDark);
      }

      this.ctx.fillStyle = grad;
      this.ctx.strokeStyle = this.theme.colors.border;
      this.roundRect(x + 1, y + 1, this.gridSize - 2, this.gridSize - 2, r, true, true);
    }
    this.ctx.restore();

    // Head details (eyes/pupils) based on direction
    const head = this.snake[0];
    if (head) {
      const hx = head.x * this.gridSize;
      const hy = head.y * this.gridSize;
      const cx = hx + this.gridSize / 2;
      const cy = hy + this.gridSize / 2;
  const eyeR = Math.max(2, this.gridSize * this.theme.eyeScale);
  const pupilR = Math.max(1, eyeR * this.theme.pupilScale);
      let ex1 = cx, ey1 = cy, ex2 = cx, ey2 = cy;
      const off = this.gridSize * 0.22;

      switch (this.direction) {
        case 'up':
          ex1 = cx - off * 0.5; ey1 = hy + this.gridSize * 0.30;
          ex2 = cx + off * 0.5; ey2 = hy + this.gridSize * 0.30;
          break;
        case 'down':
          ex1 = cx - off * 0.5; ey1 = hy + this.gridSize * 0.70;
          ex2 = cx + off * 0.5; ey2 = hy + this.gridSize * 0.70;
          break;
        case 'left':
          ex1 = hx + this.gridSize * 0.30; ey1 = cy - off * 0.5;
          ex2 = hx + this.gridSize * 0.30; ey2 = cy + off * 0.5;
          break;
        case 'right':
          ex1 = hx + this.gridSize * 0.70; ey1 = cy - off * 0.5;
          ex2 = hx + this.gridSize * 0.70; ey2 = cy + off * 0.5;
          break;
      }

      // Whites
      this.ctx.fillStyle = '#ffffff';
      this.ctx.beginPath();
      this.ctx.arc(ex1, ey1, eyeR, 0, Math.PI * 2);
      this.ctx.arc(ex2, ey2, eyeR, 0, Math.PI * 2);
      this.ctx.fill();
      // Pupils
      this.ctx.fillStyle = this.theme.colors.border;
      this.ctx.beginPath();
      this.ctx.arc(ex1, ey1, pupilR, 0, Math.PI * 2);
      this.ctx.arc(ex2, ey2, pupilR, 0, Math.PI * 2);
      this.ctx.fill();

      // Tongue flicker: occasionally extend a small forked tongue
  const now = Date.now();
  const flicker = this.gameStarted && !this.paused && !this.gameOver && (now % 1000) < 160; // ~160ms visible per 1s
      if (flicker) {
        const tLen = Math.max(6, this.gridSize * 0.45);
        const tW = Math.max(2, this.gridSize * 0.08);
        const fork = Math.max(3, this.gridSize * 0.12);
        this.ctx.strokeStyle = '#e53935';
        this.ctx.lineWidth = Math.max(1.5, this.gridSize * 0.06);
        this.ctx.beginPath();
        switch (this.direction) {
          case 'up':
            this.ctx.moveTo(cx, hy + 2);
            this.ctx.lineTo(cx, hy - tLen);
            this.ctx.moveTo(cx, hy - tLen);
            this.ctx.lineTo(cx - fork, hy - tLen - fork);
            this.ctx.moveTo(cx, hy - tLen);
            this.ctx.lineTo(cx + fork, hy - tLen - fork);
            break;
          case 'down':
            this.ctx.moveTo(cx, hy + this.gridSize - 2);
            this.ctx.lineTo(cx, hy + this.gridSize + tLen);
            this.ctx.moveTo(cx, hy + this.gridSize + tLen);
            this.ctx.lineTo(cx - fork, hy + this.gridSize + tLen + fork);
            this.ctx.moveTo(cx, hy + this.gridSize + tLen);
            this.ctx.lineTo(cx + fork, hy + this.gridSize + tLen + fork);
            break;
          case 'left':
            this.ctx.moveTo(hx + 2, cy);
            this.ctx.lineTo(hx - tLen, cy);
            this.ctx.moveTo(hx - tLen, cy);
            this.ctx.lineTo(hx - tLen - fork, cy - fork);
            this.ctx.moveTo(hx - tLen, cy);
            this.ctx.lineTo(hx - tLen - fork, cy + fork);
            break;
          case 'right':
            this.ctx.moveTo(hx + this.gridSize - 2, cy);
            this.ctx.lineTo(hx + this.gridSize + tLen, cy);
            this.ctx.moveTo(hx + this.gridSize + tLen, cy);
            this.ctx.lineTo(hx + this.gridSize + tLen + fork, cy - fork);
            this.ctx.moveTo(hx + this.gridSize + tLen, cy);
            this.ctx.lineTo(hx + this.gridSize + tLen + fork, cy + fork);
            break;
        }
        this.ctx.stroke();
      }
    }
  }

  private roundRect(x: number, y: number, w: number, h: number, r: number, fill = false, stroke = false): void {
    this.ctx.beginPath();
    if (this.ctx.roundRect) {
      this.ctx.roundRect(x, y, w, h, r);
    } else {
      const rr = Math.min(r, w / 2, h / 2);
      this.ctx.moveTo(x + rr, y);
      this.ctx.lineTo(x + w - rr, y);
      this.ctx.arcTo(x + w, y, x + w, y + rr, rr);
      this.ctx.lineTo(x + w, y + h - rr);
      this.ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr);
      this.ctx.lineTo(x + rr, y + h);
      this.ctx.arcTo(x, y + h, x, y + h - rr, rr);
      this.ctx.lineTo(x, y + rr);
      this.ctx.arcTo(x, y, x + rr, y, rr);
    }
    if (fill) this.ctx.fill();
    if (stroke) this.ctx.stroke();
  }

  // Event listener referanslarını saklamak için sınıf değişkenleri
  private mouseMoveListener: ((event: MouseEvent) => void) | null = null;
  private clickListener: ((event: MouseEvent) => void) | null = null;

  // Handle responsive canvas sizing
  @HostListener('window:resize')
  onWindowResize(): void {
    if (!isPlatformBrowser(this.platformId) || !this.ctx) return;
    this.resizeCanvas();
    // Redraw appropriate screen
    if (this.gameOver) {
      this.drawGameOverScreen();
    } else if (this.paused) {
      this.drawPauseScreen();
    } else if (this.gameStarted) {
      this.draw();
    } else {
      this.drawStartScreen();
    }
  }

  private resizeCanvas(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const canvas = this.gameCanvas?.nativeElement;
    if (!canvas) return;

    // Target 70% of the viewport's smaller dimension to keep it centered and prominent on web
    const vw = typeof window !== 'undefined' ? window.innerWidth : this.canvasSize;
    const vh = typeof window !== 'undefined' ? window.innerHeight : this.canvasSize;
    const desired = Math.floor(Math.min(vw, vh) * 0.7);
    // Clamp to reasonable bounds
    const clamped = Math.max(320, Math.min(1200, desired));

    // Compute grid size from desired canvas size based on fixed board cells
    const newGrid = Math.max(10, Math.floor(clamped / this.boardSize));
    this.gridSize = newGrid;
    this.canvasSize = this.gridSize * this.boardSize; // ensure exact multiple

    // HiDPI scaling for sharp rendering
    const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) ? window.devicePixelRatio : 1;
    canvas.width = this.canvasSize * dpr;
    canvas.height = this.canvasSize * dpr;
    // Visual size is controlled by container; keep canvas at 100% via CSS
    // Reset context transform and apply DPR scale
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Set container and bottom row widths to match game area
    if (this.canvasContainer?.nativeElement) {
      this.canvasContainer.nativeElement.style.width = `${this.canvasSize}px`;
    }
    if (this.bottomRow?.nativeElement) {
      this.bottomRow.nativeElement.style.width = `${this.canvasSize}px`;
    }
  }

  drawGameOverScreen(): void {
    // Only execute canvas operations in browser environment
    if (!isPlatformBrowser(this.platformId) || !this.ctx) return;
    
    // Canvas referansını al
    const canvas = this.gameCanvas.nativeElement;
    
    // Yarı saydam gradient arka plan
    const gradient = this.ctx.createRadialGradient(
      this.canvasSize / 2, this.canvasSize / 2, 0,
      this.canvasSize / 2, this.canvasSize / 2, this.canvasSize
    );
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0.7)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0.9)');
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, this.canvasSize, this.canvasSize);
    
  // Dialog kutusu arka planı
  const dialogWidth = 320;
  const dialogHeight = 180;
    const dialogX = (this.canvasSize - dialogWidth) / 2;
    const dialogY = (this.canvasSize - dialogHeight) / 2;
    
    // Dialog kutusu animasyonu için zamanlayıcı
    let animationStartTime = Date.now();
    const animationDuration = 700; // 700ms - daha yumuşak animasyon
    
    const drawDialog = () => {
      const currentTime = Date.now();
      const elapsedTime = currentTime - animationStartTime;
      const progress = Math.min(elapsedTime / animationDuration, 1);
      
      // Easing fonksiyonu - daha doğal animasyon
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      
      // Dialog kutusu gölgesi
      this.ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
      this.ctx.shadowBlur = 20;
      this.ctx.shadowOffsetX = 0;
      this.ctx.shadowOffsetY = 8;
      
      // Dialog kutusu arka planı - animasyonlu ölçeklendirme
      const scaledWidth = dialogWidth * easedProgress;
      const scaledHeight = dialogHeight * easedProgress;
      const scaledX = dialogX + (dialogWidth - scaledWidth) / 2;
      const scaledY = dialogY + (dialogHeight - scaledHeight) / 2;
      
      // Gradient arka plan
      const bgGradient = this.ctx.createLinearGradient(scaledX, scaledY, scaledX, scaledY + scaledHeight);
      bgGradient.addColorStop(0, '#ffffff');
      bgGradient.addColorStop(1, '#f0f0f0');
      this.ctx.fillStyle = bgGradient;
      
      // Yuvarlatılmış köşeli dialog kutusu
      this.ctx.beginPath();
      const cornerRadius = 12;
      
      if (this.ctx.roundRect) {
        this.ctx.roundRect(scaledX, scaledY, scaledWidth, scaledHeight, cornerRadius);
      } else {
        // Eski tarayıcılar için manuel yuvarlatılmış köşeler
        this.ctx.moveTo(scaledX + cornerRadius, scaledY);
        this.ctx.lineTo(scaledX + scaledWidth - cornerRadius, scaledY);
        this.ctx.arcTo(scaledX + scaledWidth, scaledY, scaledX + scaledWidth, scaledY + cornerRadius, cornerRadius);
        this.ctx.lineTo(scaledX + scaledWidth, scaledY + scaledHeight - cornerRadius);
        this.ctx.arcTo(scaledX + scaledWidth, scaledY + scaledHeight, scaledX + scaledWidth - cornerRadius, scaledY + scaledHeight, cornerRadius);
        this.ctx.lineTo(scaledX + cornerRadius, scaledY + scaledHeight);
        this.ctx.arcTo(scaledX, scaledY + scaledHeight, scaledX, scaledY + scaledHeight - cornerRadius, cornerRadius);
        this.ctx.lineTo(scaledX, scaledY + cornerRadius);
        this.ctx.arcTo(scaledX, scaledY, scaledX + cornerRadius, scaledY, cornerRadius);
      }
      
      this.ctx.fill();
      
      // İnce kenarlık
      this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
      this.ctx.lineWidth = 1;
      this.ctx.stroke();
      
      // Gölgeyi sıfırla
      this.ctx.shadowColor = 'transparent';
      this.ctx.shadowBlur = 0;
      this.ctx.shadowOffsetX = 0;
      this.ctx.shadowOffsetY = 0;
      
      if (progress < 1) {
        // Animasyon devam ediyor, bir sonraki kareyi çiz
        requestAnimationFrame(drawDialog);
      } else {
        // Animasyon tamamlandı, içeriği çiz
        drawDialogContent();
      }
    };
    
    const drawDialogContent = () => {
      // Üst kısım için dekoratif çizgi
      const lineY = dialogY + 35;
      const gradientLine = this.ctx.createLinearGradient(
        dialogX + 20, lineY, dialogX + dialogWidth - 20, lineY
      );
      gradientLine.addColorStop(0, 'rgba(233, 30, 99, 0.1)');
      gradientLine.addColorStop(0.5, 'rgba(233, 30, 99, 0.6)');
      gradientLine.addColorStop(1, 'rgba(233, 30, 99, 0.1)');
      
      this.ctx.strokeStyle = gradientLine;
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.moveTo(dialogX + 20, lineY);
      this.ctx.lineTo(dialogX + dialogWidth - 20, lineY);
      this.ctx.stroke();
      
      // Oyun Bitti başlığı - gradient metin
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      
      // Metin gölgesi
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
      this.ctx.font = 'bold 34px "Poppins", sans-serif';
      this.ctx.fillText('GAME OVER', this.canvasSize / 2 + 2, dialogY + 70 + 2);
      
      // Gradient metin
      const textGradient = this.ctx.createLinearGradient(
        this.canvasSize / 2 - 80, dialogY + 70,
        this.canvasSize / 2 + 80, dialogY + 70
      );
      textGradient.addColorStop(0, '#e53935');
      textGradient.addColorStop(1, '#d32f2f');
      this.ctx.fillStyle = textGradient;
      this.ctx.font = 'bold 34px "Poppins", sans-serif';
      this.ctx.fillText('GAME OVER', this.canvasSize / 2, dialogY + 70);
      
      // Skor gösterimi - daha modern görünüm
      this.ctx.fillStyle = '#424242';
      this.ctx.font = '600 26px "Poppins", sans-serif';
      this.ctx.fillText(`SCORE: ${this.score}`, this.canvasSize / 2, dialogY + 120);
    };
    
    // Animasyonu başlat
    drawDialog();
  }
  
  // Removed interactive restart button; UI controls handle restart

  drawPauseScreen(): void {
    // Only execute canvas operations in browser environment
    if (!isPlatformBrowser(this.platformId) || !this.ctx) return;
    
    // Dim the background
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    this.ctx.fillRect(0, 0, this.canvasSize, this.canvasSize);

    // Title
    this.ctx.fillStyle = '#fff';
    this.ctx.font = 'bold 28px "Poppins", sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('Paused', this.canvasSize / 2, this.canvasSize / 2);
  }

  drawStartScreen(): void {
    // Only execute canvas operations in browser environment
    if (!isPlatformBrowser(this.platformId) || !this.ctx) return;
    
    // Canvas referansını al
    const canvas = this.gameCanvas.nativeElement;
    
    // Arka plan
    const gradient = this.ctx.createRadialGradient(
      this.canvasSize / 2, this.canvasSize / 2, 0,
      this.canvasSize / 2, this.canvasSize / 2, this.canvasSize
    );
    gradient.addColorStop(0, 'rgba(46, 125, 50, 0.7)');
    gradient.addColorStop(1, 'rgba(27, 94, 32, 0.9)');
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, this.canvasSize, this.canvasSize);
    
    // Oyun başlığı
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    
    // Metin gölgesi
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    this.ctx.font = 'bold 40px "Poppins", sans-serif';
    this.ctx.fillText('SNAKE GAME', this.canvasSize / 2 + 2, this.canvasSize / 2 - 70 + 2);
    
    // Başlık metni
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = 'bold 40px "Poppins", sans-serif';
    this.ctx.fillText('SNAKE GAME', this.canvasSize / 2, this.canvasSize / 2 - 70);
    
  // Only show title; actions are below the canvas in the UI
  const buttonWidth = 0;
  const buttonHeight = 0;
  const buttonX = 0;
  const buttonY = 0;
    
    // Buton gölgesi
    this.ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
    this.ctx.shadowBlur = 10;
    this.ctx.shadowOffsetX = 0;
    this.ctx.shadowOffsetY = 4;
    
    // Buton arka planı - gradient
    const buttonGradient = this.ctx.createLinearGradient(
      buttonX, buttonY,
      buttonX, buttonY + buttonHeight
    );
    buttonGradient.addColorStop(0, '#4CAF50');
    buttonGradient.addColorStop(1, '#388E3C');
    this.ctx.fillStyle = buttonGradient;
    
    // Yuvarlatılmış köşeli buton
    this.ctx.beginPath();
    const buttonRadius = 10;
    
    if (this.ctx.roundRect) {
      this.ctx.roundRect(buttonX, buttonY, buttonWidth, buttonHeight, buttonRadius);
    } else {
      // Eski tarayıcılar için manuel yuvarlatılmış köşeler
      this.ctx.moveTo(buttonX + buttonRadius, buttonY);
      this.ctx.lineTo(buttonX + buttonWidth - buttonRadius, buttonY);
      this.ctx.arcTo(buttonX + buttonWidth, buttonY, buttonX + buttonWidth, buttonY + buttonRadius, buttonRadius);
      this.ctx.lineTo(buttonX + buttonWidth, buttonY + buttonHeight - buttonRadius);
      this.ctx.arcTo(buttonX + buttonWidth, buttonY + buttonHeight, buttonX + buttonWidth - buttonRadius, buttonY + buttonHeight, buttonRadius);
      this.ctx.lineTo(buttonX + buttonRadius, buttonY + buttonHeight);
      this.ctx.arcTo(buttonX, buttonY + buttonHeight, buttonX, buttonY + buttonHeight - buttonRadius, buttonRadius);
      this.ctx.lineTo(buttonX, buttonY + buttonRadius);
      this.ctx.arcTo(buttonX, buttonY, buttonX + buttonRadius, buttonY, buttonRadius);
    }
    
    this.ctx.fill();
    
    // Buton parlaması - üst kısımda hafif beyaz çizgi
    this.ctx.beginPath();
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    this.ctx.lineWidth = 1;
    if (this.ctx.roundRect) {
      this.ctx.roundRect(buttonX + 2, buttonY + 2, buttonWidth - 4, buttonHeight / 3, [buttonRadius, buttonRadius, 0, 0]);
    } else {
      this.ctx.moveTo(buttonX + buttonRadius, buttonY + 2);
      this.ctx.lineTo(buttonX + buttonWidth - buttonRadius, buttonY + 2);
      this.ctx.arcTo(buttonX + buttonWidth - 2, buttonY + 2, buttonX + buttonWidth - 2, buttonY + buttonRadius, buttonRadius - 2);
      this.ctx.lineTo(buttonX + buttonWidth - 2, buttonY + buttonHeight / 3);
      this.ctx.lineTo(buttonX + 2, buttonY + buttonHeight / 3);
      this.ctx.lineTo(buttonX + 2, buttonY + buttonRadius);
      this.ctx.arcTo(buttonX + 2, buttonY + 2, buttonX + buttonRadius, buttonY + 2, buttonRadius - 2);
    }
    this.ctx.stroke();
    
  // Gölgeyi sıfırla
    this.ctx.shadowColor = 'transparent';
    this.ctx.shadowBlur = 0;
    this.ctx.shadowOffsetX = 0;
    this.ctx.shadowOffsetY = 0;
    
  // Oyun kontrolleri bilgisi (üstte daha küçük)
  this.ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  this.ctx.font = '14px "Poppins", sans-serif';
  this.ctx.fillText('Use arrow keys • SPACE to pause • ENTER to restart', this.canvasSize / 2, this.canvasSize / 2 + 20);
    
    // Önceki click listener'ı kaldır (eğer varsa)
    if (this.clickListener) {
      canvas.removeEventListener('click', this.clickListener);
      this.clickListener = null;
    }
    
    // Önceki mousemove listener'ı kaldır
    if (this.mouseMoveListener) {
      canvas.removeEventListener('mousemove', this.mouseMoveListener);
      this.mouseMoveListener = null;
    }
    
    // No in-canvas listeners on start screen
  }

  // Removed in-canvas bottom HUD; controls are outside the canvas in the template

  // Removed in-canvas click listener; we use standard HTML buttons below the canvas

  private drawAppleAtCell(cellX: number, cellY: number): void {
    const cx = cellX * this.gridSize + this.gridSize / 2;
    const cy = cellY * this.gridSize + this.gridSize / 2;
    const baseR = this.gridSize * 0.36;

    this.ctx.save();
    this.ctx.translate(cx, cy);

    // Animation timing
    const t = Date.now() * 0.006; // ~6ms per unit
    const pulse = 1 + 0.10 * Math.sin(t); // apple pulsates
    const shadowScale = 0.28 + 0.06 * (1 - Math.cos(t)); // subtle shadow breath

    // Soft shadow under apple (animated)
    this.ctx.fillStyle = 'rgba(0,0,0,0.16)';
    this.ctx.beginPath();
    this.ctx.ellipse(0, baseR * 0.95, baseR * 0.95, baseR * shadowScale, 0, 0, Math.PI * 2);
    this.ctx.fill();

    // Body (radial gradient, static)
    const grad = this.ctx.createRadialGradient(-baseR * 0.3, -baseR * 0.5, baseR * 0.2, 0, 0, baseR * 1.6);
    grad.addColorStop(0, '#ff7b7b');
    grad.addColorStop(1, '#c62828');
    this.ctx.fillStyle = grad;

    // Left and right lobes (pulsing)
    this.ctx.save();
    this.ctx.scale(pulse, pulse);
    this.ctx.beginPath();
    this.ctx.arc(-baseR * 0.6, 0, baseR, 0, Math.PI * 2);
    this.ctx.arc(baseR * 0.6, 0, baseR, 0, Math.PI * 2);
    this.ctx.fill();

    // Slight bottom flatten
    this.ctx.beginPath();
    this.ctx.ellipse(0, baseR * 0.4, baseR * 1.2, baseR * 1.0, 0, 0, Math.PI * 2);
    this.ctx.fill();

    // Stem
    this.ctx.strokeStyle = '#5d4037';
    this.ctx.lineWidth = Math.max(2, this.gridSize * 0.08);
    this.ctx.beginPath();
    this.ctx.moveTo(0, -baseR * 1.4);
    this.ctx.quadraticCurveTo(baseR * 0.2, -baseR * 1.9, baseR * 0.5, -baseR * 1.6);
    this.ctx.stroke();

    // Leaf
    this.ctx.fillStyle = '#66bb6a';
    this.ctx.beginPath();
    this.ctx.ellipse(baseR * 0.7, -baseR * 1.5, baseR * 0.6, baseR * 0.3, -0.6, 0, Math.PI * 2);
    this.ctx.fill();

    // Glossy highlight
    this.ctx.fillStyle = 'rgba(255,255,255,0.28)';
    this.ctx.beginPath();
    this.ctx.ellipse(-baseR * 0.3, -baseR * 0.3, baseR * 0.5, baseR * 0.25, -0.5, 0, Math.PI * 2);
    this.ctx.fill();

  // Contour (very subtle)
  this.ctx.strokeStyle = `rgba(120, 0, 0, ${this.theme.apple.contourOpacity})`;
    this.ctx.lineWidth = Math.max(1, this.gridSize * 0.06);
    this.ctx.beginPath();
    this.ctx.ellipse(0, 0, baseR * 1.25, baseR * 1.05, 0, 0, Math.PI * 2);
    this.ctx.stroke();

    // Sparkle star
    const sx = -baseR * 0.05;
    const sy = -baseR * 0.65;
  const s = Math.max(1.2, this.gridSize * this.theme.apple.sparkleScale);
    this.ctx.fillStyle = 'rgba(255,255,255,0.85)';
    this.ctx.beginPath();
    this.ctx.moveTo(sx, sy - s);
    this.ctx.lineTo(sx + s * 0.55, sy);
    this.ctx.lineTo(sx, sy + s);
    this.ctx.lineTo(sx - s * 0.55, sy);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.restore(); // end of apple pulse scale
    this.ctx.restore();
  }

  private cancelLoop(): void {
    if (this.animationFrameId != null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  private persistBestScore(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    if (this.score > this.bestScore) {
      this.bestScore = this.score;
      try { localStorage.setItem('bestScore', String(this.bestScore)); } catch {}
    }
  }
}