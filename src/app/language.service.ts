import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type Language = 'en' | 'de';

@Injectable({
    providedIn: 'root'
})
export class LanguageService {
    private currentLanguage: Language = 'en';
    public language$ = new BehaviorSubject<Language>('en');

    constructor() {
        const savedLanguage = localStorage.getItem('language') as Language | null;
        if (savedLanguage) {
            this.currentLanguage = savedLanguage;
            this.language$.next(this.currentLanguage);
        }
    }

    getCurrentLanguage(): Language {
        return this.currentLanguage;
    }

    toggleLanguage(): void {
        this.currentLanguage = this.currentLanguage === 'en' ? 'de' : 'en';
        localStorage.setItem('language', this.currentLanguage);
        this.language$.next(this.currentLanguage);
    }

    setLanguage(language: Language): void {
        this.currentLanguage = language;
        localStorage.setItem('language', this.currentLanguage);
        this.language$.next(this.currentLanguage);
    }

    getTranslation(key: string): string {
        return this.translations[this.currentLanguage][key] || key;
    }

    private translations: Record<Language, Record<string, string>> = {
        en: {
            // Header Navigation
            'aviation': 'Aviation',
            'travel': 'Travel',
            'photography': 'Photography',
            'myCareer': 'My Career',
            'buyPhotos': 'Buy my photos on adobe stock',
            'aviationGallery': 'Aviation Gallery',
            'aviationSpotterHotels': 'Aviation Spotter Hotels',
            'msfsComparison': 'MSFS Career Addons Comparison',
            'travelGallery': 'Travel Gallery',
            'photographyTravels': 'Photography Travels',
            'myVisitedCountries': 'My Visited Countries',
            'profile': 'Profile',
            'experience': 'Experience',
            'education': 'Education',
            'skills': 'Skills',
            'projects': 'Projects',
            'testimonials': 'Testimonials',

            // Career Page
            'downloadPDF': 'Download PDF',
            'viewCV': 'View CV',
            'skillsCertifications': 'Skills & Certifications',
            'about': 'About',
            'location': 'Location',
            'email': 'Email',
            'website': 'Website',
            'experiences': 'Experience',
            'educations': 'Education',
            'certifications': 'Certifications',
            'languages': 'Languages',
            'skillsList': 'Skills',
            'projectsList': 'Projects',
            'testimonialsList': 'Testimonials',
            'native': 'Native',
            'fluent': 'Fluent',
            'technologies': 'Technologies',
            'duration': 'Duration',
            'process': 'Process',

            // Footer
            'legal': 'Legal',
            'privacyPolicy': 'Privacy Policy',
            'copyright': 'All rights reserved',

            // Legal Page
            'impressum': 'Impressum',
            'termsOfService': 'Terms of Service',
            'legalInformation': 'Legal Information',
            'impressumDescription': 'Impressum, Privacy Policy & Terms of Service',

            // Home Page
            'myCareerPage': 'My career',
            'github': 'GitHub',
            'linkedin': 'LinkedIn',
            'toggleLanguage': 'Toggle Language',

            // Gallery
            'gallery': 'Gallery',
            'filter': 'Filter',
            'allPhotos': 'All Photos',
            'category': 'Category',
            'continent': 'Continent',
            'country': 'Country',
            'search': 'Search',
            'searchPlaceholder': 'Search by country, location, or keyword...',
            'page': 'Page',
            'of': 'of',
            'close': 'Close',
            'all': 'All',

            // Common
            'home': 'Home',
            'back': 'Back',
            'next': 'Next',
            'previous': 'Previous',
        },
        de: {
            // Header Navigation
            'aviation': 'Luftfahrt',
            'travel': 'Reisen',
            'photography': 'Fotografie',
            'myCareer': 'Mein CV',
            'buyPhotos': 'Meine Fotos auf Adobe Stock kaufen',
            'aviationGallery': 'Luftfahrt Galerie',
            'aviationSpotterHotels': 'Aviation Spotter Hotels',
            'msfsComparison': 'MSFS Career Addons Vergleich',
            'travelGallery': 'Reise Galerie',
            'photographyTravels': 'Fotografie Reisen',
            'myVisitedCountries': 'Meine besuchten Länder',
            'profile': 'Profil',
            'experience': 'Erfahrung',
            'education': 'Ausbildung',
            'skills': 'Fähigkeiten',
            'projects': 'Projekte',
            'testimonials': 'Testimonials',

            // Career Page
            'downloadPDF': 'PDF Herunterladen',
            'viewCV': 'CV anzeigen',
            'skillsCertifications': 'Fähigkeiten & Zertifizierungen',
            'about': 'Über mich',
            'location': 'Standort',
            'email': 'E-Mail',
            'website': 'Webseite',
            'experiences': 'Erfahrung',
            'educations': 'Ausbildung',
            'certifications': 'Zertifizierungen',
            'languages': 'Sprachen',
            'skillsList': 'Fähigkeiten',
            'projectsList': 'Projekte',
            'testimonialsList': 'Testimonials',
            'native': 'Muttersprache',
            'fluent': 'Fließend',
            'technologies': 'Technologien',
            'duration': 'Dauer',
            'process': 'Vorgehensweise',

            // Footer
            'legal': 'Rechtliches',
            'privacyPolicy': 'Datenschutz',
            'copyright': 'Alle Rechte vorbehalten',

            // Legal Page
            'impressum': 'Impressum',
            'termsOfService': 'Nutzungsbedingungen',
            'legalInformation': 'Rechtliche Informationen',
            'impressumDescription': 'Impressum, Datenschutz & Nutzungsbedingungen',

            // Home Page
            'myCareerPage': 'Meine Karriere',
            'github': 'GitHub',
            'linkedin': 'LinkedIn',
            'toggleLanguage': 'Sprache wechseln',

            // Gallery
            'gallery': 'Galerie',
            'filter': 'Filter',
            'allPhotos': 'Alle Fotos',
            'category': 'Kategorie',
            'continent': 'Kontinent',
            'country': 'Land',
            'search': 'Suchen',
            'searchPlaceholder': 'Suche nach Land, Ort oder Stichwort...',
            'page': 'Seite',
            'of': 'von',
            'close': 'Schließen',
            'all': 'Alle',

            // Common
            'home': 'Startseite',
            'back': 'Zurück',
            'next': 'Weiter',
            'previous': 'Zurück',
        }
    };
}
