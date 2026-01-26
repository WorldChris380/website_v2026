import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LanguageService, Language } from '../language.service';
import { MetaService } from '../services/meta.service';

@Component({
    selector: 'app-legal',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './legal.html',
    styleUrl: './legal.scss'
})
export class Legal implements OnInit {
    activeTab: 'impressum' | 'privacy' | 'terms' = 'impressum';
    currentLanguage: Language = 'en';

    constructor(
        private languageService: LanguageService,
        private cdr: ChangeDetectorRef,
        private metaService: MetaService
    ) { }

    ngOnInit(): void {
        // SEO Meta Tags
        this.metaService.updateSEO(
            {
                title: 'Legal - Impressum, Privacy Policy, Terms | Christian Böhme',
                description: 'Legal information including impressum, privacy policy and terms of service for christian-boehme.com',
                image: 'https://www.christian-boehme.com/assets/img/other/Dresden%20Skyline.jpg',
                url: 'https://www.christian-boehme.com/legal',
                type: 'website'
            }
        );

        this.currentLanguage = this.languageService.getCurrentLanguage();
        this.languageService.language$.subscribe((lang) => {
            this.currentLanguage = lang;
            this.cdr.markForCheck();
        });
    }

    getTranslation(key: string): string {
        return this.languageService.getTranslation(key);
    }

    switchTab(tab: 'impressum' | 'privacy' | 'terms'): void {
        this.activeTab = tab;
    }
}
