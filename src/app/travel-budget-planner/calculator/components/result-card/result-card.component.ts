import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import type {
    BudgetResult,
    CountryCostData,
    CountryInsight,
    CountryPriceComparison,
    DisplayCurrency,
    SafetyLevel,
    TourismDevelopment,
} from '../../calculator';
import type { Language } from '../../../../language.service';

@Component({
    selector: 'app-calc-result-card',
    standalone: true,
    imports: [CommonModule],
    styleUrl: './result-card.component.scss',
    template: `
<div class="calc-result-card" *ngIf="selectedCountry && !isCalculating">
    <div class="country-info-box">
        <div class="country-info-photo" [class.photo-loading]="!countryPhotoUrl">
            <img *ngIf="countryPhotoUrl" [src]="countryPhotoUrl" [alt]="getCountryLabel(selectedCountry)" loading="eager" decoding="async">
        </div>
        <div class="country-info-header">
            <span class="country-info-flag" aria-hidden="true">
                <img *ngIf="!isFlagBroken(selectedCountry.code)" [src]="getFlagApiUrl(selectedCountry.code)" [alt]="''"
                    loading="lazy" decoding="async" (error)="markFlagBroken(selectedCountry.code)">
                <span *ngIf="isFlagBroken(selectedCountry.code)">{{ getFallbackFlagEmoji(selectedCountry.code) }}</span>
            </span>
            <h3 class="country-info-name">{{ getCountryLabel(selectedCountry) }}</h3>
            <span class="country-info-continent">{{ getContinentLabel(selectedCountry.continent) }}</span>
        </div>

        <ul class="country-info-list">
            <li class="country-info-item">
                <span class="country-info-icon">&#128737;</span>
                <span class="country-info-label">{{ currentLanguage === 'de' ? 'Sicherheit' : 'Safety' }}</span>
                <span class="country-info-value">{{ getSafetyLabel(getCountrySafety(selectedCountry)) }}</span>
            </li>
            <li class="country-info-item">
                <span class="country-info-icon">&#127758;</span>
                <span class="country-info-label">{{ currentLanguage === 'de' ? 'Tourismus' : 'Tourism' }}</span>
                <span class="country-info-value">{{ getTourismLabel(getCountryTourismDevelopment(selectedCountry)) }}</span>
            </li>
            <li class="country-info-item">
                <span class="country-info-icon">&#128181;</span>
                <span class="country-info-label">{{ currentLanguage === 'de' ? 'Preisniveau' : 'Price level' }}</span>
                <span class="country-info-value">{{ getPriceLevelLabel(selectedCountry) }}</span>
            </li>
            <li class="country-info-item">
                <span class="country-info-icon">&#128197;</span>
                <span class="country-info-label">{{ currentLanguage === 'de' ? 'Reisesaison' : 'Season' }}</span>
                <span class="country-info-value">{{ getSeasonValue(selectedCountry) }}</span>
            </li>
            <li class="country-info-item" *ngIf="currentInsight">
                <span class="country-info-icon">&#9728;</span>
                <span class="country-info-label">{{ currentLanguage === 'de' ? 'Beste Reisezeit' : 'Best time' }}</span>
                <span class="country-info-value">{{ currentLanguage === 'de' ? currentInsight.bestTimeDE : currentInsight.bestTime }}</span>
            </li>
        </ul>
    </div>

    <section class="country-compare-box" *ngIf="selectedCountryComparison">
        <div class="compare-head">
            <h3>{{ currentLanguage === 'de' ? 'Preisvergleich Wunschland' : 'Desired destination price comparison' }}</h3>
            <p class="compare-subtitle">{{ getCountryLabel(selectedCountry) }}</p>
        </div>

        <div class="compare-total-card" [class.expanded]="compareExpanded">
            <div class="compare-total-header">
                <div>
                    <p class="compare-total-label">{{ currentLanguage === 'de' ? 'Gesamtkosten Wunschland' : 'Selected destination total' }}</p>
                    <p class="compare-total-value">{{ formatCurrency(selectedCountryComparison.selectedTotal) }}</p>
                </div>
                <button *ngIf="result" class="compare-toggle-btn" (click)="compareExpanded = !compareExpanded"
                    [attr.aria-expanded]="compareExpanded"
                    [title]="compareExpanded ? (currentLanguage === 'de' ? 'Weniger anzeigen' : 'Show less') : (currentLanguage === 'de' ? 'Berechnung anzeigen' : 'Show calculation')">
                    {{ compareExpanded ? '&#9650;' : '&#9660;' }}
                </button>
            </div>
            <div class="compare-breakdown" *ngIf="compareExpanded && result">
                <p class="compare-breakdown-title">{{ currentLanguage === 'de' ? 'So setzt sich der Betrag zusammen:' : 'How this total is calculated:' }}</p>
                <div class="compare-breakdown-row">
                    <span>{{ currentLanguage === 'de' ? 'Unterkunft' : 'Accommodation' }} <small>({{ duration }}&nbsp;{{ currentLanguage === 'de' ? 'N&auml;chte' : 'nights' }},&nbsp;{{ persons }}&nbsp;{{ currentLanguage === 'de' ? 'Pers.' : 'pp' }})</small></span>
                    <span>{{ formatCurrency(result.accommodation) }}</span>
                </div>
                <div class="compare-breakdown-row">
                    <span>{{ currentLanguage === 'de' ? 'Essen &amp; Trinken' : 'Food &amp; Drinks' }}</span>
                    <span>{{ formatCurrency(result.food) }}</span>
                </div>
                <div class="compare-breakdown-row">
                    <span>{{ currentLanguage === 'de' ? 'Transport vor Ort' : 'Local transport' }}</span>
                    <span>{{ formatCurrency(result.transport) }}</span>
                </div>
                <div class="compare-breakdown-row" *ngIf="result.activities">
                    <span>{{ currentLanguage === 'de' ? 'Aktivit&auml;ten' : 'Activities' }}</span>
                    <span>{{ formatCurrency(result.activities) }}</span>
                </div>
                <div class="compare-breakdown-row" *ngIf="result.flight">
                    <span>{{ currentLanguage === 'de' ? 'Hin- &amp; R&uuml;ckflug' : 'Return flight' }}</span>
                    <span>{{ formatCurrency(result.flight) }}</span>
                </div>
                <div class="compare-breakdown-row compare-breakdown-sub">
                    <span>{{ currentLanguage === 'de' ? 'Zwischensumme' : 'Subtotal' }}</span>
                    <span>{{ formatCurrency(result.subtotal) }}</span>
                </div>
                <div class="compare-breakdown-row">
                    <span>{{ currentLanguage === 'de' ? 'Puffer (' + bufferPercentage + '%)' : 'Buffer (' + bufferPercentage + '%)' }}</span>
                    <span>+{{ formatCurrency(result.buffer) }}</span>
                </div>
                <div class="compare-breakdown-row compare-breakdown-total">
                    <span>{{ currentLanguage === 'de' ? 'Gesamtbetrag' : 'Grand total' }}</span>
                    <span>{{ formatCurrency(result.grandTotal) }}</span>
                </div>
            </div>
        </div>

        <div class="compare-stats-grid">
            <div class="compare-stat">
                <span class="compare-stat-label">{{ currentLanguage === 'de' ? 'Kostenrang' : 'Cost rank' }}</span>
                <strong class="compare-stat-value">#{{ selectedCountryComparison.rank }} {{ currentLanguage === 'de' ? 'von' : 'of' }} {{ selectedCountryComparison.totalCountries }}</strong>
            </div>

            <div class="compare-stat">
                <span class="compare-stat-label">{{ currentLanguage === 'de' ? 'Guenstiger' : 'Cheaper' }}</span>
                <strong class="compare-stat-value">{{ selectedCountryComparison.cheaperCount }}</strong>
            </div>

            <div class="compare-stat">
                <span class="compare-stat-label">{{ currentLanguage === 'de' ? 'Teurer' : 'More expensive' }}</span>
                <strong class="compare-stat-value">{{ selectedCountryComparison.expensiveCount }}</strong>
            </div>
        </div>

        <div class="compare-rank-track" aria-hidden="true">
            <div class="compare-rank-fill"
                [class.mid]="isMidPrice(selectedCountryComparison)"
                [class.expensive]="isExpensivePrice(selectedCountryComparison)"
                [style.width.%]="getCompareRankPercent(selectedCountryComparison)"></div>
        </div>
    </section>

    <ng-container *ngIf="result">
        <h2 class="result-title">{{ t('calcResultTitle') }}</h2>
        <div class="result-summary">
            <div class="summary-box primary">
                <span class="summary-label">{{ t('calcTotal') }}</span>
                <span class="summary-value">{{ formatCurrency(result.grandTotal) }}</span>
            </div>
            <div class="summary-box">
                <span class="summary-label">{{ t('calcPerPerson') }}</span>
                <span class="summary-value">{{ formatCurrency(result.totalPerPerson) }}</span>
            </div>
            <div class="summary-box">
                <span class="summary-label">{{ t('calcPerDay') }}</span>
                <span class="summary-value">{{ formatCurrency(result.dailyPerPerson) }}</span>
            </div>
        </div>

        <div class="breakdown">
            <div class="breakdown-item">
                <div class="breakdown-label">
                    <span>{{ t('calcAccom') }}</span>
                    <span>{{ formatCurrency(result.accommodation) }}</span>
                </div>
                <div class="breakdown-bar">
                    <div class="bar-fill accom" [style.width]="getBarWidth(result.accommodation, result.subtotal)"></div>
                </div>
            </div>
            <div class="breakdown-item">
                <div class="breakdown-label">
                    <span>{{ t('calcFood') }}</span>
                    <span>{{ formatCurrency(result.food) }}</span>
                </div>
                <div class="breakdown-bar">
                    <div class="bar-fill food" [style.width]="getBarWidth(result.food, result.subtotal)"></div>
                </div>
            </div>
            <div class="breakdown-item">
                <div class="breakdown-label">
                    <span>{{ t('calcTransport') }}</span>
                    <span>{{ formatCurrency(result.transport) }}</span>
                </div>
                <div class="breakdown-bar">
                    <div class="bar-fill transport" [style.width]="getBarWidth(result.transport, result.subtotal)"></div>
                </div>
            </div>
            <div class="breakdown-item" *ngIf="result.activities">
                <div class="breakdown-label">
                    <span>{{ t('calcActivities') }}</span>
                    <span>{{ formatCurrency(result.activities) }}</span>
                </div>
                <div class="breakdown-bar">
                    <div class="bar-fill activities" [style.width]="getBarWidth(result.activities, result.subtotal)"></div>
                </div>
            </div>
            <div class="breakdown-item" *ngIf="result.flight">
                <div class="breakdown-label">
                    <span>{{ t('calcFlight') }}</span>
                    <span>{{ formatCurrency(result.flight) }}</span>
                </div>
                <div class="breakdown-bar">
                    <div class="bar-fill flight" [style.width]="getBarWidth(result.flight, result.subtotal)"></div>
                </div>
            </div>
            <div class="breakdown-item buffer">
                <div class="breakdown-label">
                    <span>{{ t('calcBuffer') }} ({{ bufferPercentage }}%)</span>
                    <span>+{{ formatCurrency(result.buffer) }}</span>
                </div>
            </div>
        </div>
    </ng-container>
    <div class="affiliate-inner" *ngIf="result">
        <h3 class="affiliate-title">{{ t('calcBookNow') }}</h3>
        <p class="affiliate-note">{{ t('calcAffiliateDisclosure') }}</p>
        <div class="affiliate-grid">
            <button class="affiliate-btn booking" (click)="openLink(selectedCountry.bookingUrl)">
                <span class="aff-icon">&#127976;</span>
                <span class="aff-label">{{ t('calcBookHotel') }}</span>
                <span class="aff-brand">Booking.com</span>
            </button>
            <button class="affiliate-btn skyscanner" (click)="openLink(selectedCountry.skyscannerUrl)">
                <span class="aff-icon">&#9992;&#65039;</span>
                <span class="aff-label">{{ t('calcBookFlight') }}</span>
                <span class="aff-brand">Skyscanner</span>
            </button>
            <button class="affiliate-btn getyourguide" (click)="openLink(selectedCountry.getYourGuideUrl)">
                <span class="aff-icon">&#127917;</span>
                <span class="aff-label">{{ t('calcBookActivities') }}</span>
                <span class="aff-brand">GetYourGuide</span>
            </button>
            <button class="affiliate-btn airbnb" (click)="openLink(selectedCountry.airbnbUrl)">
                <span class="aff-icon">&#127968;</span>
                <span class="aff-label">{{ t('calcBookAirbnb') }}</span>
                <span class="aff-brand">Airbnb</span>
            </button>
        </div>
    </div>
</div>
`
})
export class ResultCardComponent {
    @Input({ required: true }) result: BudgetResult | null = null;
    @Input({ required: true }) selectedCountry: CountryCostData | null = null;
    @Input({ required: true }) currentInsight: CountryInsight | null = null;
    @Input({ required: true }) originCountry: CountryCostData | null = null;
    @Input({ required: true }) duration: number = 7;
    @Input({ required: true }) persons: number = 2;
    @Input({ required: true }) currentLanguage: Language = 'en';
    @Input({ required: true }) displayCurrency: DisplayCurrency = 'USD';
    @Input({ required: true }) bufferPercentage = 15;
    @Input({ required: true }) isCalculating = false;
    @Input({ required: true }) selectedCountryComparison: CountryPriceComparison | null = null;

    @Input({ required: true }) t!: (key: string) => string;
    @Input({ required: true }) formatCurrency!: (amount: number) => string;
    @Input({ required: true }) getCountryLabel!: (country: CountryCostData) => string;
    @Input({ required: true }) getBarWidth!: (value: number, total: number) => string;
    @Input({ required: true }) openLink!: (url: string) => void;
    @Input({ required: true }) getCompareRankPercent!: (comparison: CountryPriceComparison | null) => number;
    @Input({ required: true }) getContinentLabel!: (continent: string) => string;
    @Input({ required: true }) getCountryCurrency!: (country: CountryCostData) => string;
    @Input({ required: true }) getCountrySafety!: (country: CountryCostData) => SafetyLevel;
    @Input({ required: true }) getCountryTourismDevelopment!: (country: CountryCostData) => TourismDevelopment;
    @Input({ required: true }) getSafetyLabel!: (level: SafetyLevel) => string;
    @Input({ required: true }) getTourismLabel!: (level: TourismDevelopment) => string;
    @Input({ required: true }) getPriceLevelLabel!: (country: CountryCostData) => string;
    @Input({ required: true }) getDerivedSeasonLabelForCountry!: (country: CountryCostData | null) => string;
    @Input() countryPhotoUrl: string = '';
    compareExpanded = false;
    private readonly brokenFlagCodes = new Set<string>();

    getFlagApiUrl(code: string): string {
        const normalized = code?.toLowerCase();
        if (!normalized || normalized.length !== 2) {
            return '';
        }
        return `https://flagcdn.com/24x18/${normalized}.png`;
    }

    markFlagBroken(code: string): void {
        if (!code || code.length !== 2) {
            return;
        }
        this.brokenFlagCodes.add(code.toUpperCase());
    }

    isFlagBroken(code: string): boolean {
        if (!code || code.length !== 2) {
            return true;
        }
        return this.brokenFlagCodes.has(code.toUpperCase());
    }

    getFallbackFlagEmoji(code: string): string {
        if (!code || code.length !== 2) return '';
        const upper = code.toUpperCase();
        return String.fromCodePoint(127397 + upper.charCodeAt(0), 127397 + upper.charCodeAt(1));
    }

    isExpensivePrice(comparison: CountryPriceComparison | null): boolean {
        if (!comparison || comparison.totalCountries <= 0) {
            return false;
        }
        const ratio = comparison.rank / comparison.totalCountries;
        return ratio > 0.66;
    }

    isMidPrice(comparison: CountryPriceComparison | null): boolean {
        if (!comparison || comparison.totalCountries <= 0) {
            return false;
        }
        const ratio = comparison.rank / comparison.totalCountries;
        return ratio > 0.33 && ratio <= 0.66;
    }

    getSeasonValue(country: CountryCostData | null): string {
        const label = this.getDerivedSeasonLabelForCountry(country);
        const normalized = label.toLowerCase();
        const isLowSeason = normalized.includes('low season') || normalized.includes('nebensaison');

        if (!isLowSeason) {
            return label;
        }

        return this.currentLanguage === 'de'
            ? `${label} (immer guenstiger)`
            : `${label} (always cheaper)`;
    }
}
