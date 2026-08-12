
import { Component, Input, ChangeDetectionStrategy } from '@angular/core';

@Component({
    selector: 'app-calc-hero-presets',
    standalone: true,
    imports: [],
    styleUrl: './hero-presets.component.scss',
    changeDetection: ChangeDetectionStrategy.Eager,
    template: `
<section class="hero-section">
    <div class="hero-content">
        <h1>{{ t('budgetCalculator') }}</h1>
        <p class="hero-subtitle">{{ t('calcSubtitle') }}</p>
    </div>
</section>

`
})
export class HeroPresetsComponent {
    @Input({ required: true }) t!: (key: string) => string;
}
