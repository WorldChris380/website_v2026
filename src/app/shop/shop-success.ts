import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MetaService } from '../services/meta.service';
import { PurchaseRecord, PurchasedCertificateItem, ShopService } from './shop.service';
import { CertificateService } from './certificate.service';
import { LanguageService, Language } from '../language.service';

@Component({
    selector: 'app-shop-success',
    standalone: true,
    imports: [CommonModule, RouterModule],
    templateUrl: './shop-success.html',
    styleUrl: './shop-success.scss'
})
export class ShopSuccess implements OnInit {
    currentLanguage: Language = 'en';

    constructor(
        private metaService: MetaService,
        private shopService: ShopService,
        private certificateService: CertificateService,
        private languageService: LanguageService
    ) { }

    get lastPurchase(): PurchaseRecord | null {
        return this.shopService.lastPurchase$();
    }

    t(key: string): string {
        const de = this.currentLanguage === 'de';
        const map: Record<string, string> = {
            title: de ? 'Vielen Dank!' : 'Thank you!',
            lead: de ? 'Deine Zahlung wurde erfolgreich verarbeitet. Downloads, Rechnung und Zertifikat stehen direkt bereit.' : 'Your payment was processed successfully. Downloads, invoice, and certificate are available right away.',
            certificates: de ? 'Downloads und Zertifikate' : 'Downloads and Certificates',
            owner: de ? 'Inhaber' : 'Holder',
            company: de ? 'Firma' : 'Company',
            order: de ? 'Bestellung' : 'Order',
            invoice: de ? 'Rechnung' : 'Invoice',
            invoicePdf: de ? 'Rechnung (PDF)' : 'Invoice (PDF)',
            qty: de ? 'Menge' : 'Qty',
            certificatePdf: de ? 'Zertifikat (PDF)' : 'Certificate (PDF)',
            originalPhoto: de ? 'Originalfoto' : 'Original photo',
            empty: de ? 'Keine Bestelldaten gefunden. Ein Zertifikat ist direkt nach erfolgreicher Zahlung verfügbar.' : 'No purchase data found. A certificate is available immediately after a successful payment.',
            backGallery: de ? 'Zurück zur Galerie' : 'Back to gallery',
            backCart: de ? 'Zum Warenkorb' : 'Back to cart',
        };

        return map[key] || key;
    }

    ngOnInit() {
        this.currentLanguage = this.languageService.getCurrentLanguage();
        this.languageService.language$.subscribe((lang) => {
            this.currentLanguage = lang;
        });

        this.metaService.updateSEO({
            title: 'Order Successful | Christian Böhme Shop',
            description: 'Your order has been confirmed. Thank you for your purchase.',
            url: 'https://www.christian-boehme.com/shop/success',
            type: 'website'
        });
    }

    async downloadCertificate(item: PurchasedCertificateItem): Promise<void> {
        const purchase = this.lastPurchase;
        if (!purchase) return;
        await this.certificateService.downloadCertificate(
            {
                ownerName: purchase.ownerName,
                companyName: purchase.companyName,
                orderId: purchase.orderId,
                captureId: purchase.captureId,
                purchasedAt: purchase.purchasedAt,
            },
            {
                id: item.id,
                title: item.title,
                imageUrl: item.imageUrl,
                originalImageUrl: item.originalImageUrl,
                unitPrice: item.unitPrice,
                quantity: item.quantity,
                currency: item.currency,
            },
            this.currentLanguage === 'de' ? 'de' : 'en'
        );
    }

    downloadOriginalPhoto(item: PurchasedCertificateItem): void {
        this.certificateService.downloadOriginalPhoto(item);
    }

    openInvoice(): void {
        const purchase = this.lastPurchase;
        const invoiceUrl = this.normalizeInvoiceUrl(purchase?.invoicePdfUrl ?? '');
        if (!invoiceUrl) {
            return;
        }

        window.open(invoiceUrl, '_blank', 'noopener,noreferrer');
    }

    private normalizeInvoiceUrl(rawUrl: string): string {
        const trimmed = rawUrl.trim();
        if (!trimmed) {
            return '';
        }

        const lang = this.currentLanguage === 'de' ? 'de' : 'en';

        const withLanguage = (url: string): string => {
            const separator = url.includes('?') ? '&' : '?';
            if (/([?&])lang=(de|en)(?:&|$)/i.test(url)) {
                return url.replace(/([?&])lang=(de|en)(?=&|$)/i, `$1lang=${lang}`);
            }
            return `${url}${separator}lang=${lang}`;
        };

        if (trimmed.startsWith('/')) {
            return withLanguage(`${window.location.origin}${trimmed}`);
        }

        if (window.location.protocol === 'https:' && trimmed.startsWith('http://')) {
            return withLanguage(trimmed.replace(/^http:\/\//i, 'https://'));
        }

        return withLanguage(trimmed);
    }
}
