import { Component, signal, ViewChild, ElementRef, HostListener, effect } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
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
  imports: [Header, Footer, RouterOutlet, CommonModule, HttpClientModule, ToastContainerComponent, ScrollToTopComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('photography_2026');
  showRightClickWarning = false;
  rightClickMessage = '';
  private warningTimeout: any;
  private isShowingTestModeToast = false;

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
      const isLoggedIn = this.adminService.isAdminLoggedIn();
      if (isTestModeEnabled && isLoggedIn && !this.hasUserAcknowledgedTestMode()) {
        // Use setTimeout to avoid effect loop issues
        setTimeout(() => this.showTestModeToast(), 0);
      }
    });

    // Watch for language changes and update toast if test mode is active
    this.languageService.language$.subscribe(() => {
      if (this.adminService.isTestModeEnabled() && this.adminService.isAdminLoggedIn() && !this.hasUserAcknowledgedTestMode() && this.isShowingTestModeToast) {
        this.updateTestModeToastLanguage();
      }
    });
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
    this.isShowingTestModeToast = false;
  }

  /**
   * Show the test mode toast with current language
   */
  private showTestModeToast(): void {
    if (this.isShowingTestModeToast) {
      return; // Already showing, don't create duplicate
    }

    const currentLang = this.languageService.getCurrentLanguage();
    const message = currentLang === 'en'
      ? '⚠️ This is a TEST page'
      : '⚠️ Dies ist eine TESTSEITE';
    const buttonText = currentLang === 'en' ? 'Understood' : 'Verstanden';

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

    this.isShowingTestModeToast = true;
  }

  /**
   * Update only the language of existing test mode toast
   */
  private updateTestModeToastLanguage(): void {
    const currentLang = this.languageService.getCurrentLanguage();
    const message = currentLang === 'en'
      ? '⚠️ This is a TEST page'
      : '⚠️ Dies ist eine TESTSEITE';
    const buttonText = currentLang === 'en' ? 'Understood' : 'Verstanden';

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

