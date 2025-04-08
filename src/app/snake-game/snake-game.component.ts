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
  private ctx!: CanvasRenderingContext2D;
  private snake: Point[] = [];
  private food: Point = { x: 0, y: 0 };
  private direction: string = 'right';
  private gridSize: number = 20;
  private canvasSize: number = 400;
  private gameInterval: any;
  private gameSpeed: number = 150;
  private gameOver: boolean = false;
  public paused: boolean = false;
  public score: number = 0;
  public gameStarted: boolean = false;
  
  constructor(@Inject(PLATFORM_ID) private platformId: Object) {}

  ngOnInit(): void {
    this.resetGame();
  }

  ngAfterViewInit(): void {
    // Only execute canvas operations in browser environment
    if (isPlatformBrowser(this.platformId)) {
      const canvas = this.gameCanvas.nativeElement;
      canvas.width = this.canvasSize;
      canvas.height = this.canvasSize;
      this.ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
      this.drawStartScreen();
    }
  }

  @HostListener('window:keydown', ['$event'])
  handleKeyDown(event: KeyboardEvent): void {
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
      case 'Enter':
        if (this.gameOver) this.resetGame();
        break;
    }
  }

  startGame(): void {
    // Only start game in browser environment
    if (isPlatformBrowser(this.platformId) && !this.gameOver && !this.paused && this.gameStarted) {
      this.gameInterval = setInterval(() => {
        this.moveSnake();
        this.checkCollision();
        this.draw();
      }, this.gameSpeed);
    }
  }
  
  startGameWithButton(): void {
    if (!this.gameStarted) {
      this.gameStarted = true;
      this.startGame();
    }
  }

  resetGame(): void {
    clearInterval(this.gameInterval);
    this.snake = [
      { x: 5, y: 5 },
      { x: 4, y: 5 },
      { x: 3, y: 5 }
    ];
    this.direction = 'right';
    this.gameOver = false;
    this.paused = false;
    this.score = 0;
    
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
      this.drawStartScreen();
    }
  }

  togglePause(): void {
    this.paused = !this.paused;
    if (this.paused) {
      clearInterval(this.gameInterval);
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
      this.generateFood();
      // Increase speed every 50 points
      if (this.score % 50 === 0 && this.gameSpeed > 50) {
        this.gameSpeed -= 10;
        clearInterval(this.gameInterval);
        this.startGame();
      }
    } else {
      this.snake.pop();
    }
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
      clearInterval(this.gameInterval);
      this.drawGameOverScreen();
      return;
    }

    // Check self collision (starting from index 1 to avoid checking head against itself)
    for (let i = 1; i < this.snake.length; i++) {
      if (head.x === this.snake[i].x && head.y === this.snake[i].y) {
        this.gameOver = true;
        clearInterval(this.gameInterval);
        this.drawGameOverScreen();
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

    // Clear canvas
    this.ctx.fillStyle = '#f0f0f0';
    this.ctx.fillRect(0, 0, this.canvasSize, this.canvasSize);

    // Draw score background
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
    this.ctx.fillRect(0, 0, this.canvasSize, 40);
    
    // Draw score text
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = 'bold 20px "Poppins", sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(`SCORE: ${this.score}`, this.canvasSize / 2, 25);

    // Draw snake
    this.snake.forEach((segment, index) => {
      this.ctx.fillStyle = index === 0 ? '#4CAF50' : '#8BC34A';
      this.ctx.fillRect(
        segment.x * this.gridSize,
        segment.y * this.gridSize,
        this.gridSize,
        this.gridSize
      );
      
      // Draw border around segment
      this.ctx.strokeStyle = '#388E3C';
      this.ctx.strokeRect(
        segment.x * this.gridSize,
        segment.y * this.gridSize,
        this.gridSize,
        this.gridSize
      );
    });

    // Draw food
    this.ctx.fillStyle = '#F44336';
    this.ctx.beginPath();
    this.ctx.arc(
      this.food.x * this.gridSize + this.gridSize / 2,
      this.food.y * this.gridSize + this.gridSize / 2,
      this.gridSize / 2,
      0,
      Math.PI * 2
    );
    this.ctx.fill();
  }

  // Event listener referanslarını saklamak için sınıf değişkenleri
  private mouseMoveListener: ((event: MouseEvent) => void) | null = null;
  private clickListener: ((event: MouseEvent) => void) | null = null;

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
    const dialogHeight = 280;
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
      
      // Yeniden başlatma butonu çizimi
      const buttonX = this.canvasSize / 2 - 100;
      const buttonY = dialogY + 170;
      const buttonWidth = 200;
      const buttonHeight = 50;
      
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
      
      // Buton metni
      this.ctx.fillStyle = '#ffffff';
      this.ctx.font = 'bold 20px "Poppins", sans-serif';
      this.ctx.fillText('RESTART', this.canvasSize  / 2, buttonY + buttonHeight  / 2);
      
      // Buton tıklama olayını ekle
      this.addRestartButtonListener(buttonX, buttonY, buttonWidth, buttonHeight);
      
      // Önceki mousemove listener'ı kaldır
      if (this.mouseMoveListener) {
        canvas.removeEventListener('mousemove', this.mouseMoveListener);
      }
      
      // Yeni mousemove listener'ı ekle
      this.mouseMoveListener = (event: MouseEvent) => {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const mouseX = (event.clientX - rect.left) * scaleX;
        const mouseY = (event.clientY - rect.top) * scaleY;
        
        // Fare butonun üzerinde mi kontrol et
        if (
          mouseX >= buttonX && mouseX <= buttonX + buttonWidth &&
          mouseY >= buttonY && mouseY <= buttonY + buttonHeight
        ) {
          canvas.style.cursor = 'pointer';
        } else {
          canvas.style.cursor = 'default';
        }
      };
      
      canvas.addEventListener('mousemove', this.mouseMoveListener);
    };
    
    // Animasyonu başlat
    drawDialog();
  }
  
  private addRestartButtonListener(x: number, y: number, width: number, height: number): void {
    const canvas = this.gameCanvas.nativeElement;
    
    // Önceki click listener'ı kaldır (eğer varsa)
    if (this.clickListener) {
      canvas.removeEventListener('click', this.clickListener);
      this.clickListener = null;
    }
    
    this.clickListener = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const clickX = (event.clientX - rect.left) * scaleX;
      const clickY = (event.clientY - rect.top) * scaleY;
      
      if (
        clickX >= x && 
        clickX <= x + width && 
        clickY >= y && 
        clickY <= y + height && 
        this.gameOver
      ) {
        // Oyunu sıfırla ve hemen yeniden başlat
        this.resetGame();
        this.gameStarted = true;
        this.startGame();
      }
    };
    
    canvas.addEventListener('click', this.clickListener);
  }

  drawPauseScreen(): void {
    // Only execute canvas operations in browser environment
    if (!isPlatformBrowser(this.platformId) || !this.ctx) return;
    
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    this.ctx.fillRect(0, 0, this.canvasSize, this.canvasSize);
    
    this.ctx.fillStyle = '#fff';
    this.ctx.font = '30px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('Paused', this.canvasSize / 2, this.canvasSize / 2);
    
    this.ctx.font = '16px Arial';
    this.ctx.fillText('Press SPACE to continue', this.canvasSize / 2, this.canvasSize / 2 + 40);
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
    
    // Play butonu çizimi
    const buttonX = this.canvasSize / 2 - 100;
    const buttonY = this.canvasSize / 2;
    const buttonWidth = 200;
    const buttonHeight = 50;
    
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
    
    // Buton metni
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = 'bold 20px "Poppins", sans-serif';
    this.ctx.fillText('PLAY', this.canvasSize / 2, buttonY + buttonHeight / 2);
    
    // Oyun kontrolleri bilgisi
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    this.ctx.font = '14px "Poppins", sans-serif';
    this.ctx.fillText('Use arrow keys to control the snake', this.canvasSize / 2, this.canvasSize / 2 + 80);
    this.ctx.fillText('Press SPACE to pause', this.canvasSize / 2, this.canvasSize / 2 + 105);
    
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
    
    // Play butonu için click listener ekle
    this.clickListener = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const clickX = (event.clientX - rect.left) * scaleX;
      const clickY = (event.clientY - rect.top) * scaleY;
      
      if (
        clickX >= buttonX && 
        clickX <= buttonX + buttonWidth && 
        clickY >= buttonY && 
        clickY <= buttonY + buttonHeight && 
        !this.gameStarted
      ) {
        this.startGameWithButton();
      }
    };
    
    canvas.addEventListener('click', this.clickListener);
    
    // Fare imleci için mousemove listener ekle
    this.mouseMoveListener = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const mouseX = (event.clientX - rect.left) * scaleX;
      const mouseY = (event.clientY - rect.top) * scaleY;
      
      // Fare butonun üzerinde mi kontrol et
      if (
        mouseX >= buttonX && mouseX <= buttonX + buttonWidth &&
        mouseY >= buttonY && mouseY <= buttonY + buttonHeight
      ) {
        canvas.style.cursor = 'pointer';
      } else {
        canvas.style.cursor = 'default';
      }
    };
    
    canvas.addEventListener('mousemove', this.mouseMoveListener);
  }
}