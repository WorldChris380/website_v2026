import { Component, OnInit, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { MetaService } from '../services/meta.service';
import { ShopAuthService, ShopOrderHistoryEntry, ShopOrderHistoryItem } from './shop-auth.service';
import { CertificateService } from './certificate.service';
import { LanguageService, Language } from '../language.service';
import { environment } from '../../environments/environment';

declare const google: any;

@Component({
    selector: 'app-account',
    standalone: true,
    imports: [CommonModule, FormsModule, RouterModule],
    templateUrl: './account.html',
    styleUrl: './account.scss'
})
export class Account implements OnInit, AfterViewInit {
    activeTab: 'register' | 'login' = 'register';
    activeAccountTab: 'overview' | 'orders' | 'downloads' | 'billing' = 'overview';
    currentLanguage: Language = 'en';

    form = {
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        confirmPassword: '',
    };

    isSubmitting = false;
    registrationError = '';
    registrationSuccess = '';
    loginForm = {
        email: '',
        password: '',
    };
    isLoginSubmitting = false;
    loginError = '';
    loginSuccess = '';
    forgotPasswordVisible = false;
    forgotPasswordForm = {
        email: '',
        newPassword: '',
        confirmPassword: '',
    };
    private resetTokenFromLink = '';
    isForgotSubmitting = false;
    forgotPasswordError = '';
    forgotPasswordSuccess = '';
    private googleScriptPromise: Promise<void> | null = null;
    private googleInitialized = false;
    readonly googleClientId = environment.googleClientId;
    readonly googleAllowedOrigins = environment.googleAllowedOrigins;
    googleEnabled = environment.googleClientId !== 'GOOGLE_CLIENT_ID_PLACEHOLDER';
    googleOriginAllowed = typeof window === 'undefined'
        ? true
        : this.googleAllowedOrigins.includes(window.location.origin);

    constructor(
        private metaService: MetaService,
        private shopAuthService: ShopAuthService,
        private certificateService: CertificateService,
        private languageService: LanguageService,
        private route: ActivatedRoute
    ) { }

    ngOnInit() {
        this.currentLanguage = this.languageService.getCurrentLanguage();
        this.languageService.language$.subscribe((lang) => {
            this.currentLanguage = lang;
        });

        this.metaService.updateSEO({
            title: 'My Account | Christian Böhme Shop',
            description: 'Manage your photo shop purchases, downloads, and billing information. Access your order history and print-ready files.',
            url: 'https://www.christian-boehme.com/shop/account',
            type: 'website'
        });

        this.route.queryParamMap.subscribe((params) => {
            const resetEmail = (params.get('resetEmail') || '').trim();
            const resetToken = (params.get('resetToken') || '').trim();
            if (resetEmail && resetToken) {
                this.activeTab = 'login';
                this.forgotPasswordVisible = true;
                this.forgotPasswordForm.email = resetEmail;
                this.resetTokenFromLink = resetToken;
                this.forgotPasswordSuccess = this.currentLanguage === 'de'
                    ? 'Reset-Link erkannt. Bitte neues Passwort setzen.'
                    : 'Reset link detected. Please set your new password.';
                return;
            }

            this.shopAuthService.validateSession().subscribe((valid) => {
                if (valid) {
                    this.shopAuthService.fetchOrders().subscribe();
                }
            });
        });

        this.loadGoogleAvailability().then(() => {
            setTimeout(() => this.renderGoogleButtonForActiveTab(), 0);
        });
    }

    ngAfterViewInit(): void {
        this.renderGoogleButtonForActiveTab();
    }

    get currentUser() {
        return this.shopAuthService.currentUser();
    }

    get isAuthenticated() {
        return this.shopAuthService.isAuthenticated();
    }

    get orders() {
        return this.shopAuthService.orderHistory();
    }

    get accountDisplayName(): string {
        const user = this.currentUser;
        if (!user) {
            return this.currentLanguage === 'de' ? 'Kunde' : 'Customer';
        }

        const fullName = `${(user.firstName || '').trim()} ${(user.lastName || '').trim()}`.trim();
        return fullName || (user.displayName || '').trim() || user.email || (this.currentLanguage === 'de' ? 'Kunde' : 'Customer');
    }

    get licensedImageCount(): number {
        return this.orders.reduce((total, order) => total + order.items.reduce((sum, item) => sum + item.quantity, 0), 0);
    }

    get invoiceOrders(): ShopOrderHistoryEntry[] {
        return this.orders.filter((order) => (order.invoicePdfUrl || '').trim().length > 0);
    }

    get downloadableItems(): Array<{ order: ShopOrderHistoryEntry; item: ShopOrderHistoryItem }> {
        return this.orders.flatMap((order) => order.items.map((item) => ({ order, item })));
    }

    get latestOrder(): ShopOrderHistoryEntry | null {
        return this.orders[0] ?? null;
    }

    setActiveTab(tab: 'register' | 'login'): void {
        this.activeTab = tab;
        this.loginError = '';
        this.loginSuccess = '';
        this.registrationError = '';
        this.registrationSuccess = '';
        this.forgotPasswordVisible = false;
        this.forgotPasswordError = '';
        this.forgotPasswordSuccess = '';

        setTimeout(() => {
            this.renderGoogleButtonForActiveTab();
        }, 0);
    }

    setActiveAccountTab(tab: 'overview' | 'orders' | 'downloads' | 'billing'): void {
        this.activeAccountTab = tab;
    }

    register(): void {
        this.registrationError = '';
        this.registrationSuccess = '';

        const email = this.form.email.trim();
        if (!email) {
            this.registrationError = this.currentLanguage === 'de'
                ? 'Bitte gib deine E-Mail-Adresse ein.'
                : 'Please enter your email address.';
            return;
        }

        if (this.form.password.length < 8) {
            this.registrationError = this.currentLanguage === 'de'
                ? 'Dein Passwort muss mindestens 8 Zeichen lang sein.'
                : 'Your password must be at least 8 characters long.';
            return;
        }

        if (this.form.password !== this.form.confirmPassword) {
            this.registrationError = this.currentLanguage === 'de'
                ? 'Passwort und Bestaetigung stimmen nicht ueberein.'
                : 'Password confirmation does not match.';
            return;
        }

        this.isSubmitting = true;

        this.shopAuthService.register({
            firstName: this.form.firstName,
            lastName: this.form.lastName,
            email,
            password: this.form.password,
        }).subscribe({
            next: (result) => {
                this.isSubmitting = false;
                if (!result.success) {
                    this.registrationError = result.error || 'Registration failed.';
                    return;
                }

                this.registrationSuccess = this.currentLanguage === 'de'
                    ? 'Konto erfolgreich erstellt.'
                    : 'Account created successfully.';
                this.form = {
                    firstName: '',
                    lastName: '',
                    email: '',
                    password: '',
                    confirmPassword: '',
                };
                this.loginForm.email = email;
                this.setActiveTab('login');
                this.loginSuccess = this.currentLanguage === 'de'
                    ? 'Konto erfolgreich erstellt. Du kannst dich jetzt anmelden.'
                    : 'Account created successfully. You can log in immediately.';
            },
            error: () => {
                this.isSubmitting = false;
                this.registrationError = this.currentLanguage === 'de'
                    ? 'Registrierung fehlgeschlagen. Bitte versuche es erneut.'
                    : 'Registration failed. Please try again.';
            }
        });
    }

    login(): void {
        this.loginError = '';
        this.loginSuccess = '';

        const email = this.loginForm.email.trim();
        if (!email) {
            this.loginError = this.currentLanguage === 'de'
                ? 'Bitte gib deine E-Mail-Adresse ein.'
                : 'Please enter your email address.';
            return;
        }

        if (!this.loginForm.password) {
            this.loginError = this.currentLanguage === 'de'
                ? 'Bitte gib dein Passwort ein.'
                : 'Please enter your password.';
            return;
        }

        this.isLoginSubmitting = true;

        this.shopAuthService.login({
            email,
            password: this.loginForm.password,
        }).subscribe({
            next: (result) => {
                this.isLoginSubmitting = false;
                if (!result.success) {
                    this.loginError = result.error || 'Login failed.';
                    return;
                }

                this.loginSuccess = this.currentLanguage === 'de' ? 'Login erfolgreich.' : 'Login successful.';
                this.loginForm.password = '';
                this.activeAccountTab = 'overview';
                this.shopAuthService.fetchOrders().subscribe();
            },
            error: () => {
                this.isLoginSubmitting = false;
                this.loginError = this.currentLanguage === 'de'
                    ? 'Login fehlgeschlagen. Bitte versuche es erneut.'
                    : 'Login failed. Please try again.';
            }
        });
    }

    toggleForgotPassword(): void {
        this.forgotPasswordVisible = !this.forgotPasswordVisible;
        this.forgotPasswordError = '';
        this.forgotPasswordSuccess = '';
        if (!this.forgotPasswordForm.email && this.loginForm.email.trim()) {
            this.forgotPasswordForm.email = this.loginForm.email.trim();
        }
    }

    requestPasswordReset(): void {
        this.forgotPasswordError = '';
        this.forgotPasswordSuccess = '';

        const email = this.forgotPasswordForm.email.trim();
        if (!email) {
            this.forgotPasswordError = this.currentLanguage === 'de'
                ? 'Bitte eine E-Mail-Adresse eingeben.'
                : 'Please enter an email address.';
            return;
        }

        this.isForgotSubmitting = true;
        this.shopAuthService.requestPasswordReset(email).subscribe((result) => {
            this.isForgotSubmitting = false;
            if (!result.success) {
                this.forgotPasswordError = result.error || (this.currentLanguage === 'de'
                    ? 'Zuruecksetzen konnte nicht angefordert werden.'
                    : 'Could not request password reset.');
                return;
            }

            this.forgotPasswordSuccess = this.currentLanguage === 'de'
                ? 'Wir haben dir einen Reset-Link per E-Mail gesendet.'
                : 'We sent you a reset link by email.';
        });
    }

    submitPasswordReset(): void {
        this.forgotPasswordError = '';
        this.forgotPasswordSuccess = '';

        const email = this.forgotPasswordForm.email.trim();
        const resetToken = this.resetTokenFromLink.trim();
        const newPassword = this.forgotPasswordForm.newPassword;
        const confirmPassword = this.forgotPasswordForm.confirmPassword;

        if (!email || !newPassword || !confirmPassword) {
            this.forgotPasswordError = this.currentLanguage === 'de'
                ? 'Bitte alle Felder ausfuellen.'
                : 'Please fill in all fields.';
            return;
        }

        if (!resetToken) {
            this.forgotPasswordError = this.currentLanguage === 'de'
                ? 'Bitte den Reset-Link aus der E-Mail oeffnen.'
                : 'Please open the reset link from your email.';
            return;
        }

        if (newPassword.length < 8) {
            this.forgotPasswordError = this.currentLanguage === 'de'
                ? 'Das neue Passwort muss mindestens 8 Zeichen haben.'
                : 'The new password must have at least 8 characters.';
            return;
        }

        if (newPassword !== confirmPassword) {
            this.forgotPasswordError = this.currentLanguage === 'de'
                ? 'Passwort und Bestaetigung stimmen nicht ueberein.'
                : 'Password and confirmation do not match.';
            return;
        }

        this.isForgotSubmitting = true;
        this.shopAuthService.resetPassword({ email, resetToken, newPassword }).subscribe((result) => {
            this.isForgotSubmitting = false;
            if (!result.success) {
                this.forgotPasswordError = result.error || (this.currentLanguage === 'de'
                    ? 'Passwort konnte nicht zurueckgesetzt werden.'
                    : 'Password could not be reset.');
                return;
            }

            this.forgotPasswordSuccess = this.currentLanguage === 'de'
                ? 'Passwort erfolgreich geaendert. Du kannst dich jetzt anmelden.'
                : 'Password updated successfully. You can sign in now.';
            this.loginForm.email = email;
            this.loginForm.password = '';
            this.resetTokenFromLink = '';
            this.forgotPasswordForm.newPassword = '';
            this.forgotPasswordForm.confirmPassword = '';
        });
    }

    get hasResetLinkToken(): boolean {
        return this.resetTokenFromLink.trim().length > 0;
    }

    get canRenderGoogleAuth(): boolean {
        return this.googleEnabled && this.googleOriginAllowed;
    }

    private async renderGoogleButtonForActiveTab(): Promise<void> {
        if (!this.canRenderGoogleAuth || this.isAuthenticated) {
            this.clearGoogleContainers();
            return;
        }

        const containerId = this.activeTab === 'register' ? 'google-register-btn' : 'google-login-btn';
        const container = document.getElementById(containerId);
        if (!container) {
            return;
        }

        try {
            await this.ensureGoogleInitialized();

            container.innerHTML = '';
            google.accounts.id.renderButton(container, {
                type: 'standard',
                theme: 'outline',
                size: 'large',
                shape: 'pill',
                text: 'continue_with',
                width: 320,
                logo_alignment: 'left'
            });
        } catch {
            this.loginError = this.currentLanguage === 'de'
                ? 'Google Sign-In ist derzeit nicht verfuegbar.'
                : 'Google Sign-In is currently unavailable.';
        }
    }

    private clearGoogleContainers(): void {
        const registerContainer = document.getElementById('google-register-btn');
        const loginContainer = document.getElementById('google-login-btn');
        if (registerContainer) {
            registerContainer.innerHTML = '';
        }
        if (loginContainer) {
            loginContainer.innerHTML = '';
        }
    }

    private async ensureGoogleInitialized(): Promise<void> {
        await this.loadGoogleScript();
        if (typeof google === 'undefined' || !google?.accounts?.id) {
            throw new Error('Google Identity Services not available.');
        }

        if (this.googleInitialized) {
            return;
        }

        google.accounts.id.initialize({
            client_id: this.googleClientId,
            callback: (response: { credential?: string }) => {
                const credential = response?.credential || '';
                if (!credential) {
                    this.loginError = this.currentLanguage === 'de'
                        ? 'Google Sign-In konnte nicht gestartet werden.'
                        : 'Google Sign-In failed. Please try again.';
                    return;
                }

                this.shopAuthService.loginWithGoogle(credential).subscribe((result) => {
                    if (!result.success) {
                        this.loginError = result.error || (this.currentLanguage === 'de'
                            ? 'Google-Login fehlgeschlagen.'
                            : 'Google login failed.');
                        return;
                    }

                    this.loginError = '';
                    this.loginSuccess = this.currentLanguage === 'de'
                        ? 'Login erfolgreich.'
                        : 'Login successful.';
                    this.shopAuthService.fetchOrders().subscribe();
                });
            }
        });

        this.googleInitialized = true;
    }

    private async loadGoogleAvailability(): Promise<void> {
        if (this.googleClientId === 'GOOGLE_CLIENT_ID_PLACEHOLDER') {
            this.googleEnabled = false;
            return;
        }

        try {
            const response = await fetch('/api/admin-login.php?action=get_google_login', {
                method: 'GET',
                credentials: 'same-origin',
            });

            if (!response.ok) {
                return;
            }

            const payload = await response.json() as { success?: boolean; data?: { enabled?: boolean } };
            if (payload?.success) {
                this.googleEnabled = payload.data?.enabled !== false;
            }
        } catch {
            // Keep default availability if endpoint is unreachable.
        }
    }

    private loadGoogleScript(): Promise<void> {
        if (this.googleScriptPromise) {
            return this.googleScriptPromise;
        }

        this.googleScriptPromise = new Promise<void>((resolve, reject) => {
            const existing = document.querySelector('script[data-google-identity="1"]') as HTMLScriptElement | null;
            if (existing) {
                if (typeof google !== 'undefined' && google?.accounts?.id) {
                    resolve();
                    return;
                }

                existing.addEventListener('load', () => resolve(), { once: true });
                existing.addEventListener('error', () => reject(new Error('Failed to load Google script.')), { once: true });
                return;
            }

            const script = document.createElement('script');
            script.src = 'https://accounts.google.com/gsi/client';
            script.async = true;
            script.defer = true;
            script.setAttribute('data-google-identity', '1');
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('Failed to load Google script.'));
            document.head.appendChild(script);
        });

        return this.googleScriptPromise;
    }

    logout(): void {
        this.shopAuthService.logout();
        this.loginSuccess = '';
        this.activeTab = 'login';
        this.activeAccountTab = 'overview';
    }

    async downloadOrderCertificate(order: ShopOrderHistoryEntry, item: ShopOrderHistoryItem): Promise<void> {
        await this.certificateService.downloadCertificate(
            {
                ownerName: order.ownerName || this.currentUser?.displayName || this.currentUser?.email || 'Certificate Holder',
                orderId: order.paypalOrderId,
                captureId: order.paypalCaptureId,
                purchasedAt: order.purchasedAt,
            },
            {
                id: item.productId,
                title: item.title,
                imageUrl: item.imageUrl,
                originalImageUrl: item.originalImageUrl,
                unitPrice: item.unitPrice,
                quantity: item.quantity,
                currency: item.currency,
            },
            this.currentLanguage === 'de' ? 'de' : 'en'
        );
    }

    downloadOrderedOriginal(item: ShopOrderHistoryItem): void {
        this.certificateService.downloadOriginalPhoto({
            id: item.productId,
            title: item.title,
            originalImageUrl: item.originalImageUrl,
            imageUrl: item.imageUrl,
        });
    }

    openOrderInvoice(order: ShopOrderHistoryEntry): void {
        const invoiceUrl = this.normalizeInvoiceUrl(order.invoicePdfUrl || '');
        if (!invoiceUrl) {
            return;
        }

        window.open(invoiceUrl, '_blank', 'noopener,noreferrer');
    }

    private normalizeInvoiceUrl(rawUrl: string): string {
        const trimmed = rawUrl.trim();
        if (!trimmed) {
            return '';
        }

        const lang = this.currentLanguage === 'de' ? 'de' : 'en';

        const withLanguage = (url: string): string => {
            const separator = url.includes('?') ? '&' : '?';
            if (/([?&])lang=(de|en)(?:&|$)/i.test(url)) {
                return url.replace(/([?&])lang=(de|en)(?=&|$)/i, `$1lang=${lang}`);
            }
            return `${url}${separator}lang=${lang}`;
        };

        if (trimmed.startsWith('/')) {
            return withLanguage(`${window.location.origin}${trimmed}`);
        }

        if (window.location.protocol === 'https:' && trimmed.startsWith('http://')) {
            return withLanguage(trimmed.replace(/^http:\/\//i, 'https://'));
        }

        return withLanguage(trimmed);
    }
}
