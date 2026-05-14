import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { ShopService } from './shop.service';
import { PayPalButton } from './paypal-button';
import { MetaService } from '../services/meta.service';
import { ShopAuthService } from './shop-auth.service';
import { LanguageService, Language } from '../language.service';

@Component({
    selector: 'app-shop-cart-page',
    standalone: true,
    imports: [CommonModule, FormsModule, RouterModule, PayPalButton],
    templateUrl: './shop-cart-page.html',
    styleUrl: './shop-cart-page.scss'
})
export class ShopCartPage implements OnInit {
    currentLanguage: Language = 'en';

    constructor(
        private shop: ShopService,
        private metaService: MetaService,
        private router: Router,
        private shopAuthService: ShopAuthService,
        private languageService: LanguageService
    ) { }

    ngOnInit() {
        this.currentLanguage = this.languageService.getCurrentLanguage();
        this.languageService.language$.subscribe((lang) => {
            this.currentLanguage = lang;
        });

        this.metaService.updateSEO({
            title: 'Shopping Cart | Christian Böhme Shop',
            description: 'Review your selected photography prints and complete your purchase with PayPal.',
            url: 'https://www.christian-boehme.com/shop/cart',
            type: 'website'
        });

        this.shopAuthService.validateSession().subscribe(() => {
            this.syncCertificateOwnerWithAccount();
        });
        this.syncCertificateOwnerWithAccount();
    }

    get items() {
        return this.shop.items$();
    }

    get total() {
        return this.shop.total();
    }

    get commercialLicenseUpgrade() {
        return this.shop.hasCommercialLicenseUpgrade();
    }

    get commercialLicenseSurcharge() {
        return this.shop.getCommercialLicenseSurcharge();
    }

    get grandTotal() {
        return this.shop.getGrandTotal();
    }

    get isAuthenticated() {
        return this.shopAuthService.isAuthenticated();
    }

    get totalQuantity() {
        return this.shop.totalQuantity();
    }

    get certificateOwner() {
        return this.shop.getCertificateOwner();
    }

    get canCheckout(): boolean {
        return this.isAuthenticated && this.certificateOwner.trim().length > 0;
    }

    get accountDisplayName(): string {
        const user = this.shopAuthService.currentUser();
        if (!user) {
            return '';
        }

        const fullName = `${(user.firstName || '').trim()} ${(user.lastName || '').trim()}`.trim();
        return fullName || (user.displayName || '').trim() || (user.email || '').trim();
    }

    get completedCheckoutSteps(): number {
        if (!this.isAuthenticated) {
            return 1;
        }

        if (!this.canCheckout) {
            return 2;
        }

        return 3;
    }

    t(key: string): string {
        const de = this.currentLanguage === 'de';
        const map: Record<string, string> = {
            cartTitle: de ? 'Warenkorb' : 'Shopping Cart',
            cartLead: de ? 'Digitale Bildlizenz ohne Versand, ohne Umwege, mit sofortigem Download nach der Zahlung.' : 'Digital image licensing with no shipping, no detours, and instant download after payment.',
            yourItems: de ? 'Deine Auswahl' : 'Your Items',
            remove: de ? 'Entfernen' : 'Remove',
            subtotal: de ? 'Zwischensumme' : 'Subtotal',
            summary: de ? 'Bestellübersicht' : 'Order Summary',
            items: de ? 'Artikel' : 'Items',
            licenseUpgrade: de ? 'Kommerzielle Lizenz-Erweiterung' : 'Commercial license upgrade',
            total: de ? 'Gesamt' : 'Total',
            commercialToggle: de ? 'Kommerzielle Lizenz (+5,00 EUR pro Bild)' : 'Commercial license (+5.00 EUR per image)',
            commercialPerItem: de ? 'Kommerzielle Nutzung für dieses Bild' : 'Commercial usage for this image',
            digitalDelivery: de ? 'Digitale Lizenz. Download und Rechnung sind direkt nach der Zahlung verfügbar.' : 'Digital license. Download and invoice are available immediately after payment.',
            owner: de ? 'Zertifikatsinhaber' : 'Certificate holder',
            ownerHint: de ? 'Der Zertifikatsname wird automatisch aus deinem Konto übernommen.' : 'The certificate holder is taken directly from your account.',
            logout: de ? 'Abmelden' : 'Logout',
            loginRequired: de ? 'Bitte melde dich an, damit der Zertifikatsname automatisch übernommen wird.' : 'Please sign in so the certificate holder can be filled in automatically.',
            goToAccount: de ? 'Zum Konto' : 'Go to account',
            continueShopping: de ? 'Weiter zur Galerie' : 'Continue shopping',
            clearCart: de ? 'Warenkorb leeren' : 'Clear cart',
            emptyCart: de ? 'Dein Warenkorb ist leer' : 'Your cart is empty',
            emptyLead: de ? 'Füge zuerst Fotos aus der Galerie hinzu.' : 'Add photos from the gallery to get started.',
            browseGallery: de ? 'Galerie ansehen' : 'Browse gallery',
            noShipping: de ? 'Kein Versand' : 'No shipping',
            instantAccess: de ? 'Sofortiger Download' : 'Instant download',
            invoiceIncluded: de ? 'Rechnung inklusive' : 'Invoice included',
            simpleCheckout: de ? 'So einfach funktioniert es' : 'How checkout works',
            stepOne: de ? 'Anmelden' : 'Sign in',
            stepOneCopy: de ? 'Dein Kontoname wird direkt fuer Zertifikat und Rechnung genutzt.' : 'Your account name is used directly for certificate and invoice.',
            stepTwo: de ? 'Lizenz bestätigen' : 'Confirm license',
            stepTwoCopy: de ? 'Pro Bild die kommerzielle Nutzung aktivieren. Versand fällt komplett weg.' : 'Enable commercial usage per image. Shipping is removed entirely.',
            stepThree: de ? 'Mit PayPal bezahlen' : 'Pay with PayPal',
            stepThreeCopy: de ? 'Danach stehen Original, Zertifikat und Rechnung sofort bereit.' : 'Afterwards, the original, certificate, and invoice are available immediately.',
            checkoutReady: de ? 'Bereit für den Checkout' : 'Ready for checkout',
            checkoutReadyCopy: de ? 'Dein Zertifikatsname ist übernommen. Du kannst direkt mit PayPal abschließen.' : 'Your certificate name is set. You can complete checkout directly with PayPal.',
            signInRequiredTitle: de ? 'Noch ein Schritt vor PayPal' : 'One step before PayPal',
            signInRequiredCopy: de ? 'Melde dich kurz an, damit Download, Zertifikat und Rechnung automatisch deinem Konto zugeordnet werden.' : 'Sign in briefly so download, certificate, and invoice are assigned to your account automatically.',
        };

        return map[key] || key;
    }

    isPhotoItem(id: string): boolean {
        return /^\d+$/.test(id);
    }

    isCommercialLicenseSelected(id: string): boolean {
        return this.shop.hasItemCommercialLicense(id);
    }

    onCommercialLicenseItemChange(id: string, enabled: boolean): void {
        this.shop.setItemCommercialLicense(id, enabled);
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

    onPaymentSuccess(): void {
        this.router.navigate(['/shop/success']);
    }

    logout(): void {
        this.shopAuthService.logout();
        this.shop.setCertificateOwner('');
    }

    private syncCertificateOwnerWithAccount(): void {
        if (!this.isAuthenticated) {
            this.shop.setCertificateOwner('');
            return;
        }

        const user = this.shopAuthService.currentUser();
        if (!user) {
            return;
        }

        const firstName = (user.firstName || '').trim();
        const lastName = (user.lastName || '').trim();
        const fullName = `${firstName} ${lastName}`.trim();
        const displayName = (user.displayName || '').trim();
        const fallback = (user.email || '').trim();
        const ownerName = fullName || displayName || fallback;

        if (ownerName) {
            this.shop.setCertificateOwner(ownerName);
        }
    }
}
