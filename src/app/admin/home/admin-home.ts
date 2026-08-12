import { Component, signal } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { AdminService } from '../admin.service';
import { ToastService } from '../../shared/toast.service';
import { LanguageService } from '../../language.service';

@Component({
    selector: 'app-admin-home',
    standalone: true,
    imports: [FormsModule],
    templateUrl: './admin-home.html',
    styleUrl: './admin-home.scss'
})
export class AdminHome {
    passwordInput = signal('');
    showPasswordError = signal(false);
    isLoading = signal(false);

    constructor(
        public adminService: AdminService,
        private toastService: ToastService,
        public languageService: LanguageService
    ) { }

    /**
     * Login versuchen
     */
    attemptLogin(): void {
        const password = this.passwordInput().trim();

        if (!password) {
            this.showPasswordError.set(true);
            return;
        }

        this.isLoading.set(true);
        this.showPasswordError.set(false);

        this.adminService.login(password).subscribe(
            result => {
                this.isLoading.set(false);

                if (result.success) {
                    this.passwordInput.set('');
                    this.showPasswordError.set(false);

                    const currentLang = this.languageService.getCurrentLanguage();
                    const message = currentLang === 'en'
                        ? 'Admin login successful'
                        : 'Admin-Login erfolgreich';
                    this.toastService.success(message);
                } else {
                    this.showPasswordError.set(true);

                    const currentLang = this.languageService.getCurrentLanguage();
                    const serverError = (result.error || '').trim();
                    const message = serverError
                        ? serverError
                        : (currentLang === 'en' ? 'Wrong password' : 'Falsches Passwort');
                    this.toastService.error(message);
                }
            }
        );
    }

    /**
     * Test-Mode umschalten
     */
    toggleTestMode(): void {
        this.adminService.toggleTestMode();

        const currentLang = this.languageService.getCurrentLanguage();
        const newState = this.adminService.isTestModeEnabled();
        const message = currentLang === 'en'
            ? `Test mode ${newState ? 'enabled' : 'disabled'}`
            : `Test-Modus ${newState ? 'aktiviert' : 'deaktiviert'}`;

        this.toastService.success(message);
    }

    toggleGoogleLogin(): void {
        this.adminService.toggleGoogleLogin();

        const currentLang = this.languageService.getCurrentLanguage();
        const newState = this.adminService.isGoogleLoginEnabled();
        const message = currentLang === 'en'
            ? `Google login ${newState ? 'enabled' : 'disabled'}`
            : `Google-Login ${newState ? 'aktiviert' : 'deaktiviert'}`;

        this.toastService.success(message);
    }

    /**
     * Logout
     */
    logout(): void {
        this.adminService.logout();

        const currentLang = this.languageService.getCurrentLanguage();
        const message = currentLang === 'en'
            ? 'Logged out'
            : 'Abgemeldet';
        this.toastService.info(message);
    }

}
