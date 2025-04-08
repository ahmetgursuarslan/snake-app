import { Component } from '@angular/core';
import { SnakeGameComponent } from './snake-game/snake-game.component';

@Component({
  selector: 'app-root',
  imports: [SnakeGameComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  title = 'Snake Game';
}
