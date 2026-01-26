import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { LanguageService, Language } from '../../language.service';
import { MetaService } from '../../services/meta.service';

@Component({
    selector: 'app-career',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './career.html',
    styleUrl: './career.scss'
})
export class Career implements OnInit {
    activeSection: string | null = 'profile';
    currentLanguage: Language = 'en';

    constructor(
        private route: ActivatedRoute,
        private languageService: LanguageService,
        private cdr: ChangeDetectorRef,
        private metaService: MetaService
    ) { }

    ngOnInit() {
        // SEO Meta Tags
        this.metaService.updateSEO(
            {
                title: 'Christian Böhme - Career & CV | IT Support, Project Manager, Frontend Developer',
                description: 'Professional career profile of Christian Böhme: IT Support, Project Manager and Frontend Developer with expertise in automation, E-Government solutions, and web development.',
                image: 'https://www.christian-boehme.com/assets/img/other/Christian%20Boehme%20profile%20picture%20for%20web.jpg',
                url: 'https://www.christian-boehme.com/career',
                type: 'profile'
            },
            {
                "@context": "https://schema.org",
                "@type": "Person",
                "name": "Christian Böhme",
                "jobTitle": "IT Support | Project Manager | Frontend Developer",
                "email": "career@christian-boehme.com",
                "url": "https://www.christian-boehme.com",
                "image": "https://www.christian-boehme.com/assets/img/other/Christian%20Boehme%20profile%20picture%20for%20web.jpg",
                "sameAs": [
                    "https://www.linkedin.com/in/christian-boehme",
                    "https://github.com/WorldChris380"
                ],
                "knowsAbout": ["IT Support", "Project Management", "Frontend Development", "Angular", "TypeScript", "Automation"]
            }
        );

        this.currentLanguage = this.languageService.getCurrentLanguage();
        this.languageService.language$.subscribe((lang) => {
            this.currentLanguage = lang;
            this.cdr.markForCheck();
        });

        this.route.fragment.subscribe((fragment) => {
            if (fragment) {
                this.activeSection = fragment;
                setTimeout(() => {
                    const element = document.getElementById(fragment);
                    if (element) {
                        element.scrollIntoView({ behavior: 'smooth' });
                    }
                }, 100);
            }
        });
    }

    getTranslation(key: string): string {
        return this.languageService.getTranslation(key);
    }

    profileDE = {
        name: 'Christian Böhme',
        title: 'IT-Support | Projektmanager | Frontend-Entwickler',
        about: 'Vielseitiger Fachmann mit langjähriger Erfahrung in IT-Support, Projektmanagement und Frontend-Entwicklung. Leidenschaftlich beim Automatisieren von Workflows, Optimieren von Systemen und beim Erstellen benutzerfreundlicher Webanwendungen. Erfahrung in Software-Rollouts, E-Government-Lösungen und digitalem Produktmanagement.',
        email: 'career@christian-boehme.com',
        location: 'Deutschland',
        website: 'www.christian-boehme.com',
    };

    profile = {
        name: 'Christian Böhme',
        title: 'IT Support | Project Manager | Frontend Developer',
        about: 'Versatile professional with a robust background in IT Support, Project Management, and Frontend Development. Passionate about automating workflows, optimizing systems, and building user-friendly web applications. Experienced in software roll-outs, E-Government solutions, and digital product management.',
        email: 'career@christian-boehme.com',
        location: 'Germany',
        website: 'www.christian-boehme.com',
    };

    getProfile() {
        return this.currentLanguage === 'de' ? this.profileDE : this.profile;
    }

    experiences = [
        {
            role: 'IT Support',
            company: 'TELEPORT-Gruppe',
            period: 'Oct 2025 - Present',
            description: 'Providing comprehensive IT support and consulting for E-Government solutions. Managing user administration, help-desk operations, and the roll-out of standard software solutions. Involved in project management and the conception of new software strategies.'
        },
        {
            role: 'Project Manager',
            company: 'SZ-Reisen & Service GmbH',
            period: 'Feb 2023 - Nov 2024',
            description: 'Served as Product Owner for the in-house PIM System (Voyager). Developed a custom Chrome extension using JavaScript to automate Adobe Stock licensing. Managed the production of printed catalogues and E-Papers.'
        },
        {
            role: 'Travel Sales Manager',
            company: 'CHECK24 Travel',
            period: '2020',
            description: 'Consulted private clients on vacation planning and purchasing. Utilized extensive knowledge of airline routes and travel logistics to ensure optimal customer experiences.'
        },
        {
            role: 'Sales Manager',
            company: 'Caroobi',
            period: '2018 - 2019',
            description: 'Managed sales operations for automobile repairs. Responsible for the analysis, compliance, and implementation of key economic indicators.'
        },
        {
            role: 'Customer Retention Representative',
            company: 'ITS Management',
            period: '2016 - 2017',
            description: 'Handled customer retention strategies in Sydney, Australia. Gained international experience in sales and marketing environments.'
        },
        {
            role: 'Sales and Marketing Manager (Apprenticeship)',
            company: 'Schulfahrt Touristik SFT GmbH',
            period: '2012 - 2015',
            description: 'Covered all aspects of marketing (Social, Offline, Online, SEO). Built and optimized a website for a travel office, achieving top local SEO rankings. Managed databases and office administration.'
        }
    ];

    education = [
        {
            degree: 'Certificate, Frontend Web Developer',
            school: 'Developer Akademie',
            year: 'Nov 2024 - Jun 2025',
            description: 'Intensive training in modern web technologies. Focus on Object-Oriented Programming (OOP) and Frontend Development to build and run self-coded webpages.'
        },
        {
            degree: 'Apprenticeship, Office Administration Clerk',
            school: 'BSZ für Technik und Wirtschaft Pirna',
            year: '2012 - 2015',
            description: 'Diploma Grade. Received an award for photography (London City Airport). Participated in a student exchange with Belarus.'
        }
    ];

    certifications = [
        'IBM Getting Started with Git and GitHub',
        'IBM Introduction to Cloud Computing',
        'IBM Introduction to Web Development with HTML, CSS, JavaScript',
        'Adobe InDesign CC (medienreich Training)',
        'JavaScript & TypeScript (Mimo)',
        'Aligning Sales and Marketing (LinkedIn)',
        'Marketing Analytics: KPIs (LinkedIn)'
    ];

    skills = [
        'Angular', 'TypeScript', 'JavaScript', 'HTML5 & CSS3', 'SCSS',
        'Git & GitHub', 'Project Management', 'IT Support', 'E-Government',
        'SEO', 'Adobe InDesign', 'Sales', 'Customer Service', 'Firebase',
        'REST API', 'Material Design', 'Scrum'
    ];

    languages = [
        { name: 'German', level: 'Native' },
        { name: 'English', level: 'Fluent' }
    ];

    projects = [
        {
            name: 'Join',
            description: 'Task manager inspired by the Kanban system. Create and organize tasks with drag-and-drop functionality, assign users and categories. Also includes contact creation and management.',
            technologies: 'Firebase, JavaScript, HTML, CSS, Figma',
            duration: '3 months',
            liveUrl: 'https://join.christian-boehme.com/',
            githubUrl: 'https://github.com/WorldChris380/Join',
            workProcess: 'After thorough planning with my teammates, we defined focus areas. Everyone took on their biggest challenge. I chose to handle the implementation and management of contacts.',
            teamExperience: 'We implemented the project together in a group of three people. Regular online meetings not only helped us inform each other about progress, but also supported us with challenges. This allowed us to complete the project efficiently.'
        },
        {
            name: 'El Pollo Loco',
            description: 'El Pollo Loco, which translates to "The Crazy Chicken", is a 2D browser game created using the HTML5 Canvas API. It is a game where I could apply advanced JavaScript skills.',
            technologies: 'JavaScript, HTML, CSS',
            duration: '2 weeks',
            liveUrl: 'https://el-pollo-loco.christian-boehme.com/',
            githubUrl: 'https://github.com/WorldChris380/El-Pollo-Loco',
            workProcess: 'The biggest challenge was to calculate the behavior of the characters using mathematical and physical formulas, optimizing them to ensure a visually realistic simulation.',
            teamExperience: 'Solo project focusing on game development fundamentals, physics calculations, and canvas animation techniques.'
        },
        {
            name: 'AirlineSim CEO Tools',
            description: 'This Chrome browser extension, available for download via GitHub, is designed for the realistic online simulation game AirlineSim. It enhances the user experience by offering additional tools and features that streamline airline fleet management. Key functionalities include the ability to organize the fleet using customizable and assignable tags. Additionally, the extension provides a summarized overview of complex in-game statistics, helping players better understand their current rankings.',
            technologies: 'JavaScript, HTML, CSS',
            duration: '2 years',
            liveUrl: '',
            githubUrl: 'https://github.com/WorldChris380/AirlineSim-CEO-Tools',
            workProcess: 'At present, AirlineSim does not provide an API, so I had to extract the data from the game. This is done through multiple web scraping functions that retrieve data from the game\'s website and display it in the extension.',
            teamExperience: 'Solo project. One of the next steps will likely be to rewrite it with React and TypeScript to improve the maintainability and scalability of the codebase. Afterwards, the extension will be enhanced and published to the Chrome Web Store.'
        },
        {
            name: 'Pokedex',
            description: 'An interactive Pokédex application that retrieves data from the PokéAPI. Users can search, filter, and view detailed information about each Pokémon.',
            technologies: 'JavaScript, HTML, CSS, REST API',
            duration: '2 months',
            liveUrl: '',
            githubUrl: '',
            workProcess: 'Focus on clean API integration and responsive design. Implementation of search functions, filter options, and an intuitive user interface.',
            teamExperience: 'Solo project where I independently handled all aspects from planning to implementation.'
        }
    ];

    testimonials = [
        {
            name: 'Valentino Strebel',
            project: 'Kochwelt',
            quote: 'Christian quickly familiarized himself with JavaScript concepts and was a driving force in successfully implementing our first team project. His clear communication and respectful manner made him a valued team member.',
            link: 'https://www.strebel-company.de/home',
            linkText: 'Website'
        },
        {
            name: 'Ronny Pollmer',
            project: 'Join',
            quote: 'Particularly noteworthy is the consistently reliable support – you were always available for questions and actively helped solve complex problems for others.',
            link: 'https://www.linkedin.com/in/ronny-pollmer-1b7886334/',
            linkText: 'LinkedIn'
        },
        {
            name: 'Florian Förster',
            project: 'Kochwelt',
            quote: 'I had the pleasure of working with Christian on our code – a collaboration that was not only effective but also truly motivating. His structured approach, expertise, and passion for programming enriched every shared working session.',
            link: '',
            linkText: ''
        }
    ];

    toggleSection(section: string): void {
        this.activeSection = this.activeSection === section ? null : section;
    }

    public async downloadPDF(): Promise<void> {
        // Create a temporary container with all content
        const tempContainer = document.createElement('div');
        tempContainer.style.position = 'absolute';
        tempContainer.style.left = '-9999px';
        tempContainer.style.top = '-9999px';
        tempContainer.style.width = '1200px';
        tempContainer.style.backgroundColor = 'white';
        tempContainer.style.color = '#333';
        tempContainer.style.padding = '40px';
        tempContainer.style.fontFamily = 'Quicksand, sans-serif';
        tempContainer.style.lineHeight = '1.6';

        // Build complete CV HTML
        let cvHTML = `
            <div style="padding-bottom: 30px; border-bottom: 3px solid #4a90e2; margin-bottom: 40px;">
                <h1 style="margin: 0; font-size: 36px; color: #333; margin-bottom: 5px;">${this.profile.name}</h1>
                <h2 style="margin: 0 0 15px 0; font-size: 18px; color: #4a90e2; font-weight: 600;">${this.profile.title}</h2>
                <p style="margin: 0 0 15px 0; color: #666; font-size: 14px;">${this.profile.about}</p>
                <div style="display: flex; gap: 20px; flex-wrap: wrap; font-size: 13px;">
                    <span>📍 ${this.profile.location}</span>
                    <span>📧 ${this.profile.email}</span>
                    <span>🌐 ${this.profile.website}</span>
                </div>
            </div>
        `;

        // Experience
        cvHTML += `<div style="margin-bottom: 40px;">
            <h3 style="font-size: 20px; color: #333; border-bottom: 2px solid #4a90e2; padding-bottom: 10px; margin-bottom: 20px;">Experience</h3>
        `;
        this.experiences.forEach(exp => {
            cvHTML += `
                <div style="margin-bottom: 20px;">
                    <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 5px;">
                        <h4 style="margin: 0; font-size: 15px; color: #333; font-weight: 700;">${exp.role}</h4>
                        <span style="font-size: 13px; color: #999;">${exp.period}</span>
                    </div>
                    <p style="margin: 5px 0; font-size: 14px; color: #4a90e2; font-weight: 600;">${exp.company}</p>
                    <p style="margin: 5px 0; font-size: 13px; color: #666;">${exp.description}</p>
                </div>
            `;
        });
        cvHTML += `</div>`;

        // Education
        cvHTML += `<div style="margin-bottom: 40px;">
            <h3 style="font-size: 20px; color: #333; border-bottom: 2px solid #4a90e2; padding-bottom: 10px; margin-bottom: 20px;">Education</h3>
        `;
        this.education.forEach(edu => {
            cvHTML += `
                <div style="margin-bottom: 20px;">
                    <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 5px;">
                        <h4 style="margin: 0; font-size: 15px; color: #333; font-weight: 700;">${edu.degree}</h4>
                        <span style="font-size: 13px; color: #999;">${edu.year}</span>
                    </div>
                    <p style="margin: 5px 0; font-size: 14px; color: #4a90e2; font-weight: 600;">${edu.school}</p>
                    <p style="margin: 5px 0; font-size: 13px; color: #666;">${edu.description}</p>
                </div>
            `;
        });
        cvHTML += `</div>`;

        // Certifications
        cvHTML += `<div style="margin-bottom: 40px;">
            <h3 style="font-size: 20px; color: #333; border-bottom: 2px solid #4a90e2; padding-bottom: 10px; margin-bottom: 20px;">Certifications</h3>
            <div style="display: flex; flex-wrap: wrap; gap: 10px;">
        `;
        this.certifications.forEach(cert => {
            cvHTML += `<span style="background-color: #f0f0f0; padding: 8px 12px; border-radius: 6px; font-size: 13px; color: #333;">${cert}</span>`;
        });
        cvHTML += `</div></div>`;

        // Languages
        cvHTML += `<div style="margin-bottom: 40px;">
            <h3 style="font-size: 20px; color: #333; border-bottom: 2px solid #4a90e2; padding-bottom: 10px; margin-bottom: 20px;">Languages</h3>
        `;
        this.languages.forEach(lang => {
            cvHTML += `
                <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                    <span style="font-size: 14px; color: #333; font-weight: 600;">${lang.name}</span>
                    <span style="font-size: 14px; color: #4a90e2;">${lang.level}</span>
                </div>
            `;
        });
        cvHTML += `</div>`;

        // Skills
        cvHTML += `<div style="margin-bottom: 40px;">
            <h3 style="font-size: 20px; color: #333; border-bottom: 2px solid #4a90e2; padding-bottom: 10px; margin-bottom: 20px;">Skills</h3>
            <div style="display: flex; flex-wrap: wrap; gap: 10px;">
        `;
        this.skills.forEach(skill => {
            cvHTML += `<span style="background-color: #e8f0ff; padding: 8px 14px; border-radius: 6px; font-size: 13px; color: #4a90e2; font-weight: 600;">${skill}</span>`;
        });
        cvHTML += `</div></div>`;

        // Projects
        cvHTML += `<div style="margin-bottom: 40px;">
            <h3 style="font-size: 20px; color: #333; border-bottom: 2px solid #4a90e2; padding-bottom: 10px; margin-bottom: 20px;">Projects</h3>
        `;
        this.projects.forEach(project => {
            cvHTML += `
                <div style="margin-bottom: 25px; padding-bottom: 20px; border-bottom: 1px solid #eee;">
                    <h4 style="margin: 0 0 8px 0; font-size: 15px; color: #333; font-weight: 700;">${project.name}</h4>
                    <p style="margin: 5px 0; font-size: 13px; color: #666;">${project.description}</p>
                    <p style="margin: 8px 0; font-size: 12px; color: #999;"><strong>Technologies:</strong> ${project.technologies}</p>
                    <p style="margin: 8px 0; font-size: 12px; color: #999;"><strong>Duration:</strong> ${project.duration}</p>
                    <p style="margin: 8px 0; font-size: 12px; color: #666;"><strong>Process:</strong> ${project.workProcess}</p>
                </div>
            `;
        });
        cvHTML += `</div>`;

        // Testimonials
        cvHTML += `<div style="margin-bottom: 40px;">
            <h3 style="font-size: 20px; color: #333; border-bottom: 2px solid #4a90e2; padding-bottom: 10px; margin-bottom: 20px;">Testimonials</h3>
        `;
        this.testimonials.forEach(testimonial => {
            cvHTML += `
                <div style="margin-bottom: 20px; padding: 15px; background-color: #f9f9f9; border-left: 4px solid #4a90e2; border-radius: 4px;">
                    <p style="margin: 0 0 10px 0; font-size: 13px; color: #666; font-style: italic;">"${testimonial.quote}"</p>
                    <p style="margin: 5px 0; font-size: 13px; color: #333; font-weight: 600;">— ${testimonial.name}</p>
                    <p style="margin: 3px 0; font-size: 12px; color: #999;">${testimonial.project}</p>
                </div>
            `;
        });
        cvHTML += `</div>`;

        tempContainer.innerHTML = cvHTML;
        document.body.appendChild(tempContainer);

        const html2canvas = (await import('html2canvas')).default;
        const jsPDF = (await import('jspdf')).default;

        html2canvas(tempContainer, {
            scale: 2,
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#ffffff'
        }).then((canvas) => {
            const imgWidth = 210; // A4 width in mm
            const pageHeight = 297; // A4 height in mm
            const imgHeight = (canvas.height * imgWidth) / canvas.width;
            let heightLeft = imgHeight;

            const contentDataURL = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');

            let pdfPosition = 0;

            // First page
            pdf.addImage(contentDataURL, 'PNG', 0, pdfPosition, imgWidth, imgHeight);
            heightLeft -= pageHeight;

            // Additional pages
            while (heightLeft >= 0) {
                const nextPosition = heightLeft - imgHeight;
                pdf.addPage();
                pdf.addImage(contentDataURL, 'PNG', 0, nextPosition, imgWidth, imgHeight);
                heightLeft -= pageHeight;
            }

            // Add footer with generation date and page numbers
            const pageCount = pdf.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                pdf.setPage(i);
                pdf.setFontSize(9);
                pdf.setTextColor(150);
                const pageHeightMM = 297;
                const date = new Date().toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                });
                pdf.text(`Generated on ${date}`, 10, pageHeightMM - 10);
                pdf.text(`Page ${i} of ${pageCount}`, 180, pageHeightMM - 10, { align: 'right' });
            }

            pdf.save('Christian_Boehme_CV.pdf');

            // Clean up
            document.body.removeChild(tempContainer);
        });
    }
}
