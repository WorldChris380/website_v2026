import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class DarkModeService {
    private _darkmode$ = new BehaviorSubject<boolean>(this.getInitialDarkMode());
    readonly darkmode$ = this._darkmode$.asObservable();

    constructor() {
        this.applyBodyClass(this._darkmode$.value);
    }

    toggleDarkMode(): void {
        this.setDarkMode(!this._darkmode$.value);
    }

    setDarkMode(value: boolean): void {
        this._darkmode$.next(value);
        this.applyBodyClass(value);
        try { localStorage.setItem('darkmode', value ? 'true' : 'false'); } catch { }
    }

    isDarkMode(): boolean {
        return this._darkmode$.value;
    }

    darkmodePNG(name: string): string {
        return `/assets/img/icons-and-logos/${name}-${this.isDarkMode() ? 'white' : 'black'}.png`;
    }

    darkmodeSVG(name: string): string {
        return `/assets/img/icons-and-logos/${name}-${this.isDarkMode() ? 'white' : 'black'}.svg`;
    }

    private applyBodyClass(enabled: boolean): void {
        if (typeof document !== 'undefined' && document.body) {
            document.body.classList.toggle('dark-mode', enabled);
            console.log('Dark mode applied:', enabled, 'Classes:', document.body.className);
        }
    }

    private getInitialDarkMode(): boolean {
        if (typeof window === 'undefined') return false;
        try {
            const stored = localStorage.getItem('darkmode');
            if (stored === 'true') return true;
            if (stored === 'false') return false;
        } catch { }
        // Default to false instead of system preference
        return false;
    }
}