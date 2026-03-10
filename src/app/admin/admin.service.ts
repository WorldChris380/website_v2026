import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
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

@Injectable({
    providedIn: 'root'
})
export class AdminService {
    private readonly API_URL = '/api/admin-login.php';
    private readonly TOKEN_KEY = 'admin_token';

    isTestModeEnabled = signal(false);
    isAdminLoggedIn = signal(this.hasValidToken());

    constructor(private http: HttpClient) {
        // Prüfe Token-Validität beim Service-Start
        if (this.hasValidToken()) {
            this.validateTokenWithBackend().subscribe();
        }
    }

    /**
     * Login mit Passwort (Backend-Validierung)
     */
    login(password: string): Observable<boolean> {
        return this.http.post<LoginResponse>(`${this.API_URL}?action=login`, { password })
            .pipe(
                map(response => {
                    if (response.success && response.data?.token) {
                        localStorage.setItem(this.TOKEN_KEY, response.data.token);
                        this.isAdminLoggedIn.set(true);
                        return true;
                    }
                    return false;
                }),
                catchError(() => of(false))
            );
    }

    /**
     * Logout
     */
    logout(): void {
        localStorage.removeItem(this.TOKEN_KEY);
        this.isAdminLoggedIn.set(false);
        this.isTestModeEnabled.set(false);
    }

    /**
     * Test-Mode aktivieren/deaktivieren
     */
    toggleTestMode(): void {
        const newState = !this.isTestModeEnabled();
        this.isTestModeEnabled.set(newState);

        // clear acknowledgement when enabling test mode again
        if (newState) {
            localStorage.removeItem('test_mode_acknowledged');
        }
    }

    /**
     * Prüft ob gültiger Token vorhanden
     */
    private hasValidToken(): boolean {
        return !!localStorage.getItem(this.TOKEN_KEY);
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
