import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Header } from './header/header';
import { HomeAtf } from './homepage/home-atf/home-atf';
import { Footer } from './footer/footer';

@Component({
  selector: 'app-root',
  standalone: true, // Markiert die App als Standalone
  imports: [RouterOutlet, Header, HomeAtf, Footer], // Importiere benötigte Komponenten
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('photography_manually');
}
