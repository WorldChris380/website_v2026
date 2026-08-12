import { Component, OnInit, inject, ChangeDetectionStrategy } from '@angular/core';

import { RouterModule } from '@angular/router';
import { MetaService } from '../services/meta.service';
import { LanguageService, Language } from '../language.service';

@Component({
    selector: 'app-shop-home',
    standalone: true,
    imports: [RouterModule],
    templateUrl: './shop-home.html',
    changeDetection: ChangeDetectionStrategy.Eager,
    styleUrl: './shop-home.scss'
})
export class ShopHome implements OnInit {
    private languageService = inject(LanguageService);
    currentLanguage: Language = 'en';
    usageMode: 'private' | 'commercial' = 'private';

    constructor(private metaService: MetaService) { }

    setUsageMode(mode: 'private' | 'commercial'): void {
        this.usageMode = mode;
    }

    t(key: string): string {
        const de = this.currentLanguage === 'de';
        const map: Record<string, string> = {
            pageTitle: de ? 'Preise' : 'Pricing',
            pageLead: de ? 'Vier Wege, Fotos aus meiner Galerie zu lizenzieren — je nach Bedarf.' : 'Four ways to license photos from my gallery — pick what fits.',
            hint: de ? 'Einzelkauf für ein einzelnes Motiv, Abo für regelmäßigen persönlichen Bedarf, kommerzielles Abo für regelmäßige geschäftliche Nutzung, kommerzielle Lizenz als Einzel-Upgrade.' : 'Single purchase for one photo, subscription for regular personal use, commercial subscription for regular business use, commercial license as a one-off upgrade.',
            hintPrivate: de ? 'Einzelkauf für ein einzelnes Motiv, Abo für regelmäßigen persönlichen Bedarf.' : 'Single purchase for one photo, subscription for regular personal use.',
            hintCommercial: de ? 'Kommerzielles Abo für regelmäßige geschäftliche Nutzung, kommerzielle Lizenz als Einzel-Upgrade zum Einzelkauf.' : 'Commercial subscription for regular business use, commercial license as a one-off upgrade to the single purchase.',
            usagePrivateLabel: de ? 'Privat' : 'Private',
            usageCommercialLabel: de ? 'Kommerziell' : 'Commercial',
            usageToggleAria: de ? 'Zwischen privater und kommerzieller Nutzung wechseln' : 'Switch between private and commercial use',

            singleBadge: de ? 'Einzelkauf' : 'Single purchase',
            singleTitle: de ? 'Foto in Originalqualität' : 'Photo in original quality',
            singleCopy: de ? 'Volle Auflösung, direkt von der Kamera. Keine Komprimierung, keine Wasserzeichen.' : 'Full resolution, straight from the camera. No compression, no watermarks.',
            singleMeta1: de ? 'Originale Kameradatei' : 'Original camera file',
            singleMeta2: de ? 'RAW-Datei auf manuelle Anfrage, sofern vorhanden' : 'RAW file on manual request, where available',
            singleMeta3: de ? 'Volle Auflösung, keine Komprimierung' : 'Full resolution, no compression',
            singleMeta4: de ? 'Persönliche Nutzungslizenz inklusive' : 'Personal use license included',
            singleMeta5: de ? 'Sofortiger Download nach Kauf' : 'Instant download after purchase',
            perPhoto: de ? 'pro Foto' : 'per photo',

            subBadge: de ? 'Abo' : 'Subscription',
            subTitle: de ? 'Bis zu 2 Fotos pro Monat' : 'Up to 2 photos per month',
            subCopy: de ? 'Für regelmäßigen Bedarf: monatlich neue Downloads, kündbar jederzeit im Konto.' : 'For regular use: fresh downloads every month, cancel anytime in your account.',
            subMeta1: de ? '2 Downloads pro Kalendermonat' : '2 downloads per calendar month',
            subMeta2: de ? 'Monatlich 9,99 € oder jährlich 99,99 €' : 'EUR 9.99 monthly or EUR 99.99 billed annually',
            subMeta3: de ? 'Jederzeit kündbar im Konto' : 'Cancel anytime in your account',
            perMonth: de ? 'ab / Monat' : 'from / month',
            subCta: de ? 'Zum Konto' : 'Go to account',

            commSubBadge: de ? 'Kommerzielles Abo' : 'Commercial subscription',
            commSubTitle: de ? 'Bis zu 2 Fotos pro Monat, kommerziell' : 'Up to 2 photos per month, commercial',
            commSubCopy: de ? 'Für regelmäßigen geschäftlichen Bedarf: monatlich neue Downloads mit kommerzieller Lizenz.' : 'For regular business use: fresh downloads every month, with a commercial license.',
            commSubMeta1: de ? '2 Downloads pro Kalendermonat' : '2 downloads per calendar month',
            commSubMeta2: de ? 'Monatlich 19,99 € oder jährlich 199,99 €' : 'EUR 19.99 monthly or EUR 199.99 billed annually',
            commSubMeta3: de ? 'Jederzeit kündbar — Laufzeit wird beachtet' : 'Cancel anytime — the term is still honored',
            commSubCta: de ? 'Zum Konto' : 'Go to account',

            commBadge: de ? 'Upgrade' : 'Upgrade',
            commTitle: de ? 'Kommerzielle Lizenz' : 'Commercial license',
            commCopy: de ? 'Aufpreis auf den Einzelkauf für die geschäftliche Nutzung eines Fotos.' : 'Add-on to the single purchase for business use of a photo.',
            commMeta1: de ? 'Nutzung: Web, Social Media, Werbung' : 'Usage: web, social media, advertising',
            commMeta2: de ? 'Nutzung: redaktionell und in Präsentationen' : 'Usage: editorial and presentations',
            commMeta3: de ? 'Wird beim Kauf als Upgrade ausgewählt' : 'Selected as an upgrade during purchase',
            addOn: de ? 'Aufpreis' : 'add-on',

            galleryCta: de ? 'Zur Galerie' : 'Go to gallery',
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
                title: 'Pricing | Christian Böhme Photography Shop',
                description: 'Overview of photo licensing options: single purchase, personal subscription, commercial subscription, and commercial license upgrade for aviation and travel photography.',
                image: 'https://www.christian-boehme.com/assets/img/other/Dresden%20Skyline.jpg',
                url: 'https://www.christian-boehme.com/shop/pricing',
                type: 'website'
            },
            {
                "@context": "https://schema.org",
                "@type": "Store",
                "name": "Christian Böhme Photography Shop",
                "description": "Commercial and editorial image licensing for aviation and travel photography",
                "url": "https://www.christian-boehme.com/shop/pricing",
                "image": "https://www.christian-boehme.com/assets/img/other/Dresden%20Skyline.jpg",
                "priceRange": "€€",
                "paymentAccepted": ["PayPal", "Credit Card"],
                "currenciesAccepted": "EUR"
            }
        );
    }
}
