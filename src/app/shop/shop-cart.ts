import { Component, Input, Output, EventEmitter, computed, signal, effect, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ShopService } from './shop.service';
import { PayPalButton } from './paypal-button';
import { LanguageService, Language } from '../language.service';

@Component({
    selector: 'app-shop-cart',
    standalone: true,
    imports: [CommonModule, FormsModule, PayPalButton],
    templateUrl: './shop-cart.html',
    changeDetection: ChangeDetectionStrategy.Eager,
    styleUrl: './shop-cart.scss'
})
export class ShopCart {
    @Input() openByDefault = false;
    @Output() closed = new EventEmitter<void>();

    readonly isOpen = signal(false);
    currentLanguage: Language = 'en';

    get isShopPage(): boolean {
        return this.router.url.startsWith('/shop');
    }

    constructor(private shop: ShopService, private router: Router, private languageService: LanguageService) {
        this.currentLanguage = this.languageService.getCurrentLanguage();
        this.languageService.language$.subscribe((lang) => {
            this.currentLanguage = lang;
        });

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

    get certificateOwner() {
        return this.shop.getCertificateOwner();
    }

    get companyName() {
        return this.shop.getCompanyName();
    }

    t(key: string): string {
        const de = this.currentLanguage === 'de';
        const map: Record<string, string> = {
            selection: de ? 'Deine Auswahl' : 'Your selection',
            remove: de ? 'Entfernen' : 'Remove',
            empty: de ? 'Noch keine Artikel. Fuege zuerst Fotos aus der Galerie hinzu.' : 'No items yet. Add photos from the gallery.',
            total: de ? 'Gesamt' : 'Total',
            owner: de ? 'Zertifikatsinhaber' : 'Certificate holder',
            ownerPlaceholder: de ? 'Vor- und Nachname' : 'First and last name',
            company: de ? 'Firmenname (optional)' : 'Company name (optional)',
            companyPlaceholder: de ? 'z. B. Muster GmbH' : 'e.g. Acme Ltd.',
            clear: de ? 'Warenkorb leeren' : 'Clear cart',
        };

        return map[key] || key;
    }

    toggle() {
        this.isOpen.update((v) => !v);
        if (!this.isOpen()) {
            this.closed.emit();
        }
    }

    onPaymentSuccess(): void {
        this.isOpen.set(false);
        this.router.navigate(['/shop/success']);
    }

    onCertificateOwnerChange(name: string) {
        this.shop.setCertificateOwner(name);
    }

    onCompanyNameChange(name: string) {
        this.shop.setCompanyName(name);
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
