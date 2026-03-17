import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
    selector: 'app-calc-hero-presets',
    standalone: true,
    imports: [CommonModule],
    styleUrl: './hero-presets.component.scss',
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
