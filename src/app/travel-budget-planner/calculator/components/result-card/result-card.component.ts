import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import type { BudgetResult, CountryCostData, CountryInsight, DisplayCurrency } from '../../calculator';
import type { Language } from '../../../../language.service';

@Component({
    selector: 'app-calc-result-card',
    standalone: true,
    imports: [CommonModule],
    styleUrl: './result-card.component.scss',
    template: `
<div class="calc-result-card" *ngIf="result && selectedCountry && !isCalculating">
    <h2 class="result-title">{{ t('calcResultTitle') }}</h2>
    <p class="result-destination">
        <ng-container *ngIf="selectedCountry" aria-hidden="true">
            <img *ngIf="!isFlagBroken(selectedCountry.code)" class="result-flag-image"
                [src]="getFlagApiUrl(selectedCountry.code)" [alt]="''" loading="lazy" decoding="async"
                (error)="markFlagBroken(selectedCountry.code)">
            <span *ngIf="isFlagBroken(selectedCountry.code)" class="result-flag-fallback">{{ getFallbackFlagEmoji(selectedCountry.code) }}</span>
        </ng-container>
        {{ getCountryLabel(selectedCountry) }} &middot;
        {{ duration }}&nbsp;{{ currentLanguage === 'de' ? 'Tage' : 'days' }} &middot;
        {{ persons }}&nbsp;{{ currentLanguage === 'de' ? 'Personen' : 'persons' }}
    </p>

    <div class="result-meta">
        <span class="result-chip">
            {{ t('calcOriginCountry') }}:
            <ng-container *ngIf="originCountry; else defaultOrigin" aria-hidden="true">
                <img *ngIf="!isFlagBroken(originCountry.code)" class="chip-flag-image"
                    [src]="getFlagApiUrl(originCountry.code)" [alt]="''" loading="lazy" decoding="async"
                    (error)="markFlagBroken(originCountry.code)">
                <span *ngIf="isFlagBroken(originCountry.code)" class="chip-flag-fallback">{{ getFallbackFlagEmoji(originCountry.code) }}</span>
            </ng-container>
            <ng-template #defaultOrigin>{{ currentLanguage === 'de' ? 'Europa' : 'Europe' }}</ng-template>
            <ng-container *ngIf="originCountry"> {{ getCountryLabel(originCountry) }}</ng-container>
        </span>
        <span class="result-chip">{{ t('calcDisplayCurrency') }}: {{ displayCurrency }}</span>
        <span class="result-chip">{{ t('calcBufferPercent') }}: {{ bufferPercentage }}%</span>
    </div>

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

    <div class="smart-insights">
        <div class="smart-card">
            <span class="smart-label">{{ t('calcLargestCostDriver') }}</span>
            <strong class="smart-value">{{ getLargestCostDriverLabel() }}</strong>
        </div>
        <div class="smart-card">
            <span class="smart-label">{{ t('calcCostLevel') }}</span>
            <strong class="smart-value">{{ getCostLevelLabel() }}</strong>
        </div>
        <div class="smart-card">
            <span class="smart-label">{{ t('calcLocalCurrency') }}</span>
            <strong class="smart-value">{{ currentInsight?.currency ?? 'USD' }}</strong>
        </div>
    </div>

    <div class="affiliate-section">
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

        <div class="newsletter-cta">
            <h4>{{ t('calcPriceAlertTitle') }}</h4>
            <p>{{ t('calcPriceAlertText') }}</p>
            <button class="btn-price-alert" (click)="openLink(selectedCountry.skyscannerUrl)">{{ t('calcPriceAlertButton') }}</button>
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

    @Input({ required: true }) t!: (key: string) => string;
    @Input({ required: true }) formatCurrency!: (amount: number) => string;
    @Input({ required: true }) getCountryLabel!: (country: CountryCostData) => string;
    @Input({ required: true }) getBarWidth!: (value: number, total: number) => string;
    @Input({ required: true }) openLink!: (url: string) => void;
    private readonly brokenFlagCodes = new Set<string>();

    getLargestCostDriverLabel(): string {
        if (!this.result) return '';

        const categories = [
            { label: this.t('calcAccom'), value: this.result.accommodation },
            { label: this.t('calcFood'), value: this.result.food },
            { label: this.t('calcTransport'), value: this.result.transport },
            { label: this.t('calcActivities'), value: this.result.activities },
            { label: this.t('calcFlight'), value: this.result.flight },
        ];

        return categories.sort((left, right) => right.value - left.value)[0]?.label ?? '';
    }

    getCostLevelLabel(): string {
        if (!this.result) return '';
        if (this.result.dailyPerPerson <= 60) return this.t('calcCostLevelValue');
        if (this.result.dailyPerPerson <= 180) return this.t('calcCostLevelBalanced');
        return this.t('calcCostLevelPremium');
    }

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
}
