import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LanguageService, Language } from '../../language.service';

@Component({
    selector: 'app-airline-sim',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './airlineSim.html',
    styleUrl: './airlineSim.scss',
})
export class AirlineSim implements OnInit {
    currentLanguage: Language = 'en';

    features = [
        {
            icon: '🏷️',
            titleEN: 'Fleet Tag Management',
            titleDE: 'Flotten-Tag-Verwaltung',
            descriptionEN: 'Create custom tags with colors to organize your aircraft fleet. Assign multiple tags to planes via drag & drop.',
            descriptionDE: 'Erstellen Sie benutzerdefinierte Tags mit Farben, um Ihre Flugzeugflotte zu organisieren. Weisen Sie mehreren Flugzeugen Tags per Drag & Drop zu.',
        },
        {
            icon: '📊',
            titleEN: 'Ranking Tracker',
            titleDE: 'Ranking-Tracker',
            descriptionEN: 'Track your airline\'s position in World, Continent, and Country rankings. View last update timestamps and ranking history.',
            descriptionDE: 'Verfolgen Sie die Position Ihrer Fluggesellschaft in Welt-, Kontinent- und Länderrankings. Zeigen Sie Zeitstempel der letzten Aktualisierung und Ranking-Historie an.',
        },
        {
            icon: '✈️',
            titleEN: 'Last Viewed Tracker',
            titleDE: 'Zuletzt angesehen-Tracker',
            descriptionEN: 'Automatically track when you last viewed each aircraft. Color-coded indicators show recency: green (<14 days), yellow (14-30 days), red (>30 days).',
            descriptionDE: 'Verfolgen Sie automatisch, wann Sie jedes Flugzeug zuletzt angesehen haben. Farbcodierte Indikatoren zeigen die Aktualität: grün (<14 Tage), gelb (14-30 Tage), rot (>30 Tage).',
        },
        {
            icon: '🔍',
            titleEN: 'Advanced Filtering',
            titleDE: 'Erweiterte Filterung',
            descriptionEN: 'Filter your fleet by assigned tags using checkboxes. Hide untagged aircraft to focus on specific fleet segments.',
            descriptionDE: 'Filtern Sie Ihre Flotte nach zugewiesenen Tags mithilfe von Kontrollkästchen. Blenden Sie nicht markierte Flugzeuge aus, um sich auf bestimmte Flottensegmente zu konzentrieren.',
        },
        {
            icon: '📈',
            titleEN: 'Load Factor Analysis',
            titleDE: 'Auslastungsanalyse',
            descriptionEN: 'Calculate average load factors for completed flights. Analyze flight performance and optimize pricing strategies.',
            descriptionDE: 'Berechnen Sie durchschnittliche Auslastungsfaktoren für abgeschlossene Flüge. Analysieren Sie die Flugleistung und optimieren Sie Preisstrategien.',
        },
        {
            icon: '💾',
            titleEN: 'LocalStorage Persistence',
            titleDE: 'LocalStorage-Persistenz',
            descriptionEN: 'All tags, assignments, and tracking data are saved locally per server. Your data persists across sessions.',
            descriptionDE: 'Alle Tags, Zuweisungen und Tracking-Daten werden lokal pro Server gespeichert. Ihre Daten bleiben über Sitzungen hinweg erhalten.',
        },
    ];

    techStack = [
        { name: 'JavaScript', icon: '🟨' },
        { name: 'Chrome Extension API', icon: '🔌' },
        { name: 'LocalStorage', icon: '💾' },
        { name: 'DOM Manipulation', icon: '🌐' },
        { name: 'Drag & Drop API', icon: '🖱️' },
    ];

    links = {
        github: 'https://github.com/WorldChris380/airlinesim-ceo-tools',
        chromeStore: '#',
        discord: 'https://discord.com/channels/113555701774749696/1249639537450160138',
    };

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
