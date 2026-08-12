import { Component, OnInit, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';

import { Router, RouterModule } from '@angular/router';
import { MetaService } from '../../services/meta.service';
import { ManifestService } from '../../gallery/manifest.service';
import { Language, LanguageService } from '../../language.service';

interface Continent {
    name: string;
    countries: string[];
}

@Component({
    selector: 'app-my-visited-countries',
    standalone: true,
    imports: [RouterModule],
    templateUrl: './my-visited-countries.html',
    changeDetection: ChangeDetectionStrategy.Eager,
    styleUrl: './my-visited-countries.scss'
})
export class MyVisitedCountries implements OnInit {
    currentLanguage: Language = 'en';
    continents: Continent[] = [
        {
            name: 'Africa',
            countries: [
                'Egypt',
                'Cape Verde'
            ]
        },
        {
            name: 'Australia/Oceania',
            countries: [
                'Australia',
                'Fiji'
            ]
        },
        {
            name: 'Asia',
            countries: [
                'Indonesia',
                'Israel',
                'Qatar',
                'Malaysia',
                'Oman',
                'Philippines',
                'Singapore',
                'Thailand',
                'Turkey',
                'United Arab Emirates'
            ]
        },
        {
            name: 'Europe',
            countries: [
                'Belgium',
                'Bulgaria',
                'Denmark',
                'Germany',
                'France',
                'Greece',
                'Ireland',
                'Italy',
                'Latvia',
                'Netherlands',
                'Norway',
                'Austria',
                'Poland',
                'Portugal',
                'Russia',
                'Switzerland',
                'Slovakia',
                'Slovenia',
                'Spain',
                'Czech Republic',
                'Ukraine',
                'Hungary',
                'Vatican City',
                'United Kingdom',
                'Belarus'
            ]
        },
        {
            name: 'North America',
            countries: [
                'Costa Rica',
                'Dominican Republic',
                'United States'
            ]
        }
    ];

    private availableCountries = new Set<string>();
    private countryAliases: Record<string, string> = {
        'united arab emirates': 'United Arab Emirates (UAE)',
        'uae': 'United Arab Emirates (UAE)',
        'czechia': 'Czech Republic'
    };
    private fallbackAvailable = [
        'cape verde',
        'egypt',
        'indonesia',
        'israel',
        'qatar',
        'malaysia',
        'oman',
        'philippines',
        'singapore',
        'thailand',
        'united arab emirates (uae)',
        'australia',
        'fiji',
        'czech republic',
        'greece',
        'costa rica'
    ];
    availabilityReady = false;

    constructor(
        private router: Router,
        private manifestService: ManifestService,
        private cdr: ChangeDetectorRef,
        private metaService: MetaService,
        private languageService: LanguageService
    ) { }

    ngOnInit(): void {
        this.currentLanguage = this.languageService.getCurrentLanguage();
        this.languageService.language$.subscribe((lang) => {
            this.currentLanguage = lang;
            this.updateSeo();
            this.cdr.markForCheck();
        });

        this.updateSeo();

        this.manifestService.loadManifest()
            .then((manifest) => {
                (manifest.images || []).forEach(img => {
                    if (img.country) {
                        const normalized = img.country.trim().toLowerCase();
                        this.availableCountries.add(normalized);
                        // Also add reverse aliases
                        Object.entries(this.countryAliases).forEach(([key, value]) => {
                            if (value.toLowerCase() === normalized) {
                                this.availableCountries.add(key);
                            }
                        });
                    }
                });
                if (manifest.statistics?.countries?.length) {
                    manifest.statistics.countries.forEach(c => {
                        if (c) {
                            const normalized = c.trim().toLowerCase();
                            this.availableCountries.add(normalized);
                            // Also add reverse aliases
                            Object.entries(this.countryAliases).forEach(([key, value]) => {
                                if (value.toLowerCase() === normalized) {
                                    this.availableCountries.add(key);
                                }
                            });
                        }
                    });
                }
                // Always union with fallback to avoid empty state
                this.fallbackAvailable.forEach(c => this.availableCountries.add(c));
                this.availabilityReady = true;
                this.cdr.detectChanges();
            })
            .catch(() => {
                // If manifest loading fails, fall back to known list
                this.fallbackAvailable.forEach(c => this.availableCountries.add(c));
                this.availabilityReady = true;
                this.cdr.detectChanges();
            });
    }

    private updateSeo(): void {
        const isDE = this.currentLanguage === 'de';

        // SEO Meta Tags
        this.metaService.updateSEO(
            {
                title: isDE
                    ? 'Meine besuchten Länder - Interaktive Reisekarte | Christian Böhme'
                    : 'My Visited Countries - Interactive Travel Map | Christian Böhme',
                description: isDE
                    ? 'Interaktive Weltkarte mit den von mir bereisten und fotografierten Ländern über mehrere Kontinente hinweg.'
                    : 'Interactive world map showing countries I have visited and photographed across multiple continents.',
                image: 'https://www.christian-boehme.com/assets/img/other/Dresden%20Skyline.jpg',
                url: 'https://www.christian-boehme.com/my-visited-countries',
                type: 'website'
            },
            {
                "@context": "https://schema.org",
                "@type": "TravelAction",
                "name": isDE ? "Welt-Reisekarte" : "World Travel Map",
                "description": isDE
                    ? "Interaktive Karte der besuchten und fotografierten Länder von Christian Böhme"
                    : "Interactive map of countries visited and photographed by Christian Böhme",
                "agent": {
                    "@type": "Person",
                    "name": "Christian Böhme",
                    "url": "https://www.christian-boehme.com"
                }
            }
        );
    }

    get totalCountries(): number {
        return this.continents.reduce((sum, continent) => sum + continent.countries.length, 0);
    }

    get totalContinents(): number {
        return this.continents.length;
    }

    goToGallery(country: string) {
        if (!this.isCountryAvailable(country)) {
            return;
        }
        const normalized = country.trim().toLowerCase();
        const target = this.countryAliases[normalized] || country;
        this.router.navigate(['/photography'], {
            queryParams: {
                search: target
            }
        });
    }

    isCountryAvailable(country: string): boolean {
        if (!this.availabilityReady) {
            return false;
        }
        const normalized = country.trim().toLowerCase();
        const alias = this.countryAliases[normalized];
        const aliasNormalized = alias ? alias.trim().toLowerCase() : null;
        return this.availableCountries.has(normalized) || (aliasNormalized ? this.availableCountries.has(aliasNormalized) : false);
    }

    translateContinent(continent: string): string {
        if (this.currentLanguage !== 'de') {
            return continent;
        }

        const translations: Record<string, string> = {
            'Africa': 'Afrika',
            'Australia/Oceania': 'Australien/Ozeanien',
            'Asia': 'Asien',
            'Europe': 'Europa',
            'North America': 'Nordamerika'
        };

        return translations[continent] || continent;
    }

    translateCountry(country: string): string {
        if (this.currentLanguage !== 'de') {
            return country;
        }

        const translations: Record<string, string> = {
            'Egypt': 'Aegypten',
            'Cape Verde': 'Kap Verde',
            'Australia': 'Australien',
            'Fiji': 'Fidschi',
            'Indonesia': 'Indonesien',
            'Israel': 'Israel',
            'Qatar': 'Katar',
            'Malaysia': 'Malaysia',
            'Oman': 'Oman',
            'Philippines': 'Philippinen',
            'Singapore': 'Singapur',
            'Thailand': 'Thailand',
            'Turkey': 'Tuerkei',
            'United Arab Emirates': 'Vereinigte Arabische Emirate',
            'Belgium': 'Belgien',
            'Bulgaria': 'Bulgarien',
            'Denmark': 'Daenemark',
            'Germany': 'Deutschland',
            'France': 'Frankreich',
            'Greece': 'Griechenland',
            'Ireland': 'Irland',
            'Italy': 'Italien',
            'Latvia': 'Lettland',
            'Netherlands': 'Niederlande',
            'Norway': 'Norwegen',
            'Austria': 'Österreich',
            'Poland': 'Polen',
            'Portugal': 'Portugal',
            'Russia': 'Russland',
            'Switzerland': 'Schweiz',
            'Slovakia': 'Slowakei',
            'Slovenia': 'Slowenien',
            'Spain': 'Spanien',
            'Czech Republic': 'Tschechien',
            'Ukraine': 'Ukraine',
            'Hungary': 'Ungarn',
            'Vatican City': 'Vatikanstadt',
            'United Kingdom': 'Vereinigtes Königreich',
            'Belarus': 'Belarus',
            'Costa Rica': 'Costa Rica',
            'Dominican Republic': 'Dominikanische Republik',
            'United States': 'Vereinigte Staaten'
        };

        return translations[country] || country;
    }

    getUiText(key: string): string {
        const isDE = this.currentLanguage === 'de';
        const map: Record<string, { en: string; de: string }> = {
            title: { en: 'Countries visited', de: 'Besuchte Länder' },
            countries: { en: 'Countries', de: 'Länder' },
            continents: { en: 'Continents', de: 'Kontinente' },
            photosAvailable: { en: 'Photos available', de: 'Fotos verfügbar' },
            noPhotos: { en: 'No photos yet', de: 'Noch keine Fotos' }
        };

        const entry = map[key];
        if (!entry) {
            return key;
        }

        return isDE ? entry.de : entry.en;
    }
}
