import { Injectable, computed, signal, effect } from '@angular/core';

export interface CartItem {
    id: string;
    title: string;
    imageUrl: string;
    originalImageUrl?: string;
    price: number;
    quantity: number;
    currency: 'EUR';
    commercialLicense?: boolean;
}

const STORAGE_KEY = 'cb-cart-v3';
const OWNER_STORAGE_KEY = 'cb-certificate-owner-v1';
const COMPANY_STORAGE_KEY = 'cb-company-name-v1';
const PURCHASE_STORAGE_KEY = 'cb-last-purchase-v1';
const COMMERCIAL_LICENSE_SURCHARGE_EUR = 10;

export interface PurchasedCertificateItem {
    id: string;
    title: string;
    imageUrl: string;
    originalImageUrl: string;
    unitPrice: number;
    quantity: number;
    currency: 'EUR';
    commercialLicense?: boolean;
}

export interface PurchaseRecord {
    orderNumber: number | null;
    orderId: string;
    captureId: string;
    purchasedAt: string;
    ownerName: string;
    companyName: string;
    total: number;
    commercialLicenseUpgrade: boolean;
    commercialLicenseSurcharge: number;
    currency: 'EUR';
    invoiceNumber: string;
    invoicePdfUrl: string;
    items: PurchasedCertificateItem[];
}

@Injectable({ providedIn: 'root' })
export class ShopService {
    private readonly items = signal<CartItem[]>(this.loadFromStorage());
    private readonly certificateOwner = signal<string>(this.loadOwnerFromStorage());
    private readonly companyName = signal<string>(this.loadCompanyNameFromStorage());
    private readonly lastPurchase = signal<PurchaseRecord | null>(this.loadPurchaseFromStorage());

    readonly items$ = computed(() => this.items());
    readonly total = computed(() => this.items().reduce((sum, item) => sum + item.price * item.quantity, 0));
    readonly commercialLicenseSurcharge = computed(() => {
        const licensedImageQuantity = this.items()
            .filter((item) => this.isImageItem(item.id) && !!item.commercialLicense)
            .reduce((sum, item) => sum + item.quantity, 0);

        return licensedImageQuantity * COMMERCIAL_LICENSE_SURCHARGE_EUR;
    });
    readonly grandTotal = computed(() => this.total() + this.commercialLicenseSurcharge());
    readonly totalQuantity = computed(() => this.items().reduce((sum, item) => sum + item.quantity, 0));
    readonly certificateOwner$ = computed(() => this.certificateOwner());
    readonly companyName$ = computed(() => this.companyName());
    readonly lastPurchase$ = computed(() => this.lastPurchase());

    constructor() {
        effect(() => {
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(this.items()));
            } catch { /* storage unavailable */ }
        });

        effect(() => {
            try {
                localStorage.setItem(OWNER_STORAGE_KEY, this.certificateOwner());
            } catch { /* storage unavailable */ }
        });

        effect(() => {
            try {
                localStorage.setItem(COMPANY_STORAGE_KEY, this.companyName());
            } catch { /* storage unavailable */ }
        });

        effect(() => {
            try {
                const purchase = this.lastPurchase();
                if (purchase) {
                    localStorage.setItem(PURCHASE_STORAGE_KEY, JSON.stringify(purchase));
                } else {
                    localStorage.removeItem(PURCHASE_STORAGE_KEY);
                }
            } catch { /* storage unavailable */ }
        });

    }

    private loadFromStorage(): CartItem[] {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw) as CartItem[];
                return parsed.map((item) => ({
                    ...item,
                    commercialLicense: this.isImageItem(item.id) ? !!item.commercialLicense : false,
                }));
            }
        } catch { /* corrupt data */ }
        return [];
    }

    private loadOwnerFromStorage(): string {
        try {
            const raw = localStorage.getItem(OWNER_STORAGE_KEY) ?? '';
            return raw.trim();
        } catch {
            return '';
        }
    }

    private loadCompanyNameFromStorage(): string {
        try {
            const raw = localStorage.getItem(COMPANY_STORAGE_KEY) ?? '';
            return raw.trim();
        } catch {
            return '';
        }
    }

    private loadPurchaseFromStorage(): PurchaseRecord | null {
        try {
            const raw = localStorage.getItem(PURCHASE_STORAGE_KEY);
            if (!raw) return null;
            return JSON.parse(raw) as PurchaseRecord;
        } catch {
            return null;
        }
    }

    setCertificateOwner(name: string) {
        this.certificateOwner.set(name.trim());
    }

    getCertificateOwner(): string {
        return this.certificateOwner();
    }

    setCompanyName(name: string) {
        this.companyName.set(name.trim());
    }

    getCompanyName(): string {
        return this.companyName();
    }

    setCommercialLicenseUpgrade(enabled: boolean) {
        const shouldEnable = !!enabled;
        this.items.update((current) => current.map((item) => {
            if (!this.isImageItem(item.id)) {
                return { ...item, commercialLicense: false };
            }

            return { ...item, commercialLicense: shouldEnable };
        }));
    }

    hasCommercialLicenseUpgrade(): boolean {
        return this.items().some((item) => this.isImageItem(item.id) && !!item.commercialLicense);
    }

    getCommercialLicenseSurcharge(): number {
        return this.commercialLicenseSurcharge();
    }

    setItemCommercialLicense(id: string, enabled: boolean) {
        this.items.update((current) => current.map((item) => {
            if (item.id !== id) {
                return item;
            }

            if (!this.isImageItem(item.id)) {
                return { ...item, commercialLicense: false };
            }

            return { ...item, commercialLicense: !!enabled };
        }));
    }

    hasItemCommercialLicense(id: string): boolean {
        return this.items().some((item) => item.id === id && !!item.commercialLicense);
    }

    getGrandTotal(): number {
        return this.grandTotal();
    }

    recordSuccessfulPurchase(params: {
        orderId: string;
        orderNumber?: number;
        captureId: string;
        ownerName?: string;
        companyName?: string;
        currency: 'EUR';
        invoiceNumber?: string;
        invoicePdfUrl?: string;
    }) {
        const ownerName = (params.ownerName || this.certificateOwner()).trim();
        const companyName = (params.companyName || this.companyName()).trim();
        const commercialLicenseUpgrade = this.hasCommercialLicenseUpgrade();
        const commercialLicenseSurcharge = this.getCommercialLicenseSurcharge();
        const items = this.items().map((item) => ({
            id: item.id,
            title: item.title,
            imageUrl: item.imageUrl,
            originalImageUrl: item.originalImageUrl || item.imageUrl,
            unitPrice: item.price,
            quantity: item.quantity,
            currency: item.currency,
            commercialLicense: this.isImageItem(item.id) ? !!item.commercialLicense : false,
        }));
        const total = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0) + commercialLicenseSurcharge;

        this.lastPurchase.set({
            orderNumber: typeof params.orderNumber === 'number' && params.orderNumber > 0 ? params.orderNumber : null,
            orderId: params.orderId,
            captureId: params.captureId,
            purchasedAt: new Date().toISOString(),
            ownerName: ownerName || 'Certificate Holder',
            companyName,
            total,
            commercialLicenseUpgrade,
            commercialLicenseSurcharge,
            currency: params.currency,
            invoiceNumber: (params.invoiceNumber || '').trim(),
            invoicePdfUrl: (params.invoicePdfUrl || '').trim(),
            items,
        });

        this.items.update((current) => current.map((item) => ({
            ...item,
            commercialLicense: false,
        })));
    }

    clearLastPurchase() {
        this.lastPurchase.set(null);
    }

    addImageToCart(opts: { id: string; title: string; imageUrl: string; originalImageUrl?: string; price?: number; currency?: 'EUR' }) {
        const price = Number(opts.price ?? 19);
        const currency: 'EUR' = opts.currency ?? 'EUR';
        this.items.update((current) => {
            const existing = current.find((i) => i.id === opts.id);
            if (existing) {
                return current.map((i) => i.id === opts.id ? {
                    ...i,
                    title: opts.title,
                    imageUrl: opts.imageUrl,
                    originalImageUrl: opts.originalImageUrl || opts.imageUrl,
                    price,
                    currency,
                    quantity: i.quantity + 1,
                    commercialLicense: this.isImageItem(i.id) ? !!i.commercialLicense : false,
                } : i);
            }
            return [...current, {
                id: opts.id,
                title: opts.title,
                imageUrl: opts.imageUrl,
                originalImageUrl: opts.originalImageUrl || opts.imageUrl,
                price,
                quantity: 1,
                currency,
                commercialLicense: false,
            }];
        });
    }

    addProductToCart(opts: { id: string; title: string; imageUrl: string; originalImageUrl?: string; price?: number; currency?: 'EUR' }) {
        const price = Number(opts.price ?? 34.99);
        const currency: 'EUR' = opts.currency ?? 'EUR';
        this.items.update((current) => {
            const existing = current.find((i) => i.id === opts.id);
            if (existing) {
                return current.map((i) => i.id === opts.id ? {
                    ...i,
                    title: opts.title,
                    imageUrl: opts.imageUrl,
                    originalImageUrl: opts.originalImageUrl || opts.imageUrl,
                    price,
                    currency,
                    quantity: i.quantity + 1,
                    commercialLicense: this.isImageItem(i.id) ? !!i.commercialLicense : false,
                } : i);
            }
            return [...current, {
                id: opts.id,
                title: opts.title,
                imageUrl: opts.imageUrl,
                originalImageUrl: opts.originalImageUrl || opts.imageUrl,
                price,
                quantity: 1,
                currency,
                commercialLicense: false,
            }];
        });
    }

    increment(id: string) {
        this.items.update((current) => current.map((i) => i.id === id ? { ...i, quantity: i.quantity + 1 } : i));
    }

    decrement(id: string) {
        this.items.update((current) => current
            .map((i) => i.id === id ? { ...i, quantity: Math.max(0, i.quantity - 1) } : i)
            .filter((i) => i.quantity > 0));
    }

    remove(id: string) {
        this.items.update((current) => current.filter((i) => i.id !== id));
    }

    clear() {
        this.items.set([]);
    }

    private isImageItem(id: string): boolean {
        return /^\d+$/.test(id);
    }
}
