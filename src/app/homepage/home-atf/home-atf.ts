
import { Component, OnInit, OnDestroy, ChangeDetectorRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Counters } from '../counters/counters';
import { LanguageService, Language } from '../../language.service';
import { MetaService } from '../../services/meta.service';

@Component({
  selector: 'app-home-atf',
  standalone: true,
  imports: [CommonModule, RouterModule, Counters],
  templateUrl: './home-atf.html',
  styleUrls: ['./home-atf.scss'],
})

export class HomeAtf implements OnInit, AfterViewInit, OnDestroy {
  currentSlide = 0;
  slideInterval: any;
  currentLanguage: Language = 'en';

  constructor(
    private languageService: LanguageService,
    private cdr: ChangeDetectorRef,
    private metaService: MetaService
  ) { }

  ngOnInit() {
    // SEO Meta Tags
    this.metaService.updateSEO(
      {
        title: 'Christian Böhme | Photography, Travel & Aviation',
        description: 'Explore aviation and travel photography by Christian Böhme. Browse galleries featuring aviation spotting, world travels, spotter hotels, and professional IT career profile.',
        image: 'https://www.christian-boehme.com/assets/img/other/Dresden%20Skyline.jpg',
        url: 'https://www.christian-boehme.com/',
        type: 'website'
      },
      {
        "@context": "https://schema.org",
        "@type": "WebSite",
        "name": "Christian Böhme Photography",
        "alternateName": "Christian Boehme",
        "url": "https://www.christian-boehme.com",
        "description": "Aviation and travel photography portfolio",
        "author": {
          "@type": "Person",
          "name": "Christian Böhme"
        },
        "potentialAction": {
          "@type": "SearchAction",
          "target": "https://www.christian-boehme.com/gallery?search={search_term_string}",
          "query-input": "required name=search_term_string"
        }
      }
    );

    this.currentLanguage = this.languageService.getCurrentLanguage();
    this.languageService.language$.subscribe((lang) => {
      this.currentLanguage = lang;
      this.cdr.markForCheck();
    });
  }

  ngAfterViewInit() {
    setTimeout(() => {
      this.startSlideShow();
    }, 0);
  }

  getTranslation(key: string): string {
    return this.languageService.getTranslation(key);
  }

  startSlideShow() {
    this.slideInterval = setInterval(() => {
      this.currentSlide = (this.currentSlide + 1) % 3;
      this.cdr.detectChanges();
    }, 8000); // 8 seconds per slide (includes transition time)
  }

  goToSlide(index: number) {
    this.currentSlide = index;
    clearInterval(this.slideInterval);
    this.startSlideShow();
  }

  ngOnDestroy() {
    if (this.slideInterval) {
      clearInterval(this.slideInterval);
    }
  }

  public async downloadPDF(): Promise<void> {
    // Navigate to career page and trigger download
    const careerContent = document.getElementById('cv-content');

    if (careerContent) {
      // If we're on a page where the CV is already rendered
      const html2canvas = (await import('html2canvas')).default;
      const jsPDF = (await import('jspdf')).default;

      html2canvas(careerContent, { scale: 2 }).then(canvas => {
        const imgWidth = 208;
        const pageHeight = 295;
        const imgHeight = canvas.height * imgWidth / canvas.width;
        let heightLeft = imgHeight;

        const contentDataURL = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const position = 0;

        pdf.addImage(contentDataURL, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;

        while (heightLeft >= 0) {
          const position = heightLeft - imgHeight;
          pdf.addPage();
          pdf.addImage(contentDataURL, 'PNG', 0, position, imgWidth, imgHeight);
          heightLeft -= pageHeight;
        }

        pdf.save('Christian_Boehme_CV.pdf');
      });
    } else {
      // If CV is not rendered, open career page in new window
      window.open('/career', '_blank');
    }
  }
}
