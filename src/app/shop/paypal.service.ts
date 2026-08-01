import { Injectable } from '@angular/core';

declare const paypal: any;

@Injectable({ providedIn: 'root' })
export class PayPalService {
    private loading?: Promise<void>;

    /** Loads the PayPal JS SDK exactly once. Subsequent calls return the same promise. */
    loadSdk(clientId: string, currency: string): Promise<void> {
        if (typeof paypal !== 'undefined') {
            return Promise.resolve();
        }
        if (this.loading) {
            return this.loading;
        }
        this.loading = new Promise<void>((resolve, reject) => {
            const script = document.createElement('script');
            script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=${currency}&components=buttons`;
            script.onload = () => resolve();
            script.onerror = () => {
                this.loading = undefined;
                reject(new Error('PayPal SDK failed to load. A browser extension or network filter may be blocking PayPal.'));
            };
            document.body.appendChild(script);
        });
        return this.loading;
    }

    get isReady(): boolean {
        return typeof paypal !== 'undefined';
    }
}
