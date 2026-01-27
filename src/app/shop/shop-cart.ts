import { Component, Input, Output, EventEmitter, computed, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ShopService } from './shop.service';
import { PayPalButton } from './paypal-button';

@Component({
    selector: 'app-shop-cart',
    standalone: true,
    imports: [CommonModule, PayPalButton],
    templateUrl: './shop-cart.html',
    styleUrl: './shop-cart.scss'
})
export class ShopCart {
    @Input() openByDefault = false;
    @Output() closed = new EventEmitter<void>();

    readonly isOpen = signal(false);

    get isShopPage(): boolean {
        return this.router.url.startsWith('/shop');
    }

    constructor(private shop: ShopService, private router: Router) {
        if (this.openByDefault) {
            this.isOpen.set(true);
        }
        effect(() => {
            if (this.totalQuantity === 0 && this.isOpen()) {
                this.isOpen.set(false);
                this.closed.emit();
            }
        });
    }

    get items() {
        return this.shop.items$();
    }

    get total() {
        return this.shop.total();
    }

    get totalQuantity() {
        return this.shop.totalQuantity();
    }

    toggle() {
        this.isOpen.update((v) => !v);
        if (!this.isOpen()) {
            this.closed.emit();
        }
    }

    increment(id: string) {
        this.shop.increment(id);
    }

    decrement(id: string) {
        this.shop.decrement(id);
    }

    remove(id: string) {
        this.shop.remove(id);
    }

    clear() {
        this.shop.clear();
    }
}
