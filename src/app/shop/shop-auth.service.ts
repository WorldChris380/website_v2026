import { Injectable, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

interface AuthUser {
    id: number;
    email: string;
    displayName?: string | null;
    firstName?: string;
    lastName?: string;
    role: string;
    status: string;
}

interface RegisterResponse {
    success: boolean;
    data?: {
        userId: number;
        email: string;
        displayName?: string | null;
        status: string;
    };
    error?: string;
    details?: string;
}

interface ForgotPasswordResponse {
    success: boolean;
    data?: {
        message?: string;
        resetToken?: string;
    };
    error?: string;
    details?: string;
}

interface LoginResponse {
    success: boolean;
    data?: {
        token: string;
        expiresIn: number;
        user: AuthUser;
    };
    error?: string;
    details?: string;
}

interface ValidateResponse {
    success: boolean;
    data?: {
        valid: boolean;
        user: AuthUser;
    };
    error?: string;
    details?: string;
}

export interface ShopOrderHistoryItem {
    productId: string;
    productType: string;
    title: string;
    imageUrl: string;
    originalImageUrl: string;
    unitPrice: number;
    quantity: number;
    currency: string;
}

export interface ShopOrderHistoryEntry {
    id: number;
    ownerName: string;
    companyName?: string;
    paypalOrderId: string;
    paypalCaptureId: string;
    status: string;
    totalAmount: number;
    currency: string;
    purchasedAt: string;
    invoiceNumber: string;
    invoicePdfUrl: string;
    items: ShopOrderHistoryItem[];
}

interface OrdersResponse {
    success: boolean;
    data?: {
        orders: ShopOrderHistoryEntry[];
    };
    error?: string;
    details?: string;
}

@Injectable({ providedIn: 'root' })
export class ShopAuthService {
    private readonly apiUrl = `${environment.apiBaseUrl}/api/shop-auth.php`;
    private readonly ordersApiUrl = `${environment.apiBaseUrl}/api/shop-orders.php`;
    private readonly tokenKey = 'shop_user_token';
    readonly currentUser = signal<AuthUser | null>(null);
    readonly isAuthenticated = signal(false);
    readonly orderHistory = signal<ShopOrderHistoryEntry[]>([]);

    constructor(private http: HttpClient) {
        this.restoreSession();
    }

    register(payload: { firstName?: string; lastName?: string; email: string; password: string }): Observable<{ success: boolean; error?: string }> {
        return this.http.post<RegisterResponse>(this.apiUrl, {
            action: 'register',
            firstName: payload.firstName ?? '',
            lastName: payload.lastName ?? '',
            email: payload.email,
            password: payload.password,
        }).pipe(
            map((response) => ({
                success: !!response.success,
                error: response.error,
            })),
            catchError((error: HttpErrorResponse) => {
                const message = (error.error?.details || error.error?.error || error.message || 'Registration failed.').toString();
                return of({ success: false, error: message });
            })
        );
    }

    login(payload: { email: string; password: string }): Observable<{ success: boolean; error?: string }> {
        return this.http.post<LoginResponse>(this.apiUrl, {
            action: 'login',
            email: payload.email,
            password: payload.password,
        }).pipe(
            map((response) => {
                if (response.success && response.data?.token && response.data.user) {
                    localStorage.setItem(this.tokenKey, response.data.token);
                    this.currentUser.set(response.data.user);
                    this.isAuthenticated.set(true);
                    return { success: true };
                }

                return { success: false, error: response.error || 'Login failed.' };
            }),
            catchError((error: HttpErrorResponse) => {
                const message = (error.error?.details || error.error?.error || error.message || 'Login failed.').toString();
                return of({ success: false, error: message });
            })
        );
    }

    loginWithGoogle(idToken: string): Observable<{ success: boolean; error?: string }> {
        return this.http.post<LoginResponse>(this.apiUrl, {
            action: 'google-login',
            idToken,
        }).pipe(
            map((response) => {
                if (response.success && response.data?.token && response.data.user) {
                    localStorage.setItem(this.tokenKey, response.data.token);
                    this.currentUser.set(response.data.user);
                    this.isAuthenticated.set(true);
                    return { success: true };
                }

                return { success: false, error: response.error || 'Google login failed.' };
            }),
            catchError((error: HttpErrorResponse) => {
                const message = (error.error?.details || error.error?.error || error.message || 'Google login failed.').toString();
                return of({ success: false, error: message });
            })
        );
    }

    requestPasswordReset(email: string): Observable<{ success: boolean; error?: string; resetToken?: string }> {
        return this.http.post<ForgotPasswordResponse>(this.apiUrl, {
            action: 'forgot-password',
            email,
        }).pipe(
            map((response) => ({
                success: !!response.success,
                error: response.error,
                resetToken: response.data?.resetToken,
            })),
            catchError((error: HttpErrorResponse) => {
                const message = (error.error?.details || error.error?.error || error.message || 'Password reset request failed.').toString();
                return of({ success: false, error: message });
            })
        );
    }

    resetPassword(payload: { email: string; resetToken: string; newPassword: string }): Observable<{ success: boolean; error?: string }> {
        return this.http.post<ForgotPasswordResponse>(this.apiUrl, {
            action: 'reset-password',
            email: payload.email,
            resetToken: payload.resetToken,
            newPassword: payload.newPassword,
        }).pipe(
            map((response) => ({
                success: !!response.success,
                error: response.error,
            })),
            catchError((error: HttpErrorResponse) => {
                const message = (error.error?.details || error.error?.error || error.message || 'Password reset failed.').toString();
                return of({ success: false, error: message });
            })
        );
    }

    logout(): void {
        localStorage.removeItem(this.tokenKey);
        this.currentUser.set(null);
        this.isAuthenticated.set(false);
        this.orderHistory.set([]);
    }

    validateSession(): Observable<boolean> {
        const token = localStorage.getItem(this.tokenKey);
        if (!token) {
            this.logout();
            return of(false);
        }

        return this.http.post<ValidateResponse>(this.apiUrl, {
            action: 'validate',
            token,
        }).pipe(
            map((response) => {
                if (response.success && response.data?.valid && response.data.user) {
                    this.currentUser.set(response.data.user);
                    this.isAuthenticated.set(true);
                    return true;
                }

                this.logout();
                return false;
            }),
            catchError(() => {
                this.logout();
                return of(false);
            })
        );
    }

    private restoreSession(): void {
        const token = localStorage.getItem(this.tokenKey);
        if (!token) {
            return;
        }

        this.validateSession().subscribe();
    }

    fetchOrders(): Observable<boolean> {
        const token = this.getToken();
        if (!token) {
            this.orderHistory.set([]);
            return of(false);
        }

        return this.http.post<OrdersResponse>(this.ordersApiUrl, { token }).pipe(
            map((response) => {
                if (response.success && Array.isArray(response.data?.orders)) {
                    this.orderHistory.set(response.data.orders);
                    return true;
                }

                this.orderHistory.set([]);
                return false;
            }),
            catchError(() => {
                this.orderHistory.set([]);
                return of(false);
            })
        );
    }

    getToken(): string {
        return localStorage.getItem(this.tokenKey) ?? '';
    }
}
