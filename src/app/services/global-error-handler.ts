import { ErrorHandler, Injectable, inject } from '@angular/core';
import { ToastService } from '../shared/toast.service';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
    private toastService = inject(ToastService);

    handleError(error: Error): void {
        // Log to console for debugging
        console.error('Global error caught:', error);

        // Show user-friendly message
        const message = this.getErrorMessage(error);
        this.toastService.error(message, 5000);

        // In production, you might want to send to error tracking service
        // e.g., Sentry, LogRocket, etc.
    }

    private getErrorMessage(error: Error): string {
        // Customize messages based on error type
        if (error.message.includes('Http failure')) {
            return 'Network error. Please check your connection and try again.';
        }

        if (error.message.includes('404')) {
            return 'The requested resource was not found.';
        }

        if (error.message.includes('timeout')) {
            return 'Request timed out. Please try again.';
        }

        // Generic fallback
        return 'An unexpected error occurred. We\'re working on it!';
    }
}
