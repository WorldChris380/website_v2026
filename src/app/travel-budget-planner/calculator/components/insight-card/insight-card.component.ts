import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import type { CountryCostData, CountryInsight } from '../../calculator';
import type { Language } from '../../../../language.service';

@Component({
    selector: 'app-calc-insight-card',
    standalone: true,
    imports: [CommonModule],
    styleUrl: './insight-card.component.scss',
    template: `
<div class="insight-card" *ngIf="insight && country">
    <div class="insight-header">
        <span class="insight-flag" aria-hidden="true">
            <img *ngIf="!isFlagBroken(country.code)" class="insight-flag-image" [src]="getFlagApiUrl(country.code)" [alt]="''"
                loading="lazy" decoding="async" (error)="markFlagBroken(country.code)">
            <span *ngIf="isFlagBroken(country.code)">{{ getFallbackFlagEmoji(country.code) }}</span>
        </span>
        <h3>{{ getCountryLabel(country) }}</h3>
    </div>
    <div class="insight-grid">
        <div class="insight-item">
            <span class="insight-icon">&#128197;</span>
            <div>
                <span class="insight-label">{{ t('calcBestTime') }}</span>
                <span class="insight-value">{{ currentLanguage === 'de' ? insight.bestTimeDE : insight.bestTime }}</span>
            </div>
        </div>
        <div class="insight-item">
            <span class="insight-icon">&#128178;</span>
            <div>
                <span class="insight-label">{{ t('calcLocalCurrency') }}</span>
                <span class="insight-value">{{ insight.currency }}</span>
            </div>
        </div>
        <div class="insight-item insight-tip">
            <span class="insight-icon">&#128161;</span>
            <div>
                <span class="insight-label">{{ t('calcMoneySaving') }}</span>
                <span class="insight-value">{{ currentLanguage === 'de' ? insight.savingTipDE : insight.savingTip }}</span>
            </div>
        </div>
    </div>
</div>
`
})
export class InsightCardComponent {
    @Input({ required: true }) insight: CountryInsight | null = null;
    @Input({ required: true }) country: CountryCostData | null = null;
    @Input({ required: true }) currentLanguage: Language = 'en';
    @Input({ required: true }) t!: (key: string) => string;
    @Input({ required: true }) getCountryLabel!: (country: CountryCostData) => string;

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
}
