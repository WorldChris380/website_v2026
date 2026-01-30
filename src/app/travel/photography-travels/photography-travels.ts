import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MetaService } from '../../services/meta.service';
import { LanguageService, Language } from '../../language.service';

@Component({
    selector: 'app-photography-travels',
    standalone: true,
    imports: [RouterModule, CommonModule, FormsModule],
    templateUrl: './photography-travels.html',
    styleUrl: './photography-travels.scss'
})
export class PhotographyTravels implements OnInit {
    protected readonly title = 'Photography Travels';
    formSubmitted = false;
    currentLanguage: Language = 'en';

    constructor(
        private metaService: MetaService,
        private languageService: LanguageService
    ) { }

    ngOnInit(): void {
        // Subscribe to language changes
        this.currentLanguage = this.languageService.getCurrentLanguage();
        this.languageService.language$.subscribe((lang) => {
            this.currentLanguage = lang;
        });

        this.metaService.updateSEO(
            {
                title: 'Photography Travels - World Travel Stories | Christian Böhme',
                description: 'Explore travel stories and photography journeys from around the world. Register interest for exclusive photography expeditions. Detailed travel guides and photography tips from visited destinations.',
                image: 'https://www.christian-boehme.com/assets/img/other/Dresden%20Skyline.jpg',
                url: 'https://www.christian-boehme.com/photography-travels',
                type: 'website'
            },
            {
                "@context": "https://schema.org",
                "@type": "TravelAction",
                "name": "Photography Travels",
                "description": "Travel photography and stories from around the world",
                "agent": {
                    "@type": "Person",
                    "name": "Christian Böhme",
                    "url": "https://www.christian-boehme.com"
                }
            }
        );
    }

    submitRegistration(): void {
        const form = document.querySelector('.registration-form') as HTMLFormElement;
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        const formData = new FormData(form);
        const data = {
            firstName: formData.get('firstName'),
            lastName: formData.get('lastName'),
            email: formData.get('email'),
            phone: formData.get('phone'),
            country: formData.get('country'),
            experience: formData.get('experience'),
            message: formData.get('message')
        };

        // Create mailto link with form data
        const mailtoBody = encodeURIComponent(
            `Photography Travel Expedition Interest - TBA\n\n` +
            `Name: ${data.firstName} ${data.lastName}\n` +
            `Email: ${data.email}\n` +
            `Phone: ${data.phone}\n` +
            `Country: ${data.country}\n` +
            `Experience Level: ${data.experience}\n\n` +
            `Message:\n${data.message}`
        );

        window.location.href = `mailto:travel@christian-boehme.com?subject=Photography%20Expedition%20Interest%20-%20TBA&body=${mailtoBody}`;

        // Show success message
        this.formSubmitted = true;
    }

    resetForm(): void {
        const form = document.querySelector('.registration-form') as HTMLFormElement;
        if (form) {
            form.reset();
        }
        this.formSubmitted = false;
    }
}
