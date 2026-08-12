import { Component, OnInit } from '@angular/core';

import { LanguageService, Language } from '../../language.service';
import { MetaService } from '../../services/meta.service';
import { FaqSectionComponent } from '../../travel-budget-planner/calculator/components/faq-section/faq-section.component';

@Component({
    selector: 'app-travel-faqs',
    standalone: true,
    imports: [FaqSectionComponent],
    templateUrl: './travel-faqs.html',
    styleUrl: './travel-faqs.scss'
})
export class TravelFaqs implements OnInit {
    currentLanguage: Language = 'en';
    readonly tFn = (key: string) => this.languageService.getTranslation(key);

    constructor(
        private languageService: LanguageService,
        private metaService: MetaService,
    ) { }

    ngOnInit(): void {
        this.currentLanguage = this.languageService.getCurrentLanguage();
        this.languageService.language$.subscribe(lang => {
            this.currentLanguage = lang;
        });

        const title = this.currentLanguage === 'de'
            ? 'Travel FAQs | Christian Boehme'
            : 'Travel FAQs | Christian Boehme';
        const description = this.currentLanguage === 'de'
            ? 'Antworten auf die wichtigsten Fragen zur Reisebudgetplanung, Datengrundlage, Saisonalitaet und Flugkostenmodell.'
            : 'Answers to the most important questions about trip budget planning, data sources, seasonality, and flight estimation model.';

        this.metaService.updateSEO(
            {
                title,
                description,
                url: 'https://www.christian-boehme.com/travel-faqs',
                type: 'website'
            }
        );
    }
}
