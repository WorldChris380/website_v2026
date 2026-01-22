import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LanguageService, Language } from '../../language.service';

@Component({
    selector: 'app-air-germany',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './airGermany.html',
    styleUrl: './airGermany.scss',
})
export class AirGermany implements OnInit {
    currentLanguage: Language = 'en';

    fleetHighlights = [
        {
            model: 'Airbus A380',
            count: 2,
            icon: '✈️',
            descriptionEN: 'Double-deck wide-body aircraft for premium routes',
            descriptionDE: 'Doppeldeckiger Großraumliner für Premium-Strecken',
        },
        {
            model: 'Airbus A350',
            count: 8,
            icon: '🛫',
            descriptionEN: 'Long-range wide-body for intercontinental flights',
            descriptionDE: 'Großraumliner für interkontinentale Flüge',
        },
        {
            model: 'Airbus A320',
            count: 15,
            icon: '✈️',
            descriptionEN: 'Most popular narrow-body for short-haul routes',
            descriptionDE: 'Beliebtester Schmalrumpfler für Kurzstrecken',
        },
        {
            model: 'Airbus A220',
            count: 6,
            icon: '🛩️',
            descriptionEN: 'Modern regional jet for European routes',
            descriptionDE: 'Moderner Regionaljet für europäische Strecken',
        },
    ];

    routes = [
        { city: 'Berlin', country: 'Germany', type: 'Hub', icon: '🏢' },
        { city: 'Frankfurt', country: 'Germany', type: 'Secondary Hub', icon: '✈️' },
        { city: 'Munich', country: 'Germany', type: 'Gateway', icon: '🏔️' },
        { city: 'London', country: 'UK', type: 'Regional', icon: '🇬🇧' },
        { city: 'Paris', country: 'France', type: 'Regional', icon: '🇫🇷' },
        { city: 'Amsterdam', country: 'Netherlands', type: 'Regional', icon: '🚲' },
    ];

    constructor(private languageService: LanguageService) { }

    ngOnInit() {
        this.currentLanguage = this.languageService.getCurrentLanguage();
        this.languageService.language$.subscribe((lang) => {
            this.currentLanguage = lang;
        });
    }

    getTranslation(key: string): string {
        return this.languageService.getTranslation(key);
    }
}
