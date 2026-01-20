import { Component, signal, ViewChild, ElementRef, HostListener } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Header } from './header/header';
import { HomeAtf } from './homepage/home-atf/home-atf';
import { Footer } from './footer/footer';
import { ManifestService } from './gallery/manifest.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [Header, HomeAtf, Footer, RouterOutlet, CommonModule],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('photography_2026');

  constructor(public router: Router, private manifestService: ManifestService) { }

}

