import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';

import { RouterLink, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import type { DisplayCurrency } from '../calculator/calculator';
import { LanguageService } from '../../language.service';
import { MetaService } from '../../services/meta.service';

@Component({
    selector: 'app-travel-budget-summary',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [RouterLink],
    styleUrl: './travel-budget-summary.scss',
    template: `
<div class="summary-page">
  <nav class="summary-nav">
    <a [routerLink]="['/travel-budget-calculator']" class="back-link">
      &#8592; {{ lang === 'de' ? 'Zum Rechner' : 'Back to Calculator' }}
    </a>
  </nav>

  @if (!countryCode) {
    <div class="summary-error">
      <p>{{ lang === 'de' ? 'Kein Reiseziel ausgewählt.' : 'No destination selected.' }}</p>
      <a [routerLink]="['/travel-budget-calculator']" class="back-link-large">
        {{ lang === 'de' ? 'Zum Rechner' : 'Open Calculator' }}
      </a>
    </div>
  }

  @if (countryCode) {
    <div class="summary-hero" [class.photo-loading]="!photoUrl">
      @if (photoUrl) {
        <img [src]="photoUrl" [alt]="countryName" class="summary-hero-img">
      }
      <div class="summary-hero-overlay">
        <div class="summary-hero-inner">
          <div class="summary-flag-wrap" aria-hidden="true">
            @if (getFlagUrl()) {
              <img [src]="getFlagUrl()" [alt]="''" width="36" height="26"
                loading="eager">
            }
          </div>
          <h1 class="summary-country-name">{{ countryName }}</h1>
          <p class="summary-continent">{{ continentName }}</p>
        </div>
      </div>
    </div>
    <div class="summary-body">
      <div class="summary-chips">
        <span class="summary-chip">&#9200;&#65039; {{ duration }} {{ lang === 'de' ? 'N&auml;chte' : 'nights' }}</span>
        <span class="summary-chip">&#128101;
          {{ persons }} {{ lang === 'de' ? (persons === 1 ? 'Person' : 'Personen') : (persons === 1 ? 'person' : 'persons') }}
        </span>
        <span class="summary-chip">&#128181; {{ currency }}</span>
      </div>
      <div class="summary-totals">
        <div class="summary-total-box primary">
          <span class="summary-total-label">{{ lang === 'de' ? 'Gesamt' : 'Total' }}</span>
          <strong class="summary-total-value">{{ fmt(grandTotal) }}</strong>
        </div>
        <div class="summary-total-box">
          <span class="summary-total-label">{{ lang === 'de' ? 'Pro Person' : 'Per person' }}</span>
          <strong class="summary-total-value">{{ fmt(perPerson) }}</strong>
        </div>
        <div class="summary-total-box">
          <span class="summary-total-label">{{ lang === 'de' ? 'Pro Tag' : 'Per day' }}</span>
          <strong class="summary-total-value">{{ fmt(perDay) }}</strong>
        </div>
      </div>
      @if (grandTotal) {
        <section class="summary-breakdown-section">
          <h2 class="summary-section-title">
            {{ lang === 'de' ? 'Kostenaufschlüsselung' : 'Cost breakdown' }}
          </h2>
          <div class="summary-breakdown-row">
            <span>{{ lang === 'de' ? 'Unterkunft' : 'Accommodation' }}</span>
            <span>{{ fmt(accommodation) }}</span>
          </div>
          <div class="summary-breakdown-row">
            <span>{{ lang === 'de' ? 'Essen &amp; Trinken' : 'Food &amp; Drinks' }}</span>
            <span>{{ fmt(food) }}</span>
          </div>
          <div class="summary-breakdown-row">
            <span>{{ lang === 'de' ? 'Transport vor Ort' : 'Local transport' }}</span>
            <span>{{ fmt(transport) }}</span>
          </div>
          @if (activities) {
            <div class="summary-breakdown-row">
              <span>{{ lang === 'de' ? 'Aktivit&auml;ten' : 'Activities' }}</span>
              <span>{{ fmt(activities) }}</span>
            </div>
          }
          @if (flightAmt) {
            <div class="summary-breakdown-row">
              <span>{{ lang === 'de' ? 'Hin- &amp; R&uuml;ckflug' : 'Return flight' }}</span>
              <span>{{ fmt(flightAmt) }}</span>
            </div>
          }
          <div class="summary-breakdown-row summary-breakdown-divider">
            <span>{{ lang === 'de' ? 'Zwischensumme' : 'Subtotal' }}</span>
            <span>{{ fmt(subtotal) }}</span>
          </div>
          <div class="summary-breakdown-row">
            <span>{{ lang === 'de' ? 'Puffer (' + bufferPct + '%)' : 'Buffer (' + bufferPct + '%)' }}</span>
            <span>+{{ fmt(bufferAmt) }}</span>
          </div>
          <div class="summary-breakdown-row summary-breakdown-total">
            <span>{{ lang === 'de' ? 'Gesamtbetrag' : 'Grand total' }}</span>
            <span>{{ fmt(grandTotal) }}</span>
          </div>
        </section>
      }
      <section class="summary-booking-section">
        <h2 class="summary-section-title">{{ lang === 'de' ? 'Jetzt buchen' : 'Book now' }}</h2>
        <p class="summary-affiliate-note">
          {{ lang === 'de' ? 'Partnerlinks &ndash; kein Aufpreis für dich.' : 'Affiliate links &ndash; no extra cost to you.' }}
        </p>
        <div class="summary-booking-grid">
          <a [href]="getBookingUrl()" target="_blank" rel="noopener noreferrer" class="bk-btn booking">
            <span class="bk-icon">&#127976;</span>
            <span class="bk-label">{{ lang === 'de' ? 'Hotel buchen' : 'Book hotel' }}</span>
            <em class="bk-brand">Booking.com</em>
          </a>
          <a [href]="getFlightUrl()" target="_blank" rel="noopener noreferrer" class="bk-btn skyscanner">
            <span class="bk-icon">&#9992;&#65039;</span>
            <span class="bk-label">{{ lang === 'de' ? 'Flug suchen' : 'Find flight' }}</span>
            <em class="bk-brand">Skyscanner</em>
          </a>
          <a [href]="getActivitiesUrl()" target="_blank" rel="noopener noreferrer" class="bk-btn getyourguide">
            <span class="bk-icon">&#127917;</span>
            <span class="bk-label">{{ lang === 'de' ? 'Aktivit&auml;ten' : 'Activities' }}</span>
            <em class="bk-brand">GetYourGuide</em>
          </a>
          <a [href]="getAirbnbUrl()" target="_blank" rel="noopener noreferrer" class="bk-btn airbnb">
            <span class="bk-icon">&#127968;</span>
            <span class="bk-label">{{ lang === 'de' ? 'Ferienwohnung' : 'Vacation rental' }}</span>
            <em class="bk-brand">Airbnb</em>
          </a>
        </div>
      </section>
    </div>
  }
</div>
`
})
export class TravelBudgetSummaryComponent implements OnInit {
    lang = 'en';
    countryCode = '';
    originCode = '';
    countryName = '';
    continentName = '';
    duration = 7;
    persons = 2;
    currency: DisplayCurrency = 'USD';
    bufferPct = 15;
    accommodation = 0;
    food = 0;
    transport = 0;
    activities = 0;
    flightAmt = 0;
    subtotal = 0;
    bufferAmt = 0;
    grandTotal = 0;
    perPerson = 0;
    perDay = 0;
    photoUrl = '';

    private readonly rates: Record<string, number> = {
        USD: 1, EUR: 0.92, GBP: 0.79, CHF: 0.88, CAD: 1.35, AUD: 1.52, JPY: 148.2
    };
    private readonly symbols: Record<string, string> = {
        USD: '$', EUR: '€', GBP: '£', CHF: 'CHF\u00a0', CAD: 'C$', AUD: 'A$', JPY: '¥'
    };

    constructor(
        private route: ActivatedRoute,
        private http: HttpClient,
        private cdr: ChangeDetectorRef,
        private langService: LanguageService,
        private metaService: MetaService
    ) { }

    ngOnInit(): void {
        this.lang = this.langService.getCurrentLanguage();
        const p = this.route.snapshot.queryParams;
        this.countryCode = String(p['c'] ?? '').toUpperCase();
        this.originCode = String(p['o'] ?? '').toUpperCase();
        this.countryName = String(p['n'] ?? this.countryCode);
        this.continentName = String(p['cont'] ?? '');
        this.duration = Number(p['d'] ?? 7);
        this.persons = Number(p['p'] ?? 2);
        this.currency = String(p['cur'] ?? 'USD') as DisplayCurrency;
        this.bufferPct = Number(p['buf'] ?? 15);
        this.accommodation = Number(p['acc'] ?? 0);
        this.food = Number(p['food'] ?? 0);
        this.transport = Number(p['trans'] ?? 0);
        this.activities = Number(p['acts'] ?? 0);
        this.flightAmt = Number(p['fl'] ?? 0);
        this.subtotal = Number(p['sub'] ?? 0);
        this.bufferAmt = Number(p['bufamt'] ?? 0);
        this.grandTotal = Number(p['total'] ?? 0);
        this.perPerson = Number(p['pp'] ?? 0);
        this.perDay = Number(p['ppd'] ?? 0);

        if (this.countryCode) {
            this.loadPhoto();
        }

        const isDE = this.lang === 'de';
        this.metaService.updateSEO({
            title: isDE
                ? `${this.countryName} Reisebudget ${this.fmt(this.grandTotal)} | Christian Böhme`
                : `${this.countryName} Travel Budget ${this.fmt(this.grandTotal)} | Christian Boehme`,
            description: isDE
                ? `Reisebudget für ${this.countryName}: ${this.fmt(this.grandTotal)} Gesamt für ${this.duration} Nächte, ${this.persons} Person(en). Hotel, Flug und Aktivitäten buchen.`
                : `Travel budget for ${this.countryName}: ${this.fmt(this.grandTotal)} total for ${this.duration} nights, ${this.persons} person(s). Book hotel, flight and activities.`,
            url: 'https://www.christian-boehme.com/travel-budget-summary',
        });
    }

    private loadPhoto(): void {
        const query = encodeURIComponent(this.countryName + ' travel landscape');
        this.http.get<{ results?: Array<{ urls?: { regular?: string; small?: string } }> }>(
            `/api/unsplash-proxy.php?query=${query}&per_page=1`
        ).subscribe({
            next: res => {
                const img = res?.results?.[0]?.urls?.regular ?? res?.results?.[0]?.urls?.small ?? '';
                this.photoUrl = img || `https://picsum.photos/seed/${this.countryCode}/800/400`;
                this.cdr.markForCheck();
            },
            error: () => {
                this.photoUrl = `https://picsum.photos/seed/${this.countryCode}/800/400`;
                this.cdr.markForCheck();
            }
        });
    }

    getFlagUrl(): string {
        if (!this.countryCode || this.countryCode.length !== 2) return '';
        return `https://flagcdn.com/32x24/${this.countryCode.toLowerCase()}.png`;
    }

    fmt(amount: number): string {
        if (!amount) return '–';
        const rate = this.rates[this.currency] ?? 1;
        const sym = this.symbols[this.currency] ?? (this.currency + '\u00a0');
        return sym + Math.round(amount * rate).toLocaleString();
    }

    getBookingUrl(): string {
        return `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(this.countryName)}&dest_type=country`;
    }

    getFlightUrl(): string {
        const o = (this.originCode || 'DE').toLowerCase();
        return `https://www.skyscanner.net/flights/${o}/${this.countryCode.toLowerCase()}/`;
    }

    getActivitiesUrl(): string {
        return `https://www.getyourguide.com/s/?q=${encodeURIComponent(this.countryName)}`;
    }

    getAirbnbUrl(): string {
        return `https://www.airbnb.com/s/${encodeURIComponent(this.countryName)}`;
    }
}
