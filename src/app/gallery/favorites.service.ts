import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

const STORAGE_KEY = 'photoFavorites';

@Injectable({ providedIn: 'root' })
export class FavoritesService {
    private readonly _favoriteIds$ = new BehaviorSubject<Set<number>>(this.loadFromStorage());
    readonly favoriteIds$ = this._favoriteIds$.asObservable();

    isFavorite(id: number): boolean {
        return this._favoriteIds$.value.has(id);
    }

    toggle(id: number): void {
        const next = new Set(this._favoriteIds$.value);
        if (next.has(id)) {
            next.delete(id);
        } else {
            next.add(id);
        }
        this._favoriteIds$.next(next);
        this.saveToStorage(next);
    }

    get count(): number {
        return this._favoriteIds$.value.size;
    }

    private loadFromStorage(): Set<number> {
        if (typeof window === 'undefined') return new Set();
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return new Set();
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? new Set(parsed.filter((id) => typeof id === 'number')) : new Set();
        } catch {
            return new Set();
        }
    }

    private saveToStorage(ids: Set<number>): void {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(ids)));
        } catch { }
    }
}
