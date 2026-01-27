import { Injectable, computed, signal } from '@angular/core';

export interface CartItem {
    id: string;
    title: string;
    imageUrl: string;
    price: number;
    quantity: number;
    currency: 'EUR';
}

@Injectable({ providedIn: 'root' })
export class ShopService {
    private readonly items = signal<CartItem[]>([]);

    readonly items$ = computed(() => this.items());
    readonly total = computed(() => this.items().reduce((sum, item) => sum + item.price * item.quantity, 0));
    readonly totalQuantity = computed(() => this.items().reduce((sum, item) => sum + item.quantity, 0));

    addImageToCart(opts: { id: string; title: string; imageUrl: string; price?: number; currency?: 'EUR' }) {
        const price = Number(opts.price ?? 19);
        const currency: 'EUR' = opts.currency ?? 'EUR';
        this.items.update((current) => {
            const existing = current.find((i) => i.id === opts.id);
            if (existing) {
                return current.map((i) => i.id === opts.id ? { ...i, quantity: i.quantity + 1 } : i);
            }
            return [...current, { id: opts.id, title: opts.title, imageUrl: opts.imageUrl, price, quantity: 1, currency }];
        });
    }

    addProductToCart(opts: { id: string; title: string; imageUrl: string; price?: number; currency?: 'EUR' }) {
        const price = Number(opts.price ?? 34.99);
        const currency: 'EUR' = opts.currency ?? 'EUR';
        this.items.update((current) => {
            const existing = current.find((i) => i.id === opts.id);
            if (existing) {
                return current.map((i) => i.id === opts.id ? { ...i, quantity: i.quantity + 1 } : i);
            }
            return [...current, { id: opts.id, title: opts.title, imageUrl: opts.imageUrl, price, quantity: 1, currency }];
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
}
