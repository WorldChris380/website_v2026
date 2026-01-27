import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ShopService } from './shop.service';
import { PayPalButton } from './paypal-button';
import { MetaService } from '../services/meta.service';

@Component({
    selector: 'app-shop-cart-page',
    standalone: true,
    imports: [CommonModule, RouterModule, PayPalButton],
    templateUrl: './shop-cart-page.html',
    styleUrl: './shop-cart-page.scss'
})
export class ShopCartPage implements OnInit {
    constructor(
        private shop: ShopService,
        private metaService: MetaService
    ) { }

    ngOnInit() {
        this.metaService.updateSEO({
            title: 'Shopping Cart | Christian Böhme Shop',
            description: 'Review your selected photography prints and complete your purchase with PayPal.',
            url: 'https://www.christian-boehme.com/shop/cart',
            type: 'website'
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
