import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface ShopSubscriptionStatus {
    active: boolean;
    status: string;
    planCode: string;
    planName: string;
    startedAt: string;
    expiresAt: string;
    monthlyDownloadLimit: number;
    monthlyDownloadsUsed: number;
    monthlyDownloadsRemaining: number;
    cancelAtPeriodEnd: boolean;
}

export interface ShopSubscriptionHistoryEntry {
    id: number;
    planCode: string;
    planName: string;
    status: string;
    startedAt: string;
    expiresAt: string;
    updatedAt: string;
    monthlyDownloadLimit: number;
    monthlyDownloadsUsed: number;
}

interface SubscriptionResponse {
    success: boolean;
    data?: {
        subscription?: Record<string, unknown> | null;
        history?: Record<string, unknown>[];
        downloadUrl?: string;
        remainingDownloads?: number;
    };
    error?: string;
    details?: string;
}

@Injectable({ providedIn: 'root' })
export class ShopSubscriptionService {
    private readonly apiUrl = `${environment.apiBaseUrl}/api/shop-subscription.php`;

    constructor(private http: HttpClient) { }

    getStatus(token: string): Observable<{ success: boolean; status: ShopSubscriptionStatus | null; error?: string }> {
        return this.http.post<SubscriptionResponse>(this.apiUrl, {
            action: 'status',
            token,
        }).pipe(
            map((response) => ({
                success: !!response.success,
                status: this.mapStatus(response.data?.subscription ?? null),
                error: response.error,
            })),
            catchError((error: HttpErrorResponse) => {
                const message = (error.error?.details || error.error?.error || error.message || 'Could not load subscription status.').toString();
                return of({ success: false, status: null, error: message });
            })
        );
    }

    consumeDownload(payload: { token: string; imageId: number }): Observable<{ success: boolean; downloadUrl?: string; remainingDownloads?: number; status?: ShopSubscriptionStatus | null; error?: string }> {
        return this.http.post<SubscriptionResponse>(this.apiUrl, {
            action: 'consume-download',
            token: payload.token,
            imageId: payload.imageId,
        }).pipe(
            map((response) => ({
                success: !!response.success,
                downloadUrl: (response.data?.downloadUrl || '').toString() || undefined,
                remainingDownloads: typeof response.data?.remainingDownloads === 'number' ? response.data?.remainingDownloads : undefined,
                status: this.mapStatus(response.data?.subscription ?? null),
                error: response.error,
            })),
            catchError((error: HttpErrorResponse) => {
                const message = (error.error?.details || error.error?.error || error.message || 'Could not start download.').toString();
                return of({ success: false, error: message, status: null });
            })
        );
    }

    cancel(token: string): Observable<{ success: boolean; status: ShopSubscriptionStatus | null; error?: string }> {
        return this.http.post<SubscriptionResponse>(this.apiUrl, {
            action: 'cancel',
            token,
        }).pipe(
            map((response) => ({
                success: !!response.success,
                status: this.mapStatus(response.data?.subscription ?? null),
                error: response.error,
            })),
            catchError((error: HttpErrorResponse) => {
                const message = (error.error?.details || error.error?.error || error.message || 'Could not cancel subscription.').toString();
                return of({ success: false, status: null, error: message });
            })
        );
    }

    getHistory(token: string): Observable<{ success: boolean; history: ShopSubscriptionHistoryEntry[]; error?: string }> {
        return this.http.post<SubscriptionResponse>(this.apiUrl, {
            action: 'history',
            token,
        }).pipe(
            map((response) => ({
                success: !!response.success,
                history: Array.isArray(response.data?.history)
                    ? response.data!.history.map((entry) => this.mapHistoryEntry(entry)).filter((entry): entry is ShopSubscriptionHistoryEntry => !!entry)
                    : [],
                error: response.error,
            })),
            catchError((error: HttpErrorResponse) => {
                const message = (error.error?.details || error.error?.error || error.message || 'Could not load subscription history.').toString();
                return of({ success: false, history: [], error: message });
            })
        );
    }

    private mapStatus(raw: Record<string, unknown> | null): ShopSubscriptionStatus | null {
        if (!raw) {
            return null;
        }

        return {
            active: !!raw['active'],
            status: String(raw['status'] || ''),
            planCode: String(raw['planCode'] || ''),
            planName: String(raw['planName'] || ''),
            startedAt: String(raw['startedAt'] || ''),
            expiresAt: String(raw['expiresAt'] || ''),
            monthlyDownloadLimit: Number(raw['monthlyDownloadLimit'] || 0),
            monthlyDownloadsUsed: Number(raw['monthlyDownloadsUsed'] || 0),
            monthlyDownloadsRemaining: Number(raw['monthlyDownloadsRemaining'] || 0),
            cancelAtPeriodEnd: !!raw['cancelAtPeriodEnd'],
        };
    }

    private mapHistoryEntry(raw: Record<string, unknown> | null): ShopSubscriptionHistoryEntry | null {
        if (!raw) {
            return null;
        }

        const id = Number(raw['id'] || 0);
        if (!Number.isFinite(id) || id <= 0) {
            return null;
        }

        return {
            id,
            planCode: String(raw['planCode'] || ''),
            planName: String(raw['planName'] || ''),
            status: String(raw['status'] || ''),
            startedAt: String(raw['startedAt'] || ''),
            expiresAt: String(raw['expiresAt'] || ''),
            updatedAt: String(raw['updatedAt'] || ''),
            monthlyDownloadLimit: Number(raw['monthlyDownloadLimit'] || 0),
            monthlyDownloadsUsed: Number(raw['monthlyDownloadsUsed'] || 0),
        };
    }
}
