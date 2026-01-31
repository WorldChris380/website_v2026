
import { Component, OnInit, OnDestroy, ChangeDetectorRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { LanguageService, Language } from '../../language.service';
import { MetaService } from '../../services/meta.service';

@Component({
  selector: 'app-home-atf',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './home-atf.html',
  styleUrls: ['./home-atf.scss'],
})

export class HomeAtf implements OnInit, AfterViewInit, OnDestroy {
  currentSlide = 0;
  slideInterval: any;
  currentLanguage: Language = 'en';
  isPaused = false;
  quoteIndex = 0;
  currentQuote = '';
  private touchStartX = 0;
  private touchStartY = 0;
  private touchEndX = 0;
  private touchEndY = 0;
  private readonly swipeThreshold = 50;

  travelQuotes = {
    en: [
      ['The world is a book, and those who do not travel read only one page.', 'Adventure awaits in 195 countries worldwide.', 'Travel is the only thing you buy that makes you richer.'],
      ['Not all those who wander are lost.', 'Life is either a daring adventure or nothing at all.', 'To travel is to live.'],
      ['The journey of a thousand miles begins with a single step.', 'Traveling leaves you speechless, then turns you into a storyteller.', 'Collect moments, not things.']
    ],
    de: [
      ['Die Welt ist ein Buch. Wer nie reist, sieht nur eine Seite davon.', 'Abenteuer warten in 195 Ländern weltweit.', 'Reisen ist das Einzige, das dich reicher macht, wenn du es kaufst.'],
      ['Nicht alle, die wandern, sind verloren.', 'Leben ist entweder ein gewagtes Abenteuer oder gar nichts.', 'Reisen ist leben.'],
      ['Eine Reise von tausend Meilen beginnt mit einem einzigen Schritt.', 'Reisen macht dich sprachlos und verwandelt dich dann in einen Geschichtenerzähler.', 'Sammle Momente, nicht Dinge.']
    ]
  };

  aviationQuotes = {
    en: [
      ['The Wright Brothers\' first flight lasted only 12 seconds.', 'A Boeing 747 has 6 million parts working together.', 'Commercial jets cruise at approximately 900 km/h.'],
      ['The Concorde could fly from London to New York in under 3 hours.', 'An airplane\s wings are designed to flex up to 90 degrees.', 'The black box is actually bright orange for visibility.'],
      ['Pilots and co-pilots eat different meals to avoid food poisoning.', 'Airplanes are struck by lightning about once per year.', 'The Boeing 787 is made of 50% composite materials.']
    ],
    de: [
      ['Der erste Flug der Gebrüder Wright dauerte nur 12 Sekunden.', 'Eine Boeing 747 besteht aus 6 Millionen Teilen.', 'Verkehrsflugzeuge fliegen mit etwa 900 km/h.'],
      ['Die Concorde flog in unter 3 Stunden von London nach New York.', 'Flugzeugflügel können sich bis zu 90 Grad biegen.', 'Die Black Box ist tatsächlich orange für bessere Sichtbarkeit.'],
      ['Piloten essen unterschiedliche Mahlzeiten zur Sicherheit.', 'Flugzeuge werden etwa einmal pro Jahr vom Blitz getroffen.', 'Die Boeing 787 besteht zu 50% aus Verbundwerkstoffen.']
    ]
  };

  photographyQuotes = {
    en: [
      ['Photography: Where science meets art in a single click.', 'The Golden Hour – 60 minutes of magic twice daily.', 'A great photograph expresses what one feels.'],
      ['The camera is an instrument that teaches people how to see.', 'Photography is the story I fail to put into words.', 'In photography, there is a reality so subtle it becomes more real.'],
      ['Light makes photography. Embrace light. Admire it.', 'The best camera is the one that\'s with you.', 'Photography takes an instant out of time, altering life by holding it still.']
    ],
    de: [
      ['Fotografie: Wo Wissenschaft und Kunst verschmelzen.', 'Die Goldene Stunde – 60 Minuten Magie, zweimal täglich.', 'Ein großartiges Foto drückt aus, was man fühlt.'],
      ['Die Kamera ist ein Instrument, das Menschen das Sehen lehrt.', 'Fotografie ist die Geschichte, die ich nicht in Worte fassen kann.', 'In der Fotografie gibt es eine Realität, die so subtil ist, dass sie realer wird.'],
      ['Licht macht Fotografie. Umarme das Licht. Bewundere es.', 'Die beste Kamera ist die, die du bei dir hast.', 'Fotografie nimmt einen Moment aus der Zeit und verändert das Leben.']
    ]
  };

  careerQuotes = {
    en: [
      ['Code is poetry written in logic and creativity.', 'The best way to predict the future is to build it.', 'Innovation distinguishes between a leader and a follower.'],
      ['First, solve the problem. Then, write the code.', 'Make it work, make it right, make it fast.', 'Any fool can write code that a computer can understand.'],
      ['The only way to do great work is to love what you do.', 'Stay hungry, stay foolish.', 'Technology is best when it brings people together.']
    ],
    de: [
      ['Code ist Poesie, geschrieben in Logik und Kreativität.', 'Der beste Weg, die Zukunft vorherzusagen, ist sie zu gestalten.', 'Innovation unterscheidet zwischen einem Anführer und einem Nachfolger.'],
      ['Erst das Problem lösen. Dann den Code schreiben.', 'Mach es funktionierend, mach es richtig, mach es schnell.', 'Jeder Narr kann Code schreiben, den ein Computer versteht.'],
      ['Der einzige Weg, großartige Arbeit zu leisten, ist zu lieben, was man tut.', 'Bleib hungrig, bleib verrückt.', 'Technologie ist am besten, wenn sie Menschen zusammenbringt.']
    ]
  };

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

    // Initialize quote before view is rendered
    this.currentQuote = this.getRandomQuote();
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
      this.advanceSlide(1, false);
    }, 8000); // 8 seconds per slide (includes transition time)
  }

  getCurrentQuotes(): string[] {
    const lang = this.currentLanguage;
    switch (this.currentSlide) {
      case 0: return this.travelQuotes[lang][this.quoteIndex];
      case 1: return this.aviationQuotes[lang][this.quoteIndex];
      case 2: return this.photographyQuotes[lang][this.quoteIndex];
      case 3: return this.careerQuotes[lang][this.quoteIndex];
      default: return [];
    }
  }

  getRandomQuote(): string {
    const lang = this.currentLanguage;
    const quotes = this.getCurrentQuotes();
    if (quotes.length === 0) return '';
    return quotes[Math.floor(Math.random() * quotes.length)];
  }

  goToSlide(index: number) {
    this.currentSlide = index;
    this.currentQuote = this.getRandomQuote();
    this.resetSlideShow();
  }

  onTouchStart(event: TouchEvent): void {
    if (event.touches.length !== 1) return;
    const touch = event.touches[0];
    this.touchStartX = touch.clientX;
    this.touchStartY = touch.clientY;
    this.touchEndX = touch.clientX;
    this.touchEndY = touch.clientY;
  }

  onTouchMove(event: TouchEvent): void {
    if (event.touches.length !== 1) return;
    const touch = event.touches[0];
    this.touchEndX = touch.clientX;
    this.touchEndY = touch.clientY;
  }

  onTouchEnd(): void {
    const deltaX = this.touchEndX - this.touchStartX;
    const deltaY = this.touchEndY - this.touchStartY;
    if (Math.abs(deltaX) > this.swipeThreshold && Math.abs(deltaX) > Math.abs(deltaY)) {
      if (deltaX < 0) {
        this.advanceSlide(1, true);
      } else {
        this.advanceSlide(-1, true);
      }
    }
  }

  togglePlayPause() {
    this.isPaused = !this.isPaused;
    if (this.isPaused) {
      clearInterval(this.slideInterval);
    } else {
      this.startSlideShow();
    }
  }

  ngOnDestroy() {
    if (this.slideInterval) {
      clearInterval(this.slideInterval);
    }
  }

  private advanceSlide(step: 1 | -1, resetTimer: boolean): void {
    this.currentSlide = (this.currentSlide + step + 4) % 4;
    this.quoteIndex = (this.quoteIndex + step + 3) % 3;
    this.currentQuote = this.getRandomQuote();
    this.cdr.detectChanges();
    if (resetTimer) {
      this.resetSlideShow();
    }
  }

  private resetSlideShow(): void {
    if (!this.isPaused) {
      clearInterval(this.slideInterval);
      this.startSlideShow();
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
