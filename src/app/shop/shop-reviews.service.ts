import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface VerifiedReview {
    rating: number;
    reviewText: string;
    displayName: string;
    createdAt: string;
    verifiedPurchase: boolean;
}

interface ReviewsListResponse {
    success: boolean;
    data?: {
        reviews: VerifiedReview[];
    };
    error?: string;
    details?: string;
}

interface ReviewCreateResponse {
    success: boolean;
    data?: {
        message?: string;
    };
    error?: string;
    details?: string;
}

@Injectable({ providedIn: 'root' })
export class ShopReviewsService {
    private readonly reviewsApiUrl = `${environment.apiBaseUrl}/api/shop-reviews.php`;

    constructor(private http: HttpClient) { }

    listReviews(productId: string): Observable<{ success: boolean; reviews: VerifiedReview[]; error?: string }> {
        return this.http.post<ReviewsListResponse>(this.reviewsApiUrl, {
            action: 'list',
            productId,
        }).pipe(
            map((response) => ({
                success: !!response.success,
                reviews: Array.isArray(response.data?.reviews) ? response.data?.reviews : [],
                error: response.error,
            })),
            catchError((error: HttpErrorResponse) => {
                const message = (error.error?.details || error.error?.error || error.message || 'Could not load reviews.').toString();
                return of({ success: false, reviews: [], error: message });
            })
        );
    }

    saveReview(payload: { token: string; productId: string; rating: number; reviewText: string }): Observable<{ success: boolean; error?: string }> {
        return this.http.post<ReviewCreateResponse>(this.reviewsApiUrl, {
            action: 'create',
            token: payload.token,
            productId: payload.productId,
            rating: payload.rating,
            reviewText: payload.reviewText,
        }).pipe(
            map((response) => ({
                success: !!response.success,
                error: response.error,
            })),
            catchError((error: HttpErrorResponse) => {
                const message = (error.error?.details || error.error?.error || error.message || 'Could not save review.').toString();
                return of({ success: false, error: message });
            })
        );
    }
}
