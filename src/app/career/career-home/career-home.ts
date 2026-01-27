import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { LanguageService, Language } from '../../language.service';
import { MetaService } from '../../services/meta.service';

@Component({
    selector: 'app-career-home',
    standalone: true,
    imports: [CommonModule, RouterModule],
    templateUrl: './career-home.html',
    styleUrls: ['./career-home.scss'],
})
export class CareerHome implements OnInit {
    currentLanguage: Language = 'en';

    skills = [
        { name: 'Angular', level: 95, icon: '⚡' },
        { name: 'TypeScript', level: 92, icon: '📘' },
        { name: 'Python', level: 88, icon: '🐍' },
        { name: 'Cloud (AWS/Azure)', level: 85, icon: '☁️' },
        { name: 'Docker & Kubernetes', level: 82, icon: '🐳' },
        { name: 'SQL & NoSQL', level: 90, icon: '🗄️' }
    ];

    experiences = [
        {
            title: 'Senior Software Engineer',
            company: 'Tech Corporation',
            period: '2023 - Present',
            description: 'Leading development of enterprise-level Angular applications',
            icon: '💼'
        },
        {
            title: 'Full Stack Developer',
            company: 'Digital Agency',
            period: '2020 - 2023',
            description: 'Built scalable web applications using modern technologies',
            icon: '🚀'
        },
        {
            title: 'Software Developer',
            company: 'Startup Inc.',
            period: '2018 - 2020',
            description: 'Developed innovative solutions for client projects',
            icon: '💡'
        }
    ];

    achievements = [
        { value: '50+', label: 'Projects Completed', icon: '🎯' },
        { value: '8+', label: 'Years Experience', icon: '⏱️' },
        { value: '15+', label: 'Technologies', icon: '🛠️' },
        { value: '100%', label: 'Client Satisfaction', icon: '⭐' }
    ];

    constructor(
        private languageService: LanguageService,
        private metaService: MetaService
    ) { }

    ngOnInit() {
        // Language subscription
        this.languageService.language$.subscribe((lang) => {
            this.currentLanguage = lang;
        });

        // SEO Meta Tags
        this.metaService.updateSEO(
            {
                title: 'Career - Christian Böhme | Full Stack Developer & IT Professional',
                description: 'Explore the professional career of Christian Böhme - Senior Software Engineer with 8+ years of experience in Angular, TypeScript, Python, and Cloud technologies. View CV, skills, and achievements.',
                image: 'https://www.christian-boehme.com/assets/img/other/Sydney%20Skyline%20Black%20n%20orange.JPG',
                url: 'https://www.christian-boehme.com/career',
                type: 'profile'
            },
            {
                "@context": "https://schema.org",
                "@type": "ProfilePage",
                "mainEntity": {
                    "@type": "Person",
                    "name": "Christian Böhme",
                    "jobTitle": "Senior Software Engineer",
                    "url": "https://www.christian-boehme.com",
                    "sameAs": [
                        "https://www.linkedin.com/in/christian-boehme-business/",
                        "https://github.com/WorldChris380"
                    ],
                    "knowsAbout": ["Angular", "TypeScript", "Python", "Cloud Computing", "Docker", "Kubernetes"],
                    "alumniOf": {
                        "@type": "EducationalOrganization",
                        "name": "Technical University"
                    }
                }
            }
        );
    }

    getTranslation(key: string): string {
        const translations: { [key: string]: { en: string; de: string } } = {
            welcome: { en: 'Welcome to my', de: 'Willkommen zu meiner' },
            careerJourney: { en: 'Career Journey', de: 'Karriere-Reise' },
            about: { en: 'About Me', de: 'Über Mich' },
            aboutText: {
                en: 'Passionate Full Stack Developer with expertise in modern web technologies, cloud computing, and agile methodologies. I transform complex problems into elegant solutions.',
                de: 'Leidenschaftlicher Full Stack Entwickler mit Expertise in modernen Web-Technologien, Cloud Computing und agilen Methoden. Ich verwandle komplexe Probleme in elegante Lösungen.'
            },
            mySkills: { en: 'My Skills', de: 'Meine Fähigkeiten' },
            experience: { en: 'Experience', de: 'Erfahrung' },
            achievements: { en: 'Key Achievements', de: 'Erfolge' },
            viewFullCV: { en: 'View Full CV', de: 'Vollständiger CV' },
            downloadCV: { en: 'Download CV', de: 'CV Herunterladen' },
            contactMe: { en: 'Contact Me', de: 'Kontaktiere Mich' }
        };
        return translations[key]?.[this.currentLanguage] || key;
    }
}
