import { Component, signal, ViewChild, ElementRef, HostListener, effect, ChangeDetectionStrategy } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';

import { HttpClientModule } from '@angular/common/http';
import { Header } from './header/header';
import { HomeAtf } from './homepage/home-atf/home-atf';
import { Footer } from './footer/footer';
import { ManifestService } from './gallery/manifest.service';
import { LanguageService } from './language.service';
import { ToastContainerComponent } from './shared/toast-container.component';
import { ScrollToTopComponent } from './shared/scroll-to-top.component';
import { AdminService } from './admin/admin.service';
import { ToastService } from './shared/toast.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [Header, Footer, RouterOutlet, HttpClientModule, ToastContainerComponent, ScrollToTopComponent],
  templateUrl: './app.html',
  changeDetection: ChangeDetectionStrategy.Eager,
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
    private languageService: LanguageService,
    private adminService: AdminService,
    private toastService: ToastService
  ) {
    // Watch for test mode changes and show toast
    effect(() => {
      const isTestModeEnabled = this.adminService.isTestModeEnabled();
      const hasVisibleToast = this.hasVisibleTestModeToast();

      if (isTestModeEnabled && !this.hasUserAcknowledgedTestMode() && !hasVisibleToast) {
        // Use setTimeout to avoid effect loop issues
        setTimeout(() => this.showTestModeToast(), 0);
      }
    });

    // Watch for language changes and update toast if test mode is active
    this.languageService.language$.subscribe(() => {
      if (this.adminService.isTestModeEnabled() && !this.hasUserAcknowledgedTestMode() && this.hasVisibleTestModeToast()) {
        this.updateTestModeToastLanguage();
      }
    });
  }

  private hasVisibleTestModeToast(): boolean {
    return this.toastService.toasts().some(t => t.persistent && t.type === 'warning');
  }

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

  /**
   * Check if user has already acknowledged the test mode
   */
  private hasUserAcknowledgedTestMode(): boolean {
    return localStorage.getItem('test_mode_acknowledged') === 'true';
  }

  /**
   * Mark test mode as acknowledged by user
   */
  private acknowledgeTestMode(): void {
    localStorage.setItem('test_mode_acknowledged', 'true');
  }

  private getTestModeToastContent(): { message: string; buttonText: string } {
    const currentLang = this.languageService.getCurrentLanguage();

    return {
      message: currentLang === 'en'
        ? 'This website ist currently still under construction.'
        : '⚠️ Dies ist eine TESTSEITE',
      buttonText: currentLang === 'en' ? 'Understood' : 'Verstanden'
    };
  }

  /**
   * Show the test mode toast with current language
   */
  private showTestModeToast(): void {
    const { message, buttonText } = this.getTestModeToastContent();

    // if existing persistent warning toast, update via signal to trigger change detection
    const existing = this.toastService.toasts().find(t => t.persistent && t.type === 'warning');
    if (existing) {
      this.toastService.toasts.update(toasts =>
        toasts.map(t =>
          t.persistent && t.type === 'warning'
            ? { ...t, message, buttonText }
            : t
        )
      );
    } else {
      // create new toast
      this.toastService.warningWithButton(message, buttonText, () => {
        this.acknowledgeTestMode();
      });
    }
  }

  /**
   * Update only the language of existing test mode toast
   */
  private updateTestModeToastLanguage(): void {
    const { message, buttonText } = this.getTestModeToastContent();

    // Update signal to trigger change detection
    this.toastService.toasts.update(toasts =>
      toasts.map(t =>
        t.persistent && t.type === 'warning'
          ? { ...t, message, buttonText }
          : t
      )
    );
  }
}

