import { Component, Input } from '@angular/core';

@Component({
    selector: 'app-calc-faq-section',
    standalone: true,
    styleUrl: './faq-section.component.scss',
    template: `
<section class="faq-section">
    <div class="faq-inner">
        <h2 class="faq-title">{{ t('calcFaqTitle') }}</h2>
        <div class="faq-grid">
            <details class="faq-item">
                <summary class="faq-q">{{ t('calcFaq1Q') }}</summary>
                <p class="faq-a">{{ t('calcFaq1A') }}</p>
            </details>
            <details class="faq-item">
                <summary class="faq-q">{{ t('calcFaq2Q') }}</summary>
                <p class="faq-a">{{ t('calcFaq2A') }}</p>
            </details>
            <details class="faq-item">
                <summary class="faq-q">{{ t('calcFaq3Q') }}</summary>
                <p class="faq-a">{{ t('calcFaq3A') }}</p>
            </details>
            <details class="faq-item">
                <summary class="faq-q">{{ t('calcFaq4Q') }}</summary>
                <p class="faq-a">{{ t('calcFaq4A') }}</p>
            </details>
        </div>
    </div>
</section>
`
})
export class FaqSectionComponent {
    @Input({ required: true }) t!: (key: string) => string;
}
