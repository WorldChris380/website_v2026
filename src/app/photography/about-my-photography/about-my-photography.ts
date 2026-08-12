import { Component, OnInit, OnDestroy } from '@angular/core';

import { Counters } from './counters/counters';
import { Language, LanguageService } from '../../language.service';
import { DarkModeService } from '../../dark-mode.service';
import { MetaService } from '../../services/meta.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

interface CameraEquipment {
    name: string;
    model: string;
    specs: string[];
}

interface FormerCamera {
    name: string;
    period: string;
    notes: string[];
}

@Component({
    selector: 'app-about-my-photography',
    standalone: true,
    imports: [Counters],
    templateUrl: './about-my-photography.html',
    styleUrls: ['./about-my-photography.scss']
})
export class AboutMyPhotography implements OnInit, OnDestroy {
    currentLanguage: Language = 'en';
    darkmode: boolean = false;
    private destroy$ = new Subject<void>();

    camera: CameraEquipment = {
        name: 'Nikon Z50 II',
        model: 'Mirrorless APS-C',
        specs: [
            '20.9 MP CMOS Sensor',
            '4K 30fps Video',
            'Hybrid AF with 209 Focus Points',
            'ISO 100-51200 (Expandable)',
            '2340k Dot OLED Viewfinder'
        ]
    };

    lens: CameraEquipment = {
        name: 'Tamron 18-300mm f/3.5-6.3',
        model: 'Ultra-zoom Lens',
        specs: [
            '16.7x Zoom Ratio',
            'All-in-One Travel Lens',
            'VC (Vibration Compensation)',
            'USD Motor for Silent AF',
            'Perfect for Aviation & Travel'
        ]
    };

    formerCameras: FormerCamera[] = [
        {
            name: 'Nikon D7000',
            period: 'bis 2017',
            notes: [
                '16.2 MP APS-C DSLR',
                '39-point autofocus system',
                'Weather-sealed magnesium-alloy body'
            ]
        },
        {
            name: 'Nikon D7100',
            period: 'bis 2025',
            notes: [
                '24.1 MP APS-C DSLR without optical low-pass filter',
                'Nikon AF-S Nikkor DX 18-105 mm/3,5-5,6 G ED VR',
                'Advanced autofocus and travel-ready allround setup'
            ]
        }
    ];

    constructor(
        private languageService: LanguageService,
        private darkModeService: DarkModeService,
        private metaService: MetaService
    ) { }

    ngOnInit(): void {
        // Subscribe to language changes
        this.currentLanguage = this.languageService.getCurrentLanguage();
        this.languageService.language$
            .pipe(takeUntil(this.destroy$))
            .subscribe((lang) => {
                this.currentLanguage = lang;
                this.updateSEO();
            });

        // Subscribe to dark mode changes
        this.darkmode = this.darkModeService.isDarkMode();
        this.darkModeService.darkmode$
            .pipe(takeUntil(this.destroy$))
            .subscribe((isDark) => {
                this.darkmode = isDark;
            });

        // Initialize SEO
        this.updateSEO();
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    private updateSEO(): void {
        const isDE = this.currentLanguage === 'de';

        const title = isDE
            ? 'Über meine Fotografie - Kamera & Ausrüstung | Christian Böhme'
            : 'About My Photography - Camera Equipment | Christian Böhme';

        const description = isDE
            ? 'Entdecke meine Fotografie-Ausrüstung: Nikon Z50 II mit Tamron 18-300mm Objektiv. Perfekt für Luftfahrt- und Reisefotografie.'
            : 'Explore my photography equipment: Nikon Z50 II with Tamron 18-300mm lens. Perfect for aviation and travel photography.';

        const keywords = isDE
            ? 'Nikon Z50 II, Tamron 18-300mm, Fotografie Ausrüstung, Luftfahrtfotografie, Reisefotografie'
            : 'Nikon Z50 II, Tamron 18-300mm, photography equipment, aviation photography, travel photography';

        // Set structured data
        const structuredData = {
            "@context": "https://schema.org",
            "@type": "Article",
            "headline": title,
            "description": description,
            "image": "https://www.christian-boehme.com/assets/img/photography/equipment-social.jpg",
            "author": {
                "@type": "Person",
                "name": "Christian Böhme",
                "url": "https://www.christian-boehme.com"
            },
            "publisher": {
                "@type": "Organization",
                "name": "Christian Böhme",
                "url": "https://www.christian-boehme.com"
            },
            "mainEntity": {
                "@type": "Thing",
                "name": isDE ? "Fotografie-Ausrüstung von Christian Böhme" : "Christian Böhme's Photography Equipment",
                "description": description
            },
            "mentions": [
                {
                    "@type": "Thing",
                    "name": "Nikon Z50 II",
                    "brand": "Nikon",
                    "category": "Mirrorless Camera"
                },
                {
                    "@type": "Thing",
                    "name": "Tamron 18-300mm f/3.5-6.3",
                    "brand": "Tamron",
                    "category": "Lens"
                }
            ]
        };

        // Update all SEO elements at once
        this.metaService.updateSEO(
            {
                title,
                description,
                keywords,
                image: 'https://www.christian-boehme.com/assets/img/photography/equipment-social.jpg',
                url: 'https://www.christian-boehme.com/about-my-photography',
                type: 'website'
            },
            structuredData
        );
    }

    getTranslation(key: string): string {
        const translations: { [key: string]: { en: string; de: string } } = {
            'aboutPhotography': { en: 'About My Photography', de: 'Über meine Fotografie' },
            'myEquipment': { en: 'My Equipment', de: 'Meine Ausrüstung' },
            'camera': { en: 'Camera', de: 'Kamera' },
            'lens': { en: 'Lens', de: 'Objektiv' },
            'features': { en: 'Key Features', de: 'Hauptmerkmale' }
            , 'formerCameras': { en: 'Former Cameras', de: 'Frühere Kameras' }
            , 'formerCameraPeriod': { en: 'Former Camera', de: 'Frühere Kamera' }
        };

        return translations[key]?.[this.currentLanguage] || key;
    }
}
