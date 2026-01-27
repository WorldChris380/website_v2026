import { Component, ElementRef, Input, OnChanges, OnDestroy, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';

declare const paypal: any;

@Component({
    selector: 'app-paypal-button',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './paypal-button.html',
    styleUrl: './paypal-button.scss'
})
export class PayPalButton implements OnChanges, OnDestroy {
    @Input() amount = 0;
    @Input() currency: 'EUR' = 'EUR';
    @Input() clientId = 'YOUR_PAYPAL_CLIENT_ID';

    private scriptEl?: HTMLScriptElement;

    constructor(private el: ElementRef) { }

    ngOnChanges(changes: SimpleChanges): void {
        if (this.amount <= 0) {
            return;
        }
        if (typeof paypal === 'undefined') {
            this.loadSdk();
        } else {
            this.renderButtons();
        }
    }

    ngOnDestroy(): void {
        if (this.scriptEl) {
            document.body.removeChild(this.scriptEl);
        }
    }

    private loadSdk() {
        if (this.clientId === 'YOUR_PAYPAL_CLIENT_ID') {
            return;
        }
        const url = `https://www.paypal.com/sdk/js?client-id=${this.clientId}&currency=${this.currency}`;
        this.scriptEl = document.createElement('script');
        this.scriptEl.src = url;
        this.scriptEl.onload = () => this.renderButtons();
        document.body.appendChild(this.scriptEl);
    }

    private renderButtons() {
        const target = this.el.nativeElement.querySelector('#paypal-btn-container');
        if (!target || typeof paypal === 'undefined') {
            return;
        }
        target.innerHTML = '';
        paypal.Buttons({
            style: { layout: 'vertical', color: 'gold', shape: 'pill', label: 'paypal' },
            createOrder: (_: any, actions: any) => actions.order.create({
                purchase_units: [{ amount: { value: this.amount.toFixed(2), currency_code: this.currency } }]
            }),
            onApprove: (_: any, actions: any) => actions.order.capture().then(() => {
                target.innerHTML = '<div class="paypal-success">Payment completed</div>';
            }),
            onError: () => {
                target.innerHTML = '<div class="paypal-error">Payment could not be completed.</div>';
            }
        }).render(target);
    }
}
