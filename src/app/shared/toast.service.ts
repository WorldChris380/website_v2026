import { Injectable, signal } from '@angular/core';

export interface Toast {
    id: number;
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
    duration: number;
}

@Injectable({
    providedIn: 'root'
})
export class ToastService {
    private toastId = 0;
    toasts = signal<Toast[]>([]);

    /**
     * Show a success toast
     */
    success(message: string, duration = 3000): void {
        this.show(message, 'success', duration);
    }

    /**
     * Show an error toast
     */
    error(message: string, duration = 4000): void {
        this.show(message, 'error', duration);
    }

    /**
     * Show an info toast
     */
    info(message: string, duration = 3000): void {
        this.show(message, 'info', duration);
    }

    /**
     * Show a warning toast
     */
    warning(message: string, duration = 3500): void {
        this.show(message, 'warning', duration);
    }

    /**
     * Show a toast with custom type and duration
     */
    private show(message: string, type: Toast['type'], duration: number): void {
        const toast: Toast = {
            id: this.toastId++,
            message,
            type,
            duration
        };

        this.toasts.update(toasts => [...toasts, toast]);

        // Auto-remove after duration
        setTimeout(() => {
            this.remove(toast.id);
        }, duration);
    }

    /**
     * Manually remove a toast
     */
    remove(id: number): void {
        this.toasts.update(toasts => toasts.filter(t => t.id !== id));
    }

    /**
     * Clear all toasts
     */
    clearAll(): void {
        this.toasts.set([]);
    }
}
