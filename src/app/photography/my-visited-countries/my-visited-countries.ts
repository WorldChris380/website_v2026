import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { HttpClient, HttpClientModule } from '@angular/common/http';

interface Continent {
    name: string;
    countries: string[];
}

@Component({
    selector: 'app-my-visited-countries',
    standalone: true,
    imports: [CommonModule, RouterModule, HttpClientModule],
    templateUrl: './my-visited-countries.html',
    styleUrl: './my-visited-countries.scss'
})
export class MyVisitedCountries implements OnInit {
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

    constructor(private router: Router, private http: HttpClient, private cdr: ChangeDetectorRef) { }

    ngOnInit(): void {
        this.http.get<{ images: Array<{ country: string }>, statistics?: { countries?: string[] } }>('assets/img/photography/images-manifest.json').subscribe({
            next: (manifest) => {
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
            },
            error: () => {
                // If manifest is missing, fall back to known list from last generation
                this.fallbackAvailable.forEach(c => this.availableCountries.add(c));
                this.availabilityReady = true;
                this.cdr.detectChanges();
            }
        });
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
        this.router.navigate(['/gallery'], {
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
}
