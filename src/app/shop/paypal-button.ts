import { Component, ElementRef, Input, Output, EventEmitter, OnChanges, OnDestroy, SimpleChanges, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { PayPalService } from './paypal.service';
import { ShopService, CartItem } from './shop.service';
import { ShopAuthService } from './shop-auth.service';
import { environment } from '../../environments/environment';

declare const paypal: any;

interface PayPalCreateOrderResponse {
    ok: boolean;
    orderId?: string;
    error?: string;
    details?: string;
}

interface PayPalCaptureOrderResponse {
    ok: boolean;
    orderId?: string;
    orderNumber?: number;
    captureId?: string;
    amount?: string;
    currency?: string;
    invoiceNumber?: string;
    invoicePdfUrl?: string;
    error?: string;
    details?: string;
}

interface PayPalClientConfigResponse {
    ok: boolean;
    clientId?: string;
    mode?: string;
    error?: string;
    details?: string;
}

@Component({
    selector: 'app-paypal-button',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './paypal-button.html',
    styleUrl: './paypal-button.scss'
})
export class PayPalButton implements OnChanges, OnDestroy {
    @Input() items: CartItem[] = [];
    @Input() currency: 'EUR' = 'EUR';
    @Input() ownerName = '';
    @Output() paymentSuccess = new EventEmitter<void>();
    @Output() paymentError = new EventEmitter<string>();

    private readonly fallbackClientId = environment.paypalClientId;
    private clientId: string = environment.paypalClientId;
    readonly checkoutApiUrl = `${environment.apiBaseUrl}/api/paypal-checkout.php`;
    readonly configApiUrl = `${environment.apiBaseUrl}/api/paypal-config.php`;
    isLoading = false;

    private http = inject(HttpClient);
    private paypalService = inject(PayPalService);
    private shopService = inject(ShopService);
    private shopAuthService = inject(ShopAuthService);
    private destroyed = false;
    private renderTimer?: ReturnType<typeof setTimeout>;
    private buttonsInstance: any = null;
    private configLoaded = false;

    constructor(private el: ElementRef) { }

    get isPlaceholder(): boolean {
        return this.clientId === 'PAYPAL_CLIENT_ID_PLACEHOLDER';
    }

    get amount(): number {
        const cartTotal = this.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
        const commercialImageQuantity = this.items
            .filter((item) => /^\d+$/.test(item.id) && !!item.commercialLicense)
            .reduce((sum, item) => sum + item.quantity, 0);
        return cartTotal + (commercialImageQuantity * 5);
    }

    ngOnChanges(_changes: SimpleChanges): void {
        clearTimeout(this.renderTimer);
        if (this.amount <= 0 || this.isPlaceholder || this.destroyed) {
            this.safeCleanupButtons();
            return;
        }
        this.renderTimer = setTimeout(() => this.initButtons(), 150);
    }

    ngOnDestroy(): void {
        this.destroyed = true;
        clearTimeout(this.renderTimer);
        this.safeCleanupButtons();
    }

    private async initButtons(): Promise<void> {
        if (this.destroyed) return;
        this.isLoading = true;
        try {
            await this.ensureClientConfig();
            if (this.isPlaceholder) {
                this.isLoading = false;
                return;
            }
            await this.paypalService.loadSdk(this.clientId, this.currency);
            if (!this.destroyed) this.renderButtons();
        } catch {
            this.isLoading = false;
        }
    }

    private async ensureClientConfig(): Promise<void> {
        if (this.configLoaded) {
            return;
        }

        this.configLoaded = true;
        try {
            const response = await firstValueFrom(
                this.http.get<PayPalClientConfigResponse>(this.configApiUrl)
            );

            const serverClientId = (response.clientId || '').trim();
            if (response.ok && serverClientId !== '') {
                this.clientId = serverClientId;
                return;
            }
        } catch {
            // Use the frontend fallback value if the config endpoint is not reachable.
        }

        this.clientId = this.fallbackClientId;
    }

    private async renderButtons(): Promise<void> {
        this.isLoading = false;
        const target = this.el.nativeElement.querySelector('#paypal-btn-container');
        if (!target || !this.paypalService.isReady) return;

        await this.safeCleanupButtons();
        if (this.destroyed) {
            return;
        }

        target.innerHTML = '';

        this.buttonsInstance = paypal.Buttons({
            style: { layout: 'vertical', color: 'gold', shape: 'pill', label: 'paypal' },
            createOrder: async () => this.createServerOrder(),
            onApprove: async (data: { orderID?: string }) => {
                const orderId = data.orderID?.trim();
                if (!orderId) {
                    throw new Error('PayPal did not return an order ID.');
                }

                const capture = await this.captureServerOrder(orderId);

                this.shopService.recordSuccessfulPurchase({
                    orderId,
                    orderNumber: capture.orderNumber,
                    captureId: capture.captureId,
                    ownerName: this.shopService.getCertificateOwner() || this.ownerName,
                    currency: this.currency,
                    invoiceNumber: capture.invoiceNumber,
                    invoicePdfUrl: capture.invoicePdfUrl,
                });

                this.shopService.clear();
                if (document.body.contains(target)) {
                    target.innerHTML = '<div class="paypal-success">✓ Zahlung verifiziert und abgeschlossen.</div>';
                }
                this.paymentSuccess.emit();
            },
            onError: (err: any) => {
                const message = this.toUserErrorMessage(err);
                if (document.body.contains(target)) {
                    target.innerHTML = `<div class="paypal-error">${message}</div>`;
                }
                console.error('PayPal checkout error:', err);
                this.paymentError.emit(message);
            }
        });

        await this.buttonsInstance.render(target);
    }

    private async safeCleanupButtons(): Promise<void> {
        const instance = this.buttonsInstance;
        this.buttonsInstance = null;
        if (!instance || typeof instance.close !== 'function') {
            return;
        }

        try {
            await instance.close();
        } catch {
            // Ignore cleanup errors from detached containers.
        }
    }

    private async createServerOrder(): Promise<string> {
        let response: PayPalCreateOrderResponse;
        try {
            response = await firstValueFrom(
                this.http.post<PayPalCreateOrderResponse>(this.checkoutApiUrl, {
                    action: 'create-order',
                    currency: this.currency,
                    items: this.items,
                })
            );
        } catch (error) {
            throw new Error(this.toUserErrorMessage(error));
        }

        if (!response.ok || !response.orderId) {
            throw new Error(response.details || response.error || 'Could not create PayPal order.');
        }

        return response.orderId;
    }

    private async captureServerOrder(orderId: string): Promise<{ captureId: string; orderNumber?: number; invoiceNumber?: string; invoicePdfUrl?: string }> {
        let response: PayPalCaptureOrderResponse;
        try {
            response = await firstValueFrom(
                this.http.post<PayPalCaptureOrderResponse>(this.checkoutApiUrl, {
                    action: 'capture-order',
                    orderId,
                    currency: this.currency,
                    ownerName: this.ownerName,
                    items: this.items,
                    token: this.shopAuthService.getToken(),
                })
            );
        } catch (error) {
            throw new Error(this.toUserErrorMessage(error));
        }

        if (!response.ok || !response.captureId) {
            throw new Error(response.details || response.error || 'Could not capture PayPal order.');
        }

        return {
            captureId: response.captureId,
            orderNumber: typeof response.orderNumber === 'number' ? response.orderNumber : undefined,
            invoiceNumber: response.invoiceNumber,
            invoicePdfUrl: response.invoicePdfUrl,
        };
    }

    private toUserErrorMessage(error: unknown): string {
        if (error instanceof HttpErrorResponse) {
            const statusText = error.status ? `HTTP ${error.status}` : 'Network error';
            const details = (error.error?.details || error.error?.error || error.message || '').toString();
            return `Zahlung konnte nicht abgeschlossen werden (${statusText}): ${details}`;
        }

        if (error && typeof error === 'object' && 'message' in error) {
            const message = String((error as { message: string }).message || '').trim();
            if (message) {
                return `Zahlung konnte nicht abgeschlossen werden: ${message}`;
            }
        }

        return 'Zahlung konnte nicht abgeschlossen werden.';
    }
}
