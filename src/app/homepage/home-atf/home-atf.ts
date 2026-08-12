
import { Component, OnInit, OnDestroy, ChangeDetectorRef, AfterViewInit, ChangeDetectionStrategy } from '@angular/core';

import { RouterModule } from '@angular/router';
import { LanguageService, Language } from '../../language.service';
import { MetaService } from '../../services/meta.service';

@Component({
  selector: 'app-home-atf',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './home-atf.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./home-atf.scss'],
})

export class HomeAtf implements OnInit, AfterViewInit, OnDestroy {
  quoteInterval: any;
  currentLanguage: Language = 'en';
  quoteIndex = 0;
  currentQuote = '';
  quoteVisible = true;
  private quoteFadeTimeout: any;
  private scrollHandler!: () => void;
  private snapScrollHandler!: () => void;
  private snapDebounceTimer: any;
  // Snap targets the TEXT column, not the photo: the text is what CSS
  // (`position: sticky`) intends to hold at vertical center, but that only
  // engages once scroll has carried it into a fairly narrow window. Driving
  // the snap off the text's own current position — rather than the
  // photo's — means the correction lands it exactly on center whether it
  // was already stuck there or not, which is what "centered when snapped"
  // actually requires.
  private readonly SNAP_TEXT_SELECTORS = [
    '.shop-content',
    '.travel-content',
    '.aviation-content',
    '.photography-content',
  ];
  // Photos aren't sticky (they're meant to keep traveling, unlike the
  // text), so they only get their own snap moment as a fallback, once
  // text needs no correction — see snapToNearestImage().
  private readonly SNAP_PHOTO_SELECTORS = [
    '.shop-pricing-card',
    '.travel-photo-frame',
    '.aviation-photo-frame',
    '.photography-photo-frame',
  ];
  // How close (px) a photo needs to be to center before it gets pulled the
  // rest of the way. Wide enough to actually catch normal scrolling instead
  // of requiring a lucky stop within a sliver of the section.
  private readonly PHOTO_SNAP_RADIUS = 220;
  // Which element each snap type last locked onto — prevents re-snapping
  // the same element on every debounce while the user is still near it
  // (e.g. pausing partway through scrolling past it), which otherwise felt
  // like the page fighting attempts to scroll onward. Cleared once the
  // user actually leaves that element's catch zone.
  private lastSnappedTextEl: HTMLElement | null = null;
  private lastSnappedPhotoEl: HTMLElement | null = null;
  private animFrameId = 0;
  private sectionObserver!: IntersectionObserver;
  private readonly SCROLL_RANGE = 500;
  private lastProgress = -1;
  private readonly prefersReducedMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  private touchStartX = 0;
  private touchStartY = 0;
  private touchEndX = 0;
  private touchEndY = 0;
  private readonly swipeThreshold = 50;

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
      // Update current quote when language changes
      this.currentQuote = this.getRandomQuote();
      this.cdr.markForCheck();
    });

    // Initialize quote before view is rendered
    this.currentQuote = this.getRandomQuote();
  }

  ngAfterViewInit() {
    if (!this.prefersReducedMotion) {
      this.scrollHandler = () => {
        if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
        this.animFrameId = requestAnimationFrame(() => this.applyScrollProgress());
      };
      window.addEventListener('scroll', this.scrollHandler, { passive: true });
      this.applyScrollProgress();
    }

    if (!this.prefersReducedMotion) {
      this.snapScrollHandler = () => this.scheduleSnapCheck();
      window.addEventListener('scroll', this.snapScrollHandler, { passive: true });
    }

    this.sectionObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          entry.target.querySelectorAll<HTMLElement>('.count-up').forEach(el => this.animateCountUp(el));
          this.sectionObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });

    document.querySelectorAll('[data-animate]').forEach(el => {
      this.sectionObserver.observe(el);
    });

    setTimeout(() => {
      this.startQuoteRotation();
    }, 0);
  }

  getTranslation(key: string): string {
    return this.languageService.getTranslation(key);
  }

  // Counts a `.count-up` badge (e.g. "42 Countries Covered") up from 0 to
  // its `data-count-target` once, the moment its section first scrolls
  // into view — reuses the same visibility trigger as the section reveal.
  private animateCountUp(el: HTMLElement): void {
    const target = parseInt(el.dataset['countTarget'] || '0', 10);
    if (!target) return;
    if (this.prefersReducedMotion) {
      el.textContent = String(target);
      return;
    }
    const duration = 4500;
    const start = performance.now();
    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
    const step = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      el.textContent = String(Math.round(target * easeOutCubic(progress)));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  startQuoteRotation() {
    this.quoteInterval = setInterval(() => {
      this.advanceQuote(1);
    }, 8000);
  }

  getCurrentQuotes(): string[] {
    const lang = this.currentLanguage;
    return this.photographyQuotes[lang][this.quoteIndex] ?? [];
  }

  getQuoteGroupsCount(): number {
    const lang = this.currentLanguage;
    return this.photographyQuotes[lang].length;
  }

  getRandomQuote(): string {
    const lang = this.currentLanguage;
    const quotes = this.getCurrentQuotes();
    if (!quotes || quotes.length === 0) return '';
    return quotes[Math.floor(Math.random() * quotes.length)];
  }

  onTouchStart(event: Event): void {
    const touchEvent = event as TouchEvent;
    if (touchEvent.touches.length !== 1) return;
    const touch = touchEvent.touches[0];
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
        this.advanceQuote(1, true);
      } else {
        this.advanceQuote(-1, true);
      }
    }
  }

  private applyScrollProgress(): void {
    const p = Math.round(Math.min(Math.max(window.scrollY / this.SCROLL_RANGE, 0), 1) * 100) / 100;
    if (p === this.lastProgress) return;
    this.lastProgress = p;

    const atf = document.getElementById('home-atf');
    if (!atf) return;

    const vw = window.innerWidth;
    const maxWidth = vw * 0.95;
    const initialWidth = Math.min(maxWidth - 16, 1920);
    const currentWidth = initialWidth + (maxWidth - initialWidth) * p;
    atf.style.width = `${currentWidth}px`;

    const bottomRadius = 16 * (1 - p);
    atf.style.borderTopLeftRadius = '16px';
    atf.style.borderTopRightRadius = '16px';
    atf.style.borderBottomLeftRadius = `${bottomRadius}px`;
    atf.style.borderBottomRightRadius = `${bottomRadius}px`;

    // Parallax: background moves down at 50% speed, clamped to 25% of slider height
    const maxParallax = atf.offsetHeight * 0.25;
    const parallaxOffset = Math.min(Math.round(window.scrollY * 0.5), maxParallax);
    atf.querySelectorAll<HTMLElement>('.hero-background').forEach(bg => {
      bg.style.transform = `translateY(${parallaxOffset}px)`;
    });

    // Hero content moves up at 15% of scroll speed for depth
    const heroContent = atf.querySelector<HTMLElement>('.hero-content');
    if (heroContent) {
      heroContent.style.transform = `translateY(${-Math.round(window.scrollY * 0.15)}px)`;
    }

    const title = atf.querySelector('.hero-title') as HTMLElement;
    if (title) {
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      const initialPx = Math.min(Math.max(2.5 * rem, 0.05 * vw), 4 * rem);
      const finalPx = Math.min(Math.max(3.6 * rem, 0.07 * vw), 5.5 * rem);
      title.style.fontSize = `${(initialPx + (finalPx - initialPx) * p).toFixed(1)}px`;
    }
  }

  // Once scrolling has actually stopped (debounced, not on every scroll
  // tick), ease to whichever section's photo is closest to vertical center
  // — that's also where the sticky text next to it sits, so the pair lines
  // up instead of resting wherever the photo happened to be mid-scroll.
  // Native `scroll-snap-type: mandatory` was tried first but can trap the
  // page at the first snap point under small/discrete wheel input; this
  // JS version only nudges the scroll after the user has already let go.
  private scheduleSnapCheck(): void {
    if (window.innerWidth < 901) return;
    clearTimeout(this.snapDebounceTimer);
    this.snapDebounceTimer = setTimeout(() => this.snapToNearestImage(), 160);
  }

  private snapToNearestImage(): void {
    // Match the CSS sticky-centering math for the text column
    // (`top: calc(50vh + var(--header-offset) / 2)` with a -50% transform):
    // the visible center of the space below the fixed header, not the raw
    // viewport center.
    const headerOffset = parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue('--header-offset')
    ) || 40;
    const viewportCenter = window.innerHeight / 2 + headerOffset / 2;

    // Text takes priority: bring it to exact center whenever it's
    // reasonably close (whether `position: sticky` has already caught it
    // or it's still approaching/leaving that position — an unstuck text
    // column tracks scroll 1:1, so applying this delta lands it on center
    // either way).
    const text = this.closestToCenter(this.SNAP_TEXT_SELECTORS, viewportCenter);
    const textInRange = !!text && text.dist <= window.innerHeight * 0.4;
    // Only re-arm once the user has actually left this text's catch zone —
    // otherwise a brief pause while scrolling past an already-centered
    // text column would pull it right back, fighting forward progress.
    if (!textInRange || text!.el !== this.lastSnappedTextEl) {
      this.lastSnappedTextEl = null;
    }
    if (textInRange && text!.dist >= 4 && this.lastSnappedTextEl !== text!.el) {
      window.scrollTo({ top: window.scrollY + text!.delta, behavior: 'smooth' });
      this.lastSnappedTextEl = text!.el;
      return;
    }

    // Photos aren't sticky — they're meant to keep traveling past center,
    // giving them a longer scroll path than the text — so they only get a
    // snap moment once already close on their own (a tighter radius than
    // the text's). Same one-shot-per-approach guard: once a photo has been
    // snapped to center, further pauses while scrolling on past it won't
    // pull it back — only leaving and re-entering the catch zone re-arms
    // it. Only reached when text needed no correction above, so this can't
    // fight the text snap for the same scroll.
    const photo = this.closestToCenter(this.SNAP_PHOTO_SELECTORS, viewportCenter);
    const photoInRange = !!photo && photo.dist <= this.PHOTO_SNAP_RADIUS;
    if (!photoInRange || photo!.el !== this.lastSnappedPhotoEl) {
      this.lastSnappedPhotoEl = null;
    }
    if (photoInRange && photo!.dist >= 4 && this.lastSnappedPhotoEl !== photo!.el) {
      window.scrollTo({ top: window.scrollY + photo!.delta, behavior: 'smooth' });
      this.lastSnappedPhotoEl = photo!.el;
    }
  }

  private closestToCenter(
    selectors: string[],
    viewportCenter: number
  ): { el: HTMLElement; delta: number; dist: number } | null {
    let bestEl: HTMLElement | null = null;
    let bestDelta = 0;
    let bestDist = Infinity;

    for (const selector of selectors) {
      const el = document.querySelector<HTMLElement>(selector);
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      const elCenter = rect.top + rect.height / 2;
      const delta = elCenter - viewportCenter;
      const dist = Math.abs(delta);
      if (dist < bestDist) {
        bestDist = dist;
        bestDelta = delta;
        bestEl = el;
      }
    }

    return bestEl ? { el: bestEl, delta: bestDelta, dist: bestDist } : null;
  }

  ngOnDestroy() {
    if (this.scrollHandler) {
      window.removeEventListener('scroll', this.scrollHandler);
    }
    if (this.snapScrollHandler) {
      window.removeEventListener('scroll', this.snapScrollHandler);
    }
    clearTimeout(this.snapDebounceTimer);
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
    }
    if (this.sectionObserver) {
      this.sectionObserver.disconnect();
    }
    if (this.quoteInterval) {
      clearInterval(this.quoteInterval);
    }
    if (this.quoteFadeTimeout) {
      clearTimeout(this.quoteFadeTimeout);
    }
  }

  private advanceQuote(step: 1 | -1, resetTimer = false): void {
    if (this.quoteFadeTimeout) {
      clearTimeout(this.quoteFadeTimeout);
    }

    const commitChange = () => {
      const count = this.getQuoteGroupsCount();
      this.quoteIndex = (this.quoteIndex + step + count) % count;
      this.currentQuote = this.getRandomQuote();
      this.quoteVisible = true;
      this.cdr.markForCheck();
    };

    if (this.prefersReducedMotion) {
      commitChange();
    } else {
      this.quoteVisible = false;
      this.cdr.markForCheck();
      this.quoteFadeTimeout = setTimeout(commitChange, 200);
    }

    if (resetTimer) {
      clearInterval(this.quoteInterval);
      this.startQuoteRotation();
    }
  }

  public downloadPDF(): void {
    const frameId = 'career-pdf-download-frame';
    const existingFrame = document.getElementById(frameId);
    if (existingFrame) {
      existingFrame.remove();
    }

    const iframe = document.createElement('iframe');
    iframe.id = frameId;
    iframe.style.position = 'fixed';
    iframe.style.width = '1px';
    iframe.style.height = '1px';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.opacity = '0';
    iframe.style.pointerEvents = 'none';
    iframe.style.border = '0';
    iframe.src = `/career?download=pdf&embedded=1&t=${Date.now()}`;
    document.body.appendChild(iframe);

    // Cleanup hidden frame after download trigger to avoid DOM buildup.
    window.setTimeout(() => {
      iframe.remove();
    }, 12000);
  }
}
