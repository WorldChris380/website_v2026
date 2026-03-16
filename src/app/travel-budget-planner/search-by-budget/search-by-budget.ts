import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LanguageService, Language } from '../../language.service';
import { MetaService } from '../../services/meta.service';
import { HeroPresetsComponent } from '../calculator/components/hero-presets/hero-presets.component';
import {
    CountryCostData,
    ReverseBudgetMatch,
    DisplayCurrency
} from '../calculator/calculator';
import { FALLBACK_COUNTRIES } from '../shared-countries.const';

@Component({
    selector: 'app-search-by-budget',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        HeroPresetsComponent,
    ],
    templateUrl: './search-by-budget.html',
    styleUrl: './search-by-budget.scss'
})
export class SearchByBudget implements OnInit {
    currentLanguage: Language = 'en';
    readonly tFn = (key: string) => this.t(key);
    readonly countryLabelFn = (country: CountryCostData) => this.getCountryLabel(country);
    readonly openLinkFn = (url: string) => this.openLink(url);
    readonly formatCurrencyFn = (amount: number) => this.formatCurrency(amount);

    selectedOriginCountryCode: string = 'DE';
    selectedCurrency: DisplayCurrency = 'USD';
    duration: number = 7;
    persons: number = 2;
    reverseBudget: number = 2500;

    reverseMatches: ReverseBudgetMatch[] = [];
    reverseSearchPerformed: boolean = false;
    private readonly brokenFlagCodes = new Set<string>();
    isCalculating: boolean = false;
    countries: CountryCostData[] = [];

    readonly fallbackCountries: CountryCostData[] = FALLBACK_COUNTRIES as CountryCostData[];

    readonly currencyOptions: Array<{ code: DisplayCurrency; label: string }> = [
        { code: 'USD', label: 'USD ($)' },
        { code: 'EUR', label: 'EUR (€)' },
        { code: 'GBP', label: 'GBP (£)' },
        { code: 'CHF', label: 'CHF (CHF)' },
        { code: 'CAD', label: 'CAD (C$)' },
        { code: 'AUD', label: 'AUD (A$)' },
        { code: 'JPY', label: 'JPY (¥)' },
    ];

    private readonly exchangeRates: Record<DisplayCurrency, number> = {
        USD: 1,
        EUR: 0.92,
        GBP: 0.79,
        CHF: 0.88,
        CAD: 1.35,
        AUD: 1.52,
        JPY: 148.2,
    };

    get selectedOriginCountry(): CountryCostData | null {
        if (!this.selectedOriginCountryCode) return null;
        return this.countries.find(c => c.code === this.selectedOriginCountryCode) ?? null;
    }

    get reverseResultsCount(): number {
        return this.reverseMatches.length;
    }

    constructor(
        private languageService: LanguageService,
        private metaService: MetaService,
        private cdr: ChangeDetectorRef
    ) {
        // Countries will be loaded from API in ngOnInit
    }

    ngOnInit(): void {
        this.countries = [...this.fallbackCountries];
        this.currentLanguage = this.languageService.getCurrentLanguage();
        this.updateSeo();
        void this.initializeCountriesFromApis();
        this.languageService.language$.subscribe(lang => {
            this.currentLanguage = lang;
            this.updateSeo();
            this.cdr.markForCheck();
        });
    }

    private updateSeo(): void {
        const isGerman = this.currentLanguage === 'de';
        const title = isGerman
            ? 'Reiseziele nach Budget | Christian Böhme'
            : 'Search Destinations by Budget | Christian Boehme';
        const description = isGerman
            ? 'Gib dein Reisebudget ein und finde passende Reiseziele weltweit für deine nächste Reise.'
            : 'Enter your travel budget and find matching destinations worldwide for your next adventure.';

        this.metaService.updateSEO(
            {
                title,
                description,
                url: 'https://www.christian-boehme.com/search-by-budget',
                type: 'website'
            },
            [
                {
                    '@context': 'https://schema.org',
                    '@type': 'WebApplication',
                    name: isGerman ? 'Reiseziele nach Budget finden' : 'Search Destinations by Budget',
                    applicationCategory: 'TravelApplication',
                    operatingSystem: 'Any',
                    isAccessibleForFree: true,
                    url: 'https://www.christian-boehme.com/search-by-budget',
                    description,
                    offers: {
                        '@type': 'Offer',
                        price: '0',
                        priceCurrency: 'USD'
                    }
                }
            ]
        );
    }

    private async initializeCountriesFromApis(): Promise<void> {
        // Placeholder für Country-API-Logik
        // Dies wird vom Calculator geerbt/geteilt
    }

    t(key: string): string {
        return this.languageService.getTranslation(key) ?? key;
    }

    getCountryLabel(country: CountryCostData): string {
        return this.currentLanguage === 'de' ? country.nameDE : country.name;
    }

    getContinentLabel(continent: string): string {
        const map: Record<string, Record<string, string>> = {
            'Europe': { en: 'Europe', de: 'Europa' },
            'Asia': { en: 'Asia', de: 'Asien' },
            'Africa': { en: 'Africa', de: 'Afrika' },
            'Americas': { en: 'Americas', de: 'Amerika' },
            'Oceania': { en: 'Oceania', de: 'Ozeanien' },
        };
        const lang = this.currentLanguage === 'de' ? 'de' : 'en';
        return map[continent]?.[lang] ?? continent;
    }

    getFlagApiUrl(code: string): string {
        const normalized = code?.toLowerCase();
        if (!normalized || normalized.length !== 2) return '';
        return `https://flagcdn.com/24x18/${normalized}.png`;
    }

    shouldUseFallbackFlag(code: string): boolean {
        if (!code || code.length !== 2) return true;
        return this.brokenFlagCodes.has(code.toUpperCase());
    }

    getFallbackFlagEmoji(code: string): string {
        if (!code || code.length !== 2) return '';
        const upper = code.toUpperCase();
        return String.fromCodePoint(127397 + upper.charCodeAt(0), 127397 + upper.charCodeAt(1));
    }

    onFlagImageError(code: string): void {
        if (!code || code.length !== 2) return;
        this.brokenFlagCodes.add(code.toUpperCase());
    }

    formatCurrency(amount: number): string {
        const multiplier = this.exchangeRates[this.selectedCurrency] ?? 1;
        const converted = amount * multiplier;
        const formatter = new Intl.NumberFormat(
            this.currentLanguage === 'de' ? 'de-DE' : 'en-US',
            { style: 'currency', currency: this.selectedCurrency, maximumFractionDigits: 0 }
        );
        return formatter.format(converted);
    }

    onOriginCountryChange(): void {
        this.cdr.markForCheck();
    }

    onDisplayCurrencyChange(): void {
        this.cdr.markForCheck();
    }

    async findDestinationsByBudget(): Promise<void> {
        // Placeholder - diese Logik wird vom Calculator-Code übernommen
        this.reverseSearchPerformed = true;
        this.cdr.markForCheck();
    }

    clearReverseSearch(): void {
        this.reverseMatches = [];
        this.reverseSearchPerformed = false;
        this.cdr.markForCheck();
    }

    openLink(url: string): void {
        window.open(url, '_blank');
    }

    getOriginVisibleContinents(): string[] {
        return ['Europe', 'Asia', 'Americas', 'Africa', 'Oceania'];
    }

    getOriginCountriesByContinent(continent: string): CountryCostData[] {
        return this.countries.filter(c => c.continent === continent);
    }
}
