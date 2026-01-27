import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MetaService } from '../services/meta.service';
import { ShopService } from './shop.service';
import { ToastService } from '../shared/toast.service';

@Component({
    selector: 'app-shop-home',
    standalone: true,
    imports: [CommonModule, RouterModule],
    templateUrl: './shop-home.html',
    styleUrl: './shop-home.scss'
})
export class ShopHome implements OnInit {
    private shopService = inject(ShopService);
    private toastService = inject(ToastService);

    constructor(private metaService: MetaService) { }

    ngOnInit() {
        this.metaService.updateSEO(
            {
                title: 'Photo Shop | Christian Böhme Photography',
                description: 'Buy selected aviation and travel photography prints, calendars, and custom printables. PayPal checkout for fast and secure ordering.',
                image: 'https://www.christian-boehme.com/assets/img/other/Dresden%20Skyline.jpg',
                url: 'https://www.christian-boehme.com/shop',
                type: 'website'
            },
            {
                "@context": "https://schema.org",
                "@type": "Store",
                "name": "Christian Böhme Photography Shop",
                "description": "Aviation and travel photography prints, calendars and digital downloads",
                "url": "https://www.christian-boehme.com/shop",
                "image": "https://www.christian-boehme.com/assets/img/other/Dresden%20Skyline.jpg",
                "priceRange": "€€",
                "paymentAccepted": ["PayPal", "Credit Card"],
                "currenciesAccepted": "EUR"
            }
        );
    }

    addCalendarToCart() {
        this.shopService.addProductToCart({
            id: 'calendar-2027',
            title: 'Wall Calendar 2027',
            imageUrl: '/assets/img/other/Dresden%20Skyline.jpg',
            price: 34.99,
            currency: 'EUR'
        });
        this.toastService.success('Wall Calendar 2027 added to cart!');
    }
}
