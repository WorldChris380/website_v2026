import { Injectable, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

interface LoginResponse {
    success: boolean;
    data?: {
        token: string;
        expiresIn: number;
    };
    error?: string;
}

export interface AdminLoginResult {
    success: boolean;
    error?: string;
}

@Injectable({
    providedIn: 'root'
})
export class AdminService {
    private readonly API_URL = '/api/admin-login.php';
    private readonly TOKEN_KEY = 'admin_token';
    private readonly TEST_MODE_KEY = 'test_mode_enabled';
    private readonly GOOGLE_LOGIN_KEY = 'google_login_enabled';

    isTestModeEnabled = signal(this.getPersistedTestMode());
    isGoogleLoginEnabled = signal(this.getPersistedGoogleLogin());
    isAdminLoggedIn = signal(this.hasValidToken());

    constructor(private http: HttpClient) {
        // Prüfe Token-Validität beim Service-Start
        if (this.hasValidToken()) {
            this.validateTokenWithBackend().subscribe();
        }
        // Hole globalen Test-Mode-Status vom Backend
        this.fetchTestModeFromBackend().subscribe(enabled => {
            this.isTestModeEnabled.set(enabled);
            localStorage.setItem(this.TEST_MODE_KEY, String(enabled));
        });

        this.fetchGoogleLoginFromBackend().subscribe(enabled => {
            this.isGoogleLoginEnabled.set(enabled);
            localStorage.setItem(this.GOOGLE_LOGIN_KEY, String(enabled));
        });
    }

    /**
     * Login mit Passwort (Backend-Validierung)
     */
    login(password: string): Observable<AdminLoginResult> {
        return this.http.post<LoginResponse>(`${this.API_URL}?action=login`, { password })
            .pipe(
                map(response => {
                    if (response.success && response.data?.token) {
                        localStorage.setItem(this.TOKEN_KEY, response.data.token);
                        this.isAdminLoggedIn.set(true);
                        return { success: true };
                    }
                    return { success: false, error: response.error || 'Login failed' };
                }),
                catchError((error: HttpErrorResponse) => {
                    const backendError = (error.error?.error || error.error?.details || '').toString().trim();
                    const fallback = error.status ? `HTTP ${error.status}` : 'Network error';
                    return of({ success: false, error: backendError || fallback });
                })
            );
    }

    /**
     * Logout
     */
    logout(): void {
        localStorage.removeItem(this.TOKEN_KEY);
        this.isAdminLoggedIn.set(false);
    }

    /**
     * Test-Mode aktivieren/deaktivieren
     */
    toggleTestMode(): void {
        const newState = !this.isTestModeEnabled();
        this.isTestModeEnabled.set(newState);
        localStorage.setItem(this.TEST_MODE_KEY, String(newState));

        // Synchronisiere mit Backend (für alle Besucher)
        this.syncTestModeToBackend(newState).subscribe();

        // clear acknowledgement when enabling test mode again
        if (newState) {
            localStorage.removeItem('test_mode_acknowledged');
        }
    }

    toggleGoogleLogin(): void {
        const newState = !this.isGoogleLoginEnabled();
        this.isGoogleLoginEnabled.set(newState);
        localStorage.setItem(this.GOOGLE_LOGIN_KEY, String(newState));

        this.syncGoogleLoginToBackend(newState).subscribe((success) => {
            if (!success) {
                const fallbackState = !newState;
                this.isGoogleLoginEnabled.set(fallbackState);
                localStorage.setItem(this.GOOGLE_LOGIN_KEY, String(fallbackState));
            }
        });
    }

    /**
     * Holt den globalen Test-Mode-Status vom Backend
     */
    private fetchTestModeFromBackend(): Observable<boolean> {
        return this.http.get<{ success: boolean; data: { enabled: boolean } }>(`${this.API_URL}?action=get_test_mode`)
            .pipe(
                map(response => response.success ? (response.data?.enabled ?? false) : false),
                catchError(() => of(this.getPersistedTestMode()))
            );
    }

    private fetchGoogleLoginFromBackend(): Observable<boolean> {
        return this.http.get<{ success: boolean; data: { enabled: boolean } }>(`${this.API_URL}?action=get_google_login`)
            .pipe(
                map(response => response.success ? (response.data?.enabled ?? true) : true),
                catchError(() => of(this.getPersistedGoogleLogin()))
            );
    }

    /**
     * Setzt den globalen Test-Mode-Status im Backend
     */
    private syncTestModeToBackend(enabled: boolean): Observable<boolean> {
        const token = localStorage.getItem(this.TOKEN_KEY);
        if (!token) return of(false);
        return this.http.post<{ success: boolean }>(`${this.API_URL}?action=set_test_mode`, { token, enabled })
            .pipe(
                map(r => r.success),
                catchError(() => of(false))
            );
    }

    private syncGoogleLoginToBackend(enabled: boolean): Observable<boolean> {
        const token = localStorage.getItem(this.TOKEN_KEY);
        if (!token) return of(false);
        return this.http.post<{ success: boolean }>(`${this.API_URL}?action=set_google_login`, { token, enabled })
            .pipe(
                map(r => r.success),
                catchError(() => of(false))
            );
    }

    /**
     * Prüft ob gültiger Token vorhanden
     */
    private hasValidToken(): boolean {
        return !!localStorage.getItem(this.TOKEN_KEY);
    }

    private getPersistedTestMode(): boolean {
        return localStorage.getItem(this.TEST_MODE_KEY) === 'true';
    }

    private getPersistedGoogleLogin(): boolean {
        const raw = localStorage.getItem(this.GOOGLE_LOGIN_KEY);
        if (raw === null) return true;
        return raw === 'true';
    }

    /**
     * Validiert Token mit Backend
     */
    private validateTokenWithBackend(): Observable<boolean> {
        const token = localStorage.getItem(this.TOKEN_KEY);
        if (!token) return of(false);

        return this.http.post<LoginResponse>(`${this.API_URL}?action=validate`, { token })
            .pipe(
                map(response => {
                    if (response.success) {
                        return true;
                    }
                    // Token ungültig - löschen
                    this.logout();
                    return false;
                }),
                catchError(() => {
                    this.logout();
                    return of(false);
                })
            );
    }


}
