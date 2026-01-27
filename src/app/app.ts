import { Component, signal, ViewChild, ElementRef, HostListener } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Header } from './header/header';
import { HomeAtf } from './homepage/home-atf/home-atf';
import { Footer } from './footer/footer';
import { ManifestService } from './gallery/manifest.service';
import { LanguageService } from './language.service';
import { ToastContainerComponent } from './shared/toast-container.component';
import { ScrollToTopComponent } from './shared/scroll-to-top.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [Header, HomeAtf, Footer, RouterOutlet, CommonModule, ToastContainerComponent, ScrollToTopComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('photography_2026');
  showRightClickWarning = false;
  rightClickMessage = '';
  private warningTimeout: any;

  constructor(
    public router: Router,
    private manifestService: ManifestService,
    private languageService: LanguageService
  ) { }

  @HostListener('document:contextmenu', ['$event'])
  onRightClick(event: MouseEvent): boolean {
    event.preventDefault();

    const currentLang = this.languageService.getCurrentLanguage();
    this.rightClickMessage = currentLang === 'en'
      ? 'Right-click is not allowed on this website'
      : 'Rechtsklick ist auf dieser Website nicht erlaubt';

    this.showRightClickWarning = true;

    if (this.warningTimeout) {
      clearTimeout(this.warningTimeout);
    }

    this.warningTimeout = setTimeout(() => {
      this.showRightClickWarning = false;
    }, 3000);

    return false;
  }

}

