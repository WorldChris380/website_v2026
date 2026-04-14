import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MetaService } from '../services/meta.service';
import { LanguageService, Language } from '../language.service';

@Component({
    selector: 'app-shop-home',
    standalone: true,
    imports: [CommonModule, RouterModule],
    templateUrl: './shop-home.html',
    styleUrl: './shop-home.scss'
})
export class ShopHome implements OnInit {
    private languageService = inject(LanguageService);
    currentLanguage: Language = 'en';

    constructor(private metaService: MetaService) { }

    t(key: string): string {
        const de = this.currentLanguage === 'de';
        const map: Record<string, string> = {
            pageTitle: de ? 'Foto-Lizenzierung' : 'Photo Licensing',
            pageLead: de ? 'Lizenziere ausgewaehlte Aviation- und Reisefotos mit moeglichst wenig Reibung.' : 'License selected aviation and travel photos with as little friction as possible.',
            hint: de ? 'Waehle dein Motiv in der Galerie, lege es in den Warenkorb und schliesse den Kauf in wenigen Schritten ab.' : 'Choose your image in the gallery, add it to cart, and complete the purchase in a few simple steps.',
            badge: de ? 'Lizenz' : 'License',
            productTitle: de ? 'Foto lizenzieren' : 'License Photo',
            productCopy: de ? 'Kaufe eine kommerzielle Bildlizenz fuer die rechtssichere Nutzung eines Fotos aus meiner Galerie in Web, Social, Print oder Praesentationen.' : 'Buy a commercial image license for legally compliant use of a gallery photo on the web, in social media, print, or presentations.',
            meta1: de ? 'Lizenztyp: Standard Commercial License' : 'License type: Standard Commercial License',
            meta2: de ? 'Nutzung: Web, Social Media, Editorial, Praesentation' : 'Usage: Web, social media, editorial, presentation',
            meta3: de ? 'Lieferung: Rechnung + Zertifikat direkt im Konto' : 'Delivery: Invoice + certificate directly in your account',
            meta4: de ? 'Checkout: Digitale Lieferung ohne Versandkosten' : 'Checkout: Digital delivery without shipping costs',
            stock: de ? 'Sofort verfuegbar' : 'Available instantly',
            cta: de ? 'Zur Galerie' : 'Go to gallery',
        };

        return map[key] || key;
    }

    ngOnInit() {
        this.currentLanguage = this.languageService.getCurrentLanguage();
        this.languageService.language$.subscribe((lang) => {
            this.currentLanguage = lang;
        });

        this.metaService.updateSEO(
            {
                title: 'Photo Shop | Christian Böhme Photography',
                description: 'Buy a commercial image license for aviation and travel photography. Fast PayPal checkout and immediate confirmation.',
                image: 'https://www.christian-boehme.com/assets/img/other/Dresden%20Skyline.jpg',
                url: 'https://www.christian-boehme.com/shop',
                type: 'website'
            },
            {
                "@context": "https://schema.org",
                "@type": "Store",
                "name": "Christian Böhme Photography Shop",
                "description": "Commercial and editorial image licensing for aviation and travel photography",
                "url": "https://www.christian-boehme.com/shop",
                "image": "https://www.christian-boehme.com/assets/img/other/Dresden%20Skyline.jpg",
                "priceRange": "€€",
                "paymentAccepted": ["PayPal", "Credit Card"],
                "currenciesAccepted": "EUR"
            }
        );
    }
}
