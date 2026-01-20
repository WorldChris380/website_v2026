import { Component, OnInit, NgZone, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule, HttpClient } from '@angular/common/http';
import { RouterModule } from '@angular/router';
import { DarkModeService } from '../../dark-mode.service';
import { LanguageService, Language } from '../../language.service';

interface Manifest {
    totalPhotos: number;
    aviationPhotos: number;
    travelPhotos: number;
    countriesPresented?: number;
    countriesVisited?: number;
}

@Component({
    selector: 'app-counters',
    standalone: true,
    imports: [CommonModule, HttpClientModule, RouterModule],
    templateUrl: './counters.html',
    styleUrls: ['./counters.scss']
})
export class Counters implements OnInit {
    loading = true;
    darkmode = false;
    currentLanguage: Language = 'en';
    // Default numeric values (can act as fallback / configurable defaults)
    defaultTotalPhotos = 150000;
    defaultCountriesVisited = 42;

    manifest: Manifest = { totalPhotos: 0, aviationPhotos: 0, travelPhotos: 0, countriesPresented: 0, countriesVisited: 0 };
    // Animated display values
    displayTotalPhotos: number = 0;
    displayAviationPhotos: number = 0;
    displayTravelPhotos: number = 0;
    displayCountriesPresented: number = 0;
    displayCountriesVisited: number = 0;

    constructor(
        private http: HttpClient,
        private darkModeService: DarkModeService,
        private languageService: LanguageService,
        private ngZone: NgZone,
        private cdr: ChangeDetectorRef
    ) { }

    ngOnInit(): void {
        // Subscribe to dark mode changes
        this.darkmode = this.darkModeService.isDarkMode();
        this.darkModeService.darkmode$.subscribe((isDark) => {
            this.darkmode = isDark;
        });

        // Subscribe to language changes
        this.currentLanguage = this.languageService.getCurrentLanguage();
        this.languageService.language$.subscribe((lang) => {
            this.currentLanguage = lang;
            this.cdr.markForCheck();
        });

        // Try to load a pre-generated manifest from assets
        this.http.get<Manifest>('/assets/img/photography/manifest.json').subscribe({
            next: (m) => {
                this.manifest = m;
                // Apply defaults if manifest lacks values
                if (!this.manifest.totalPhotos || this.manifest.totalPhotos <= 0) {
                    this.manifest.totalPhotos = this.defaultTotalPhotos;
                }
                if (!this.manifest.countriesVisited || this.manifest.countriesVisited <= 0) {
                    this.manifest.countriesVisited = this.defaultCountriesVisited;
                }
                this.startAnimations();
                this.loading = false;
            },
            error: () => {
                // If manifest not present, fallback to defaults (0) and stop loading
                this.manifest.totalPhotos = this.defaultTotalPhotos;
                this.manifest.countriesVisited = this.defaultCountriesVisited;
                this.startAnimations();
                this.loading = false;
            }
        });
    }

    private startAnimations(): void {
        // animate numbers with suitable durations
        this.animateValue('displayTotalPhotos', this.manifest.totalPhotos || this.defaultTotalPhotos, 1600);
        this.animateValue('displayAviationPhotos', this.manifest.aviationPhotos || 0, 1000);
        this.animateValue('displayTravelPhotos', this.manifest.travelPhotos || 0, 1000);
        this.animateValue('displayCountriesPresented', this.manifest.countriesPresented || 0, 900);
        this.animateValue('displayCountriesVisited', this.manifest.countriesVisited || this.defaultCountriesVisited, 900);
    }

    private animateValue(key: keyof Counters, endValue: number, duration = 1200) {
        const start = performance.now();
        const startValue = 0;
        const step = (now: number) => {
            const progress = Math.min((now - start) / duration, 1);
            const eased = this.easeOutCubic(progress);
            // @ts-ignore dynamic assignment to display* property
            this.ngZone.run(() => {
                (this as any)[key] = Math.round(startValue + (endValue - startValue) * eased);
                // ensure view updates even if rAF runs outside Angular
                this.cdr.markForCheck();
            });
            if (progress < 1) {
                requestAnimationFrame(step);
            }
        };
        requestAnimationFrame(step);
    }

    private easeOutCubic(t: number) {
        return 1 - Math.pow(1 - t, 3);
    }

    formatNumber(value?: number): string {
        const v = typeof value === 'number' ? value : 0;
        try {
            return new Intl.NumberFormat('de-DE').format(v);
        } catch {
            return String(v);
        }
    }
}
