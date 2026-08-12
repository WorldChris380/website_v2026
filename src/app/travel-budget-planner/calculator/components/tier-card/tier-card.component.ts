
import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import type { DisplayCurrency } from '../../calculator';

@Component({
    selector: 'app-calc-tier-card',
    standalone: true,
    imports: [],
    styleUrl: './tier-card.component.scss',
    changeDetection: ChangeDetectionStrategy.Eager,
    template: `
@if (tierData) {
  <div class="tier-card">
    <h3 class="tier-title">{{ t('calcTierTitle') }}</h3>
    <p class="tier-subtitle">{{ t('calcTierSubtitle') }} &middot; {{ displayCurrency }}</p>
    <div class="tier-rows">
      <div class="tier-row" [class.active-tier]="travelStyle === 'budget' && accommodationType === 'budget'">
        <div class="tier-label">
          <span class="tier-icon">&#127992;</span>
          <span>{{ t('calcCompareBudget') }}</span>
        </div>
        <div class="tier-bar-wrap">
          <div class="tier-bar" [style.width]="getTierBarWidth(tierData.budget, tierData.luxury)"></div>
        </div>
        <span class="tier-amount">{{ formatCurrency(tierData.budget) }}</span>
      </div>
      <div class="tier-row" [class.active-tier]="travelStyle === 'midrange' && accommodationType === 'midrange'">
        <div class="tier-label">
          <span class="tier-icon">&#129523;</span>
          <span>{{ t('calcCompareMidrange') }}</span>
        </div>
        <div class="tier-bar-wrap">
          <div class="tier-bar mid" [style.width]="getTierBarWidth(tierData.midrange, tierData.luxury)"></div>
        </div>
        <span class="tier-amount">{{ formatCurrency(tierData.midrange) }}</span>
      </div>
      <div class="tier-row" [class.active-tier]="travelStyle === 'luxury' && accommodationType === 'luxury'">
        <div class="tier-label">
          <span class="tier-icon">&#128142;</span>
          <span>{{ t('calcCompareLuxury') }}</span>
        </div>
        <div class="tier-bar-wrap">
          <div class="tier-bar lux" style="width: 100%"></div>
        </div>
        <span class="tier-amount">{{ formatCurrency(tierData.luxury) }}</span>
      </div>
    </div>
  </div>
}
`
})
export class TierCardComponent {
    @Input({ required: true }) tierData: { budget: number; midrange: number; luxury: number } | null = null;
    @Input({ required: true }) travelStyle: 'budget' | 'midrange' | 'luxury' = 'midrange';
    @Input({ required: true }) accommodationType: 'budget' | 'midrange' | 'luxury' = 'midrange';
    @Input({ required: true }) displayCurrency: DisplayCurrency = 'USD';
    @Input({ required: true }) formatCurrency!: (amount: number) => string;
    @Input({ required: true }) t!: (key: string) => string;
    @Input({ required: true }) getTierBarWidth!: (value: number, max: number) => string;
}
