import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LanguageService, Language } from '../language.service';

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
        private cdr: ChangeDetectorRef
    ) { }

    ngOnInit(): void {
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
