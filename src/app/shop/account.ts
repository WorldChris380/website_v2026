import { Component, OnInit, AfterViewInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { MetaService } from '../services/meta.service';
import { ShopAuthService, ShopOrderHistoryEntry, ShopOrderHistoryItem } from './shop-auth.service';
import { CertificateService } from './certificate.service';
import { ShopReviewsService } from './shop-reviews.service';
import { PayPalButton } from './paypal-button';
import { CartItem } from './shop.service';
import { ShopSubscriptionHistoryEntry, ShopSubscriptionService, ShopSubscriptionStatus } from './shop-subscription.service';
import { LanguageService, Language } from '../language.service';
import { environment } from '../../environments/environment';

declare const google: any;

type SubscriptionPlanId =
    | 'subscription-monthly'
    | 'subscription-yearly'
    | 'subscription-commercial-monthly'
    | 'subscription-commercial-yearly';

@Component({
    selector: 'app-account',
    standalone: true,
    imports: [CommonModule, FormsModule, RouterModule, PayPalButton],
    templateUrl: './account.html',
    changeDetection: ChangeDetectionStrategy.Eager,
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
    reviewEditorOpen: Record<string, boolean> = {};
    reviewDrafts: Record<string, { rating: number; reviewText: string }> = {};
    reviewSubmitting: Record<string, boolean> = {};
    reviewError: Record<string, string> = {};
    reviewSuccess: Record<string, string> = {};
    selectedSubscriptionPlan: SubscriptionPlanId = 'subscription-monthly';
    subscriptionStatus: ShopSubscriptionStatus | null = null;
    subscriptionHistory: ShopSubscriptionHistoryEntry[] = [];
    isSubscriptionLoading = false;
    isSubscriptionMutating = false;
    subscriptionError = '';
    subscriptionSuccess = '';
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
        private shopReviewsService: ShopReviewsService,
        private shopSubscriptionService: ShopSubscriptionService,
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
                    this.loadSubscriptionStatus();
                    this.scrollToFragmentIfPresent();
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

    // Scrolls to a route fragment (e.g. #subscription from the header's
    // "Manage Subscription" link) once the overview tab's content — gated
    // behind auth/session validation — has actually rendered.
    private scrollToFragmentIfPresent(): void {
        this.route.fragment.subscribe((fragment) => {
            if (!fragment) return;
            setTimeout(() => {
                document.getElementById(fragment)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 150);
        });
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
        return this.orders.reduce((total, order) => total + order.items.reduce((sum, item) => sum + (this.isPhotoOrderItem(item) ? item.quantity : 0), 0), 0);
    }

    get invoiceOrders(): ShopOrderHistoryEntry[] {
        return this.orders.filter((order) => (order.invoicePdfUrl || '').trim().length > 0);
    }

    get downloadableItems(): Array<{ order: ShopOrderHistoryEntry; item: ShopOrderHistoryItem }> {
        return this.orders.flatMap((order) => order.items
            .filter((item) => this.isPhotoOrderItem(item))
            .map((item) => ({ order, item })));
    }

    get latestOrder(): ShopOrderHistoryEntry | null {
        return this.orders[0] ?? null;
    }

    get activeSubscriptionLabel(): string {
        if (!this.subscriptionStatus?.active) {
            return this.currentLanguage === 'de' ? 'Kein aktives Abo' : 'No active subscription';
        }

        const de = this.currentLanguage === 'de';
        switch (this.subscriptionStatus.planCode as SubscriptionPlanId) {
            case 'subscription-yearly':
                return de ? 'Jahresabo' : 'Annual subscription';
            case 'subscription-commercial-monthly':
                return de ? 'Kommerzielles Monatsabo' : 'Commercial monthly subscription';
            case 'subscription-commercial-yearly':
                return de ? 'Kommerzielles Jahresabo' : 'Commercial annual subscription';
            default:
                return de ? 'Monatsabo' : 'Monthly subscription';
        }
    }

    get isCommercialSubscription(): boolean {
        return this.subscriptionStatus?.planCode === 'subscription-commercial-monthly'
            || this.subscriptionStatus?.planCode === 'subscription-commercial-yearly';
    }

    get subscriptionStatusNote(): string {
        if (!this.subscriptionStatus?.active) {
            return this.currentLanguage === 'de'
                ? 'Kein laufendes Abo hinterlegt.'
                : 'No active subscription stored.';
        }

        if (this.subscriptionStatus.cancelAtPeriodEnd) {
            return this.currentLanguage === 'de'
                ? 'Gekündigt — Downloads bleiben bis zum Laufzeitende nutzbar, danach keine Verlängerung.'
                : 'Cancelled — downloads stay available until the term ends, then it will not renew.';
        }

        return this.currentLanguage === 'de'
            ? 'Aktiv und für direkte Abo-Downloads freigeschaltet.'
            : 'Active and enabled for direct subscription downloads.';
    }

    get subscriptionRemainingLabel(): string {
        if (!this.subscriptionStatus?.active) {
            return this.currentLanguage === 'de'
                ? 'Mit Abo bis zu 2 Bilder pro Monat herunterladen.'
                : 'Download up to 2 images per month with a subscription.';
        }

        return (this.currentLanguage === 'de' ? 'Verbleibend in diesem Monat: ' : 'Remaining this month: ')
            + this.subscriptionStatus.monthlyDownloadsRemaining
            + ' / '
            + this.subscriptionStatus.monthlyDownloadLimit;
    }

    get subscriptionRemainingCount(): number {
        return this.subscriptionStatus?.active ? this.subscriptionStatus.monthlyDownloadsRemaining : 0;
    }

    get hasActiveSubscription(): boolean {
        return !!this.subscriptionStatus?.active;
    }

    get hasSubscriptionHistory(): boolean {
        return this.subscriptionHistory.length > 0;
    }

    get canCancelSubscription(): boolean {
        return !!this.subscriptionStatus?.active && !this.subscriptionStatus?.cancelAtPeriodEnd;
    }

    get subscriptionExpiresAt(): string {
        return this.subscriptionStatus?.active ? this.subscriptionStatus.expiresAt : '';
    }

    get subscriptionPlanHeading(): string {
        return this.hasActiveSubscription
            ? (this.currentLanguage === 'de' ? 'Zahlungsmodell ändern' : 'Change billing plan')
            : (this.currentLanguage === 'de' ? 'Abo auswählen' : 'Choose a subscription');
    }

    get subscriptionPlanHint(): string {
        return this.hasActiveSubscription
            ? (this.currentLanguage === 'de'
                ? 'Ein neuer Kauf ersetzt das laufende Abo sofort durch den gewählten Tarif. Jederzeit kündbar — die bereits bezahlte Laufzeit wird dabei beachtet.'
                : 'A new purchase replaces the current subscription immediately with the selected plan. Cancel anytime — the already-paid term is still honored.')
            : (this.currentLanguage === 'de'
                ? 'Wähle zwischen persönlicher und kommerzieller Nutzung sowie monatlicher oder jährlicher Abrechnung. Jederzeit kündbar, die Laufzeit wird beachtet.'
                : 'Choose between personal and commercial use, billed monthly or annually. Cancel anytime — the term is still honored.');
    }

    getSubscriptionHistoryStatusLabel(entry: ShopSubscriptionHistoryEntry): string {
        const status = entry.status.toLowerCase();
        if (status === 'active') {
            return this.currentLanguage === 'de' ? 'Aktiv' : 'Active';
        }

        if (status === 'cancelling') {
            return this.currentLanguage === 'de' ? 'Endet zum Laufzeitende' : 'Ending at term end';
        }

        if (status === 'cancelled') {
            return this.currentLanguage === 'de' ? 'Gekündigt' : 'Cancelled';
        }

        if (status === 'replaced') {
            return this.currentLanguage === 'de' ? 'Ersetzt' : 'Replaced';
        }

        if (status === 'expired') {
            return this.currentLanguage === 'de' ? 'Abgelaufen' : 'Expired';
        }

        return entry.status || (this.currentLanguage === 'de' ? 'Unbekannt' : 'Unknown');
    }

    getSubscriptionHistoryStatusClass(entry: ShopSubscriptionHistoryEntry): string {
        const status = entry.status.toLowerCase();
        if (status === 'active') {
            return 'is-active';
        }
        if (status === 'cancelling') {
            return 'is-cancelling';
        }
        if (status === 'cancelled') {
            return 'is-expired';
        }
        if (status === 'replaced') {
            return 'is-replaced';
        }
        if (status === 'expired') {
            return 'is-expired';
        }
        return 'is-unknown';
    }

    private static readonly SUBSCRIPTION_PLANS: Record<SubscriptionPlanId, { title: string; price: number }> = {
        'subscription-monthly': { title: 'Photo Subscription Monthly', price: 9.99 },
        'subscription-yearly': { title: 'Photo Subscription Annual', price: 99.99 },
        'subscription-commercial-monthly': { title: 'Commercial Photo Subscription Monthly', price: 19.99 },
        'subscription-commercial-yearly': { title: 'Commercial Photo Subscription Annual', price: 199.99 },
    };

    get subscriptionCheckoutItems(): CartItem[] {
        const plan = Account.SUBSCRIPTION_PLANS[this.selectedSubscriptionPlan];
        return [{
            id: this.selectedSubscriptionPlan,
            title: plan.title,
            imageUrl: '',
            originalImageUrl: '',
            price: plan.price,
            quantity: 1,
            currency: 'EUR',
        }];
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

    selectSubscriptionPlan(plan: SubscriptionPlanId): void {
        this.selectedSubscriptionPlan = plan;
        this.subscriptionError = '';
        this.subscriptionSuccess = '';
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
                ? 'Passwort und Bestätigung stimmen nicht überein.'
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
                this.loadSubscriptionStatus();
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
                    ? 'Zurücksetzen konnte nicht angefordert werden.'
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
                ? 'Passwort und Bestätigung stimmen nicht überein.'
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
                ? 'Google Sign-In ist derzeit nicht verfügbar.'
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
                    this.loadSubscriptionStatus();
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
        this.reviewEditorOpen = {};
        this.reviewDrafts = {};
        this.reviewSubmitting = {};
        this.reviewError = {};
        this.reviewSuccess = {};
        this.subscriptionStatus = null;
        this.subscriptionHistory = [];
        this.subscriptionError = '';
        this.subscriptionSuccess = '';
    }

    isPhotoOrderItem(item: ShopOrderHistoryItem): boolean {
        return item.productType === 'photo' && /^\d+$/.test(item.productId);
    }

    onSubscriptionPaymentSuccess(): void {
        this.subscriptionError = '';
        this.subscriptionSuccess = this.currentLanguage === 'de'
            ? 'Abo erfolgreich aktiviert. Dein Kontingent wurde aktualisiert.'
            : 'Subscription activated successfully. Your allowance has been updated.';
        this.shopAuthService.fetchOrders().subscribe();
        this.loadSubscriptionStatus();
    }

    onSubscriptionPaymentError(message: string): void {
        this.subscriptionSuccess = '';
        this.subscriptionError = message;
    }

    cancelSubscription(): void {
        const token = this.shopAuthService.getToken();
        if (!token || !this.canCancelSubscription) {
            return;
        }

        this.isSubscriptionMutating = true;
        this.subscriptionError = '';
        this.subscriptionSuccess = '';
        this.shopSubscriptionService.cancel(token).subscribe((result) => {
            this.isSubscriptionMutating = false;
            if (!result.success) {
                this.subscriptionError = result.error || (this.currentLanguage === 'de'
                    ? 'Abo konnte nicht beendet werden.'
                    : 'Could not end subscription.');
                return;
            }

            this.subscriptionStatus = null;
            this.loadSubscriptionHistory(token);
            this.subscriptionSuccess = this.currentLanguage === 'de'
                ? 'Abo wurde sofort beendet.'
                : 'Subscription was ended immediately.';
        });
    }

    private loadSubscriptionStatus(): void {
        const token = this.shopAuthService.getToken();
        if (!token || !this.isAuthenticated) {
            this.subscriptionStatus = null;
            this.subscriptionHistory = [];
            this.isSubscriptionLoading = false;
            this.isSubscriptionMutating = false;
            return;
        }

        this.isSubscriptionLoading = true;
        this.shopSubscriptionService.getStatus(token).subscribe((result) => {
            this.isSubscriptionLoading = false;
            if (!result.success) {
                this.subscriptionStatus = null;
                this.subscriptionHistory = [];
                return;
            }

            this.subscriptionStatus = result.status;
            this.loadSubscriptionHistory(token);
        });
    }

    private loadSubscriptionHistory(token: string): void {
        this.shopSubscriptionService.getHistory(token).subscribe((result) => {
            if (!result.success) {
                this.subscriptionHistory = [];
                return;
            }

            this.subscriptionHistory = result.history;
        });
    }

    getReviewKey(item: ShopOrderHistoryItem): string {
        return item.productId;
    }

    isReviewEditorOpen(item: ShopOrderHistoryItem): boolean {
        return !!this.reviewEditorOpen[this.getReviewKey(item)];
    }

    toggleReviewEditor(item: ShopOrderHistoryItem): void {
        const key = this.getReviewKey(item);
        const next = !this.reviewEditorOpen[key];
        this.reviewEditorOpen[key] = next;

        if (next && !this.reviewDrafts[key]) {
            this.reviewDrafts[key] = {
                rating: 5,
                reviewText: '',
            };
        }

        if (next) {
            this.reviewError[key] = '';
            this.reviewSuccess[key] = '';
        }
    }

    getReviewDraft(item: ShopOrderHistoryItem): { rating: number; reviewText: string } {
        const key = this.getReviewKey(item);
        if (!this.reviewDrafts[key]) {
            this.reviewDrafts[key] = {
                rating: 5,
                reviewText: '',
            };
        }
        return this.reviewDrafts[key];
    }

    submitVerifiedReview(item: ShopOrderHistoryItem): void {
        const key = this.getReviewKey(item);
        const draft = this.getReviewDraft(item);
        const token = this.shopAuthService.getToken();

        this.reviewError[key] = '';
        this.reviewSuccess[key] = '';

        if (!token) {
            this.reviewError[key] = this.currentLanguage === 'de'
                ? 'Bitte erneut anmelden.'
                : 'Please sign in again.';
            return;
        }

        const text = (draft.reviewText || '').trim();
        if (text.length < 10) {
            this.reviewError[key] = this.currentLanguage === 'de'
                ? 'Bitte mindestens 10 Zeichen schreiben.'
                : 'Please write at least 10 characters.';
            return;
        }

        this.reviewSubmitting[key] = true;
        this.shopReviewsService.saveReview({
            token,
            productId: item.productId,
            rating: draft.rating,
            reviewText: text,
        }).subscribe((result) => {
            this.reviewSubmitting[key] = false;
            if (!result.success) {
                this.reviewError[key] = result.error || (this.currentLanguage === 'de'
                    ? 'Bewertung konnte nicht gespeichert werden.'
                    : 'Could not save review.');
                return;
            }

            this.reviewSuccess[key] = this.currentLanguage === 'de'
                ? 'Verifizierte Bewertung gespeichert.'
                : 'Verified review saved.';
            this.reviewDrafts[key] = { rating: 5, reviewText: '' };
        });
    }

    async downloadOrderCertificate(order: ShopOrderHistoryEntry, item: ShopOrderHistoryItem): Promise<void> {
        await this.certificateService.downloadCertificate(
            {
                ownerName: order.ownerName || this.currentUser?.displayName || this.currentUser?.email || 'Certificate Holder',
                companyName: (order.companyName || '').trim(),
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
