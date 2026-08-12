import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { LanguageService, Language } from '../../language.service';
import { MetaService } from '../../services/meta.service';
import { ResultCardComponent } from './components/result-card/result-card.component';

export interface CountryCostData {
    code: string;
    name: string;
    nameDE: string;
    continent: string;
    currency?: string;
    safety?: SafetyLevel;
    tourismDevelopment?: TourismDevelopment;
    costs: {
        accommodation: { budget: number; midrange: number; luxury: number };
        food: { budget: number; midrange: number; luxury: number };
        transport: number;
        activities: number;
        flightFromEU: number;
    };
    bookingUrl: string;
    skyscannerUrl: string;
    airbnbUrl: string;
    getYourGuideUrl: string;
    geo?: {
        lat: number;
        lon: number;
        reachability: number;
    };
}

export interface BudgetResult {
    accommodation: number;
    food: number;
    transport: number;
    activities: number;
    flight: number;
    subtotal: number;
    buffer: number;
    totalPerPerson: number;
    grandTotal: number;
    dailyPerPerson: number;
}

export interface ReverseBudgetMatch {
    country: CountryCostData;
    total: number;
    perPerson: number;
    perDayPerPerson: number;
}

interface CountryPriceComparisonItem {
    country: CountryCostData;
    total: number;
}

export interface CountryPriceComparison {
    rank: number;
    totalCountries: number;
    cheaperCount: number;
    expensiveCount: number;
    selectedTotal: number;
    cheaperAlternatives: CountryPriceComparisonItem[];
    pricierAlternatives: CountryPriceComparisonItem[];
}

export type SafetyLevel = 'low' | 'medium' | 'high';
export type TourismDevelopment = 'high' | 'medium' | 'low';

interface CountryProfile {
    safety: SafetyLevel;
    tourismDevelopment: TourismDevelopment;
}

export type TravelSeason = 'low' | 'shoulder' | 'high';

export type DisplayCurrency = 'USD' | 'EUR' | 'GBP' | 'CHF' | 'CAD' | 'AUD' | 'JPY';

export interface TripPreset {
    key: string;
    labelKey: string;
    descKey: string;
    icon: string;
    accommodationType: 'budget' | 'midrange' | 'luxury';
    travelStyle: 'budget' | 'midrange' | 'luxury';
    includeFlight: boolean;
    includeActivities: boolean;
    suggestedDuration: number;
}

export interface CountryInsight {
    flagEmoji: string;
    currency: string;
    bestTime: string;
    bestTimeDE: string;
    savingTip: string;
    savingTipDE: string;
}

interface RestCountryApi {
    cca2?: string;
    name?: { common?: string };
    translations?: { deu?: { common?: string } };
    region?: string;
    latlng?: number[];
    currencies?: Record<string, { name?: string; symbol?: string }>;
}

interface WorldBankIndicatorEntry {
    countryiso3code?: string;
    value?: number | null;
}

type CollapsibleSectionKey = 'starting' | 'destination' | 'budgetSearch' | 'destFilters' | 'tripParams' | 'costProfile';

@Component({
    selector: 'app-calculator',
    standalone: true,
    imports: [
    FormsModule,
    RouterLink,
    ResultCardComponent
],
    templateUrl: './calculator.html',
    changeDetection: ChangeDetectionStrategy.Eager,
    styleUrl: './calculator.scss'
})
export class TravelBudgetCalculatorComponent implements OnInit, OnDestroy {
    currentLanguage: Language = 'en';
    readonly tFn = (key: string) => this.t(key);
    readonly countryLabelFn = (country: CountryCostData) => this.getCountryLabel(country);
    readonly barWidthFn = (value: number, total: number) => this.getBarWidth(value, total);
    readonly openLinkFn = (url: string) => this.openLink(url);
    readonly formatCurrencyFn = (amount: number) => this.formatCurrency(amount);
    readonly compareRankPercentFn = (comparison: CountryPriceComparison | null) => this.getCompareRankPercent(comparison);
    readonly continentLabelFn = (continent: string) => this.getContinentLabel(continent);
    readonly countryCurrencyFn = (country: CountryCostData) => this.getCountryCurrency(country);
    readonly countrySafetyFn = (country: CountryCostData) => this.getCountrySafety(country);
    readonly countryTourismFn = (country: CountryCostData) => this.getCountryTourismDevelopment(country);
    readonly safetyLabelFn = (level: SafetyLevel) => this.getSafetyLabel(level);
    readonly tourismLabelFn = (level: TourismDevelopment) => this.getTourismLabel(level);
    readonly priceLevelLabelFn = (country: CountryCostData) => this.getPriceLevelLabel(country);
    readonly seasonLabelFn = (country: CountryCostData | null) => this.getDerivedSeasonLabelForCountry(country);

    // Form state
    selectedCountryCode: string = '';
    selectedOriginCountryCode: string = '';
    selectedCurrency: DisplayCurrency = 'USD';
    duration: number = 7;
    persons: number = 2;
    bufferPercentage: number = 15;
    accommodationType: 'budget' | 'midrange' | 'luxury' = 'midrange';
    travelStyle: 'budget' | 'midrange' | 'luxury' = 'midrange';
    includeFlight: boolean = true;
    includeActivities: boolean = true;
    reverseBudgetMin: number = 1500;
    reverseBudgetMax: number = 4000;
    readonly reverseBudgetFloor = 300;
    readonly reverseBudgetCeiling = 12000;
    readonly reverseBudgetStep = 100;
    selectedTravelMonth: number | null = null;
    selectedContinentFilter = 'all';
    selectedSafetyFilter: SafetyLevel | 'all' = 'all';
    selectedTourismFilter: TourismDevelopment | 'all' = 'all';

    result: BudgetResult | null = null;
    selectedCountry: CountryCostData | null = null;
    reverseMatches: ReverseBudgetMatch[] = [];
    reverseSearchPerformed: boolean = false;
    private readonly brokenFlagCodes = new Set<string>();
    wizardMode = false;
    wizardStep = 1;
    readonly wizardTotalSteps = 5;
    private displayCurrencyOverridden = false;
    leftPaneWidth = 420;
    private removeResizeListeners: (() => void) | null = null;

    activePreset: string | null = null;
    isCalculating: boolean = false;
    countries: CountryCostData[] = [];
    selectedCountryComparison: CountryPriceComparison | null = null;
    private readonly sectionExpanded: Record<CollapsibleSectionKey, boolean> = {
        starting: false,
        destination: false,
        budgetSearch: false,
        destFilters: false,
        tripParams: false,
        costProfile: false,
    };

    private readonly countryProfiles: Record<string, CountryProfile> = {
        DE: { safety: 'low', tourismDevelopment: 'high' },
        FR: { safety: 'low', tourismDevelopment: 'high' },
        ES: { safety: 'low', tourismDevelopment: 'high' },
        IT: { safety: 'low', tourismDevelopment: 'high' },
        PT: { safety: 'low', tourismDevelopment: 'high' },
        GR: { safety: 'low', tourismDevelopment: 'high' },
        HR: { safety: 'low', tourismDevelopment: 'high' },
        PL: { safety: 'low', tourismDevelopment: 'high' },
        CZ: { safety: 'low', tourismDevelopment: 'high' },
        AT: { safety: 'low', tourismDevelopment: 'high' },
        CH: { safety: 'low', tourismDevelopment: 'high' },
        IS: { safety: 'low', tourismDevelopment: 'high' },
        TH: { safety: 'medium', tourismDevelopment: 'high' },
        JP: { safety: 'low', tourismDevelopment: 'high' },
        ID: { safety: 'medium', tourismDevelopment: 'high' },
        VN: { safety: 'medium', tourismDevelopment: 'medium' },
        IN: { safety: 'medium', tourismDevelopment: 'medium' },
        SG: { safety: 'low', tourismDevelopment: 'high' },
        AE: { safety: 'low', tourismDevelopment: 'high' },
        TR: { safety: 'medium', tourismDevelopment: 'high' },
        US: { safety: 'medium', tourismDevelopment: 'high' },
        MX: { safety: 'medium', tourismDevelopment: 'high' },
        CR: { safety: 'low', tourismDevelopment: 'high' },
        BR: { safety: 'medium', tourismDevelopment: 'high' },
        AR: { safety: 'medium', tourismDevelopment: 'high' },
        CA: { safety: 'low', tourismDevelopment: 'high' },
        PE: { safety: 'medium', tourismDevelopment: 'medium' },
        MA: { safety: 'medium', tourismDevelopment: 'high' },
        ZA: { safety: 'medium', tourismDevelopment: 'high' },
        EG: { safety: 'medium', tourismDevelopment: 'high' },
        KE: { safety: 'medium', tourismDevelopment: 'medium' },
        TZ: { safety: 'medium', tourismDevelopment: 'medium' },
        AU: { safety: 'low', tourismDevelopment: 'high' },
        NZ: { safety: 'low', tourismDevelopment: 'high' },
    };

    readonly fallbackCountries: CountryCostData[] = [
        // Europe
        { code: 'DE', name: 'Germany', nameDE: 'Deutschland', continent: 'Europe', costs: { accommodation: { budget: 30, midrange: 80, luxury: 200 }, food: { budget: 20, midrange: 40, luxury: 80 }, transport: 10, activities: 25, flightFromEU: 80 }, bookingUrl: 'https://www.booking.com/searchresults.html?dest_id=-1784&dest_type=country', skyscannerUrl: 'https://www.skyscanner.de/fluege/de/', airbnbUrl: 'https://www.airbnb.com/s/Germany', getYourGuideUrl: 'https://www.getyourguide.com/germany-l36/' },
        { code: 'FR', name: 'France', nameDE: 'Frankreich', continent: 'Europe', costs: { accommodation: { budget: 35, midrange: 100, luxury: 250 }, food: { budget: 22, midrange: 45, luxury: 90 }, transport: 12, activities: 30, flightFromEU: 80 }, bookingUrl: 'https://www.booking.com/searchresults.html?dest_id=-1454&dest_type=country', skyscannerUrl: 'https://www.skyscanner.de/fluege/fr/', airbnbUrl: 'https://www.airbnb.com/s/France', getYourGuideUrl: 'https://www.getyourguide.com/france-l1/' },
        { code: 'ES', name: 'Spain', nameDE: 'Spanien', continent: 'Europe', costs: { accommodation: { budget: 25, midrange: 75, luxury: 180 }, food: { budget: 18, midrange: 35, luxury: 70 }, transport: 8, activities: 22, flightFromEU: 80 }, bookingUrl: 'https://www.booking.com/searchresults.html?dest_id=-2126&dest_type=country', skyscannerUrl: 'https://www.skyscanner.de/fluege/es/', airbnbUrl: 'https://www.airbnb.com/s/Spain', getYourGuideUrl: 'https://www.getyourguide.com/spain-l1/' },
        { code: 'IT', name: 'Italy', nameDE: 'Italien', continent: 'Europe', costs: { accommodation: { budget: 30, midrange: 90, luxury: 220 }, food: { budget: 20, midrange: 40, luxury: 85 }, transport: 10, activities: 28, flightFromEU: 80 }, bookingUrl: 'https://www.booking.com/searchresults.html?dest_id=-1591&dest_type=country', skyscannerUrl: 'https://www.skyscanner.de/fluege/it/', airbnbUrl: 'https://www.airbnb.com/s/Italy', getYourGuideUrl: 'https://www.getyourguide.com/italy-l93/' },
        { code: 'PT', name: 'Portugal', nameDE: 'Portugal', continent: 'Europe', costs: { accommodation: { budget: 22, midrange: 65, luxury: 160 }, food: { budget: 15, midrange: 30, luxury: 65 }, transport: 7, activities: 18, flightFromEU: 80 }, bookingUrl: 'https://www.booking.com/searchresults.html?dest_id=-1969&dest_type=country', skyscannerUrl: 'https://www.skyscanner.de/fluege/pt/', airbnbUrl: 'https://www.airbnb.com/s/Portugal', getYourGuideUrl: 'https://www.getyourguide.com/portugal-l193/' },
        { code: 'GR', name: 'Greece', nameDE: 'Griechenland', continent: 'Europe', costs: { accommodation: { budget: 22, midrange: 70, luxury: 180 }, food: { budget: 15, midrange: 28, luxury: 60 }, transport: 7, activities: 20, flightFromEU: 100 }, bookingUrl: 'https://www.booking.com/searchresults.html?dest_id=-1521&dest_type=country', skyscannerUrl: 'https://www.skyscanner.de/fluege/gr/', airbnbUrl: 'https://www.airbnb.com/s/Greece', getYourGuideUrl: 'https://www.getyourguide.com/greece-l54/' },
        { code: 'HR', name: 'Croatia', nameDE: 'Kroatien', continent: 'Europe', costs: { accommodation: { budget: 20, midrange: 65, luxury: 160 }, food: { budget: 15, midrange: 28, luxury: 55 }, transport: 7, activities: 18, flightFromEU: 100 }, bookingUrl: 'https://www.booking.com/searchresults.html?dest_id=-89&dest_type=country', skyscannerUrl: 'https://www.skyscanner.de/fluege/hr/', airbnbUrl: 'https://www.airbnb.com/s/Croatia', getYourGuideUrl: 'https://www.getyourguide.com/croatia-l132/' },
        { code: 'PL', name: 'Poland', nameDE: 'Polen', continent: 'Europe', costs: { accommodation: { budget: 15, midrange: 45, luxury: 120 }, food: { budget: 10, midrange: 18, luxury: 40 }, transport: 5, activities: 12, flightFromEU: 80 }, bookingUrl: 'https://www.booking.com/searchresults.html?dest_id=-1956&dest_type=country', skyscannerUrl: 'https://www.skyscanner.de/fluege/pl/', airbnbUrl: 'https://www.airbnb.com/s/Poland', getYourGuideUrl: 'https://www.getyourguide.com/poland-l211/' },
        { code: 'CZ', name: 'Czech Republic', nameDE: 'Tschechien', continent: 'Europe', costs: { accommodation: { budget: 15, midrange: 50, luxury: 130 }, food: { budget: 10, midrange: 18, luxury: 40 }, transport: 4, activities: 12, flightFromEU: 80 }, bookingUrl: 'https://www.booking.com/searchresults.html?dest_id=-1092&dest_type=country', skyscannerUrl: 'https://www.skyscanner.de/fluege/cz/', airbnbUrl: 'https://www.airbnb.com/s/Czech-Republic', getYourGuideUrl: 'https://www.getyourguide.com/czech-republic-l104/' },
        { code: 'AT', name: 'Austria', nameDE: '\u00d6sterreich', continent: 'Europe', costs: { accommodation: { budget: 28, midrange: 80, luxury: 200 }, food: { budget: 18, midrange: 35, luxury: 75 }, transport: 10, activities: 25, flightFromEU: 80 }, bookingUrl: 'https://www.booking.com/searchresults.html?dest_id=-1587&dest_type=country', skyscannerUrl: 'https://www.skyscanner.de/fluege/at/', airbnbUrl: 'https://www.airbnb.com/s/Austria', getYourGuideUrl: 'https://www.getyourguide.com/austria-l73/' },
        { code: 'CH', name: 'Switzerland', nameDE: 'Schweiz', continent: 'Europe', costs: { accommodation: { budget: 50, midrange: 150, luxury: 350 }, food: { budget: 30, midrange: 60, luxury: 120 }, transport: 20, activities: 40, flightFromEU: 80 }, bookingUrl: 'https://www.booking.com/searchresults.html?dest_id=-2168&dest_type=country', skyscannerUrl: 'https://www.skyscanner.de/fluege/ch/', airbnbUrl: 'https://www.airbnb.com/s/Switzerland', getYourGuideUrl: 'https://www.getyourguide.com/switzerland-l178/' },
        { code: 'IS', name: 'Iceland', nameDE: 'Island', continent: 'Europe', costs: { accommodation: { budget: 45, midrange: 130, luxury: 300 }, food: { budget: 30, midrange: 55, luxury: 110 }, transport: 20, activities: 50, flightFromEU: 180 }, bookingUrl: 'https://www.booking.com/searchresults.html?dest_id=-139137&dest_type=country', skyscannerUrl: 'https://www.skyscanner.de/fluege/is/', airbnbUrl: 'https://www.airbnb.com/s/Iceland', getYourGuideUrl: 'https://www.getyourguide.com/iceland-l191/' },

        // Asia
        { code: 'TH', name: 'Thailand', nameDE: 'Thailand', continent: 'Asia', costs: { accommodation: { budget: 12, midrange: 40, luxury: 120 }, food: { budget: 8, midrange: 18, luxury: 40 }, transport: 5, activities: 15, flightFromEU: 550 }, bookingUrl: 'https://www.booking.com/searchresults.html?dest_id=-3247&dest_type=country', skyscannerUrl: 'https://www.skyscanner.de/fluege/th/', airbnbUrl: 'https://www.airbnb.com/s/Thailand', getYourGuideUrl: 'https://www.getyourguide.com/thailand-l87/' },
        { code: 'JP', name: 'Japan', nameDE: 'Japan', continent: 'Asia', costs: { accommodation: { budget: 25, midrange: 80, luxury: 220 }, food: { budget: 15, midrange: 30, luxury: 70 }, transport: 12, activities: 25, flightFromEU: 700 }, bookingUrl: 'https://www.booking.com/searchresults.html?dest_id=-246227&dest_type=country', skyscannerUrl: 'https://www.skyscanner.de/fluege/jp/', airbnbUrl: 'https://www.airbnb.com/s/Japan', getYourGuideUrl: 'https://www.getyourguide.com/japan-l115/' },
        { code: 'ID', name: 'Indonesia (Bali)', nameDE: 'Indonesien (Bali)', continent: 'Asia', costs: { accommodation: { budget: 15, midrange: 45, luxury: 130 }, food: { budget: 7, midrange: 15, luxury: 35 }, transport: 5, activities: 15, flightFromEU: 650 }, bookingUrl: 'https://www.booking.com/searchresults.html?dest_id=-1440&dest_type=country', skyscannerUrl: 'https://www.skyscanner.de/fluege/id/', airbnbUrl: 'https://www.airbnb.com/s/Bali--Indonesia', getYourGuideUrl: 'https://www.getyourguide.com/bali-l67/' },
        { code: 'VN', name: 'Vietnam', nameDE: 'Vietnam', continent: 'Asia', costs: { accommodation: { budget: 10, midrange: 35, luxury: 100 }, food: { budget: 6, midrange: 12, luxury: 30 }, transport: 4, activities: 12, flightFromEU: 600 }, bookingUrl: 'https://www.booking.com/searchresults.html?dest_id=-3386&dest_type=country', skyscannerUrl: 'https://www.skyscanner.de/fluege/vn/', airbnbUrl: 'https://www.airbnb.com/s/Vietnam', getYourGuideUrl: 'https://www.getyourguide.com/vietnam-l190/' },
        { code: 'IN', name: 'India', nameDE: 'Indien', continent: 'Asia', costs: { accommodation: { budget: 10, midrange: 35, luxury: 100 }, food: { budget: 5, midrange: 12, luxury: 30 }, transport: 4, activities: 12, flightFromEU: 550 }, bookingUrl: 'https://www.booking.com/searchresults.html?dest_id=-2092950&dest_type=country', skyscannerUrl: 'https://www.skyscanner.de/fluege/in/', airbnbUrl: 'https://www.airbnb.com/s/India', getYourGuideUrl: 'https://www.getyourguide.com/india-l126/' },
        { code: 'SG', name: 'Singapore', nameDE: 'Singapur', continent: 'Asia', costs: { accommodation: { budget: 35, midrange: 120, luxury: 300 }, food: { budget: 10, midrange: 25, luxury: 60 }, transport: 8, activities: 30, flightFromEU: 650 }, bookingUrl: 'https://www.booking.com/searchresults.html?dest_id=-73635&dest_type=city', skyscannerUrl: 'https://www.skyscanner.de/fluege/sg/', airbnbUrl: 'https://www.airbnb.com/s/Singapore', getYourGuideUrl: 'https://www.getyourguide.com/singapore-l6/' },
        { code: 'AE', name: 'Dubai / UAE', nameDE: 'Dubai / VAE', continent: 'Asia', costs: { accommodation: { budget: 40, midrange: 130, luxury: 400 }, food: { budget: 18, midrange: 40, luxury: 100 }, transport: 12, activities: 45, flightFromEU: 350 }, bookingUrl: 'https://www.booking.com/searchresults.html?dest_id=-782831&dest_type=city', skyscannerUrl: 'https://www.skyscanner.de/fluege/ae/', airbnbUrl: 'https://www.airbnb.com/s/Dubai--United-Arab-Emirates', getYourGuideUrl: 'https://www.getyourguide.com/dubai-l539/' },
        { code: 'TR', name: 'Turkey', nameDE: 'T\u00fcrkei', continent: 'Asia', costs: { accommodation: { budget: 15, midrange: 50, luxury: 130 }, food: { budget: 8, midrange: 18, luxury: 40 }, transport: 5, activities: 15, flightFromEU: 150 }, bookingUrl: 'https://www.booking.com/searchresults.html?dest_id=-3245&dest_type=country', skyscannerUrl: 'https://www.skyscanner.de/fluege/tr/', airbnbUrl: 'https://www.airbnb.com/s/Turkey', getYourGuideUrl: 'https://www.getyourguide.com/turkey-l76/' },

        // Americas
        { code: 'US', name: 'USA', nameDE: 'USA', continent: 'Americas', costs: { accommodation: { budget: 40, midrange: 120, luxury: 300 }, food: { budget: 20, midrange: 40, luxury: 90 }, transport: 15, activities: 35, flightFromEU: 450 }, bookingUrl: 'https://www.booking.com/searchresults.html?dest_id=-3752&dest_type=country', skyscannerUrl: 'https://www.skyscanner.de/fluege/us/', airbnbUrl: 'https://www.airbnb.com/s/United-States', getYourGuideUrl: 'https://www.getyourguide.com/united-states-l28/' },
        { code: 'MX', name: 'Mexico', nameDE: 'Mexiko', continent: 'Americas', costs: { accommodation: { budget: 18, midrange: 60, luxury: 150 }, food: { budget: 10, midrange: 22, luxury: 50 }, transport: 6, activities: 20, flightFromEU: 500 }, bookingUrl: 'https://www.booking.com/searchresults.html?dest_id=-2887&dest_type=country', skyscannerUrl: 'https://www.skyscanner.de/fluege/mx/', airbnbUrl: 'https://www.airbnb.com/s/Mexico', getYourGuideUrl: 'https://www.getyourguide.com/mexico-l71/' },
        { code: 'CR', name: 'Costa Rica', nameDE: 'Costa Rica', continent: 'Americas', costs: { accommodation: { budget: 20, midrange: 65, luxury: 180 }, food: { budget: 12, midrange: 25, luxury: 55 }, transport: 8, activities: 30, flightFromEU: 650 }, bookingUrl: 'https://www.booking.com/searchresults.html?dest_id=-1087&dest_type=country', skyscannerUrl: 'https://www.skyscanner.de/fluege/cr/', airbnbUrl: 'https://www.airbnb.com/s/Costa-Rica', getYourGuideUrl: 'https://www.getyourguide.com/costa-rica-l77/' },
        { code: 'BR', name: 'Brazil', nameDE: 'Brasilien', continent: 'Americas', costs: { accommodation: { budget: 18, midrange: 55, luxury: 150 }, food: { budget: 10, midrange: 20, luxury: 50 }, transport: 5, activities: 20, flightFromEU: 650 }, bookingUrl: 'https://www.booking.com/searchresults.html?dest_id=-672&dest_type=country', skyscannerUrl: 'https://www.skyscanner.de/fluege/br/', airbnbUrl: 'https://www.airbnb.com/s/Brazil', getYourGuideUrl: 'https://www.getyourguide.com/brazil-l87/' },
        { code: 'AR', name: 'Argentina', nameDE: 'Argentinien', continent: 'Americas', costs: { accommodation: { budget: 15, midrange: 50, luxury: 130 }, food: { budget: 8, midrange: 18, luxury: 45 }, transport: 4, activities: 15, flightFromEU: 700 }, bookingUrl: 'https://www.booking.com/searchresults.html?dest_id=-603&dest_type=country', skyscannerUrl: 'https://www.skyscanner.de/fluege/ar/', airbnbUrl: 'https://www.airbnb.com/s/Argentina', getYourGuideUrl: 'https://www.getyourguide.com/argentina-l57/' },
        { code: 'CA', name: 'Canada', nameDE: 'Kanada', continent: 'Americas', costs: { accommodation: { budget: 35, midrange: 100, luxury: 250 }, food: { budget: 20, midrange: 38, luxury: 80 }, transport: 12, activities: 30, flightFromEU: 500 }, bookingUrl: 'https://www.booking.com/searchresults.html?dest_id=-731&dest_type=country', skyscannerUrl: 'https://www.skyscanner.de/fluege/ca/', airbnbUrl: 'https://www.airbnb.com/s/Canada', getYourGuideUrl: 'https://www.getyourguide.com/canada-l36/' },
        { code: 'PE', name: 'Peru', nameDE: 'Peru', continent: 'Americas', costs: { accommodation: { budget: 15, midrange: 45, luxury: 120 }, food: { budget: 8, midrange: 16, luxury: 40 }, transport: 5, activities: 25, flightFromEU: 700 }, bookingUrl: 'https://www.booking.com/searchresults.html?dest_id=-1969&dest_type=country', skyscannerUrl: 'https://www.skyscanner.de/fluege/pe/', airbnbUrl: 'https://www.airbnb.com/s/Peru', getYourGuideUrl: 'https://www.getyourguide.com/peru-l82/' },

        // Africa
        { code: 'MA', name: 'Morocco', nameDE: 'Marokko', continent: 'Africa', costs: { accommodation: { budget: 15, midrange: 50, luxury: 130 }, food: { budget: 8, midrange: 16, luxury: 35 }, transport: 5, activities: 18, flightFromEU: 150 }, bookingUrl: 'https://www.booking.com/searchresults.html?dest_id=-38&dest_type=country', skyscannerUrl: 'https://www.skyscanner.de/fluege/ma/', airbnbUrl: 'https://www.airbnb.com/s/Morocco', getYourGuideUrl: 'https://www.getyourguide.com/morocco-l30/' },
        { code: 'ZA', name: 'South Africa', nameDE: 'S\u00fcdafrika', continent: 'Africa', costs: { accommodation: { budget: 20, midrange: 60, luxury: 160 }, food: { budget: 10, midrange: 20, luxury: 50 }, transport: 8, activities: 30, flightFromEU: 600 }, bookingUrl: 'https://www.booking.com/searchresults.html?dest_id=-2094&dest_type=country', skyscannerUrl: 'https://www.skyscanner.de/fluege/za/', airbnbUrl: 'https://www.airbnb.com/s/South-Africa', getYourGuideUrl: 'https://www.getyourguide.com/south-africa-l133/' },
        { code: 'EG', name: 'Egypt', nameDE: '\u00c4gypten', continent: 'Africa', costs: { accommodation: { budget: 12, midrange: 40, luxury: 110 }, food: { budget: 6, midrange: 14, luxury: 35 }, transport: 4, activities: 15, flightFromEU: 250 }, bookingUrl: 'https://www.booking.com/searchresults.html?dest_id=-1408&dest_type=country', skyscannerUrl: 'https://www.skyscanner.de/fluege/eg/', airbnbUrl: 'https://www.airbnb.com/s/Egypt', getYourGuideUrl: 'https://www.getyourguide.com/egypt-l37/' },
        { code: 'KE', name: 'Kenya', nameDE: 'Kenia', continent: 'Africa', costs: { accommodation: { budget: 20, midrange: 70, luxury: 200 }, food: { budget: 8, midrange: 18, luxury: 40 }, transport: 6, activities: 50, flightFromEU: 550 }, bookingUrl: 'https://www.booking.com/searchresults.html?dest_id=-1599&dest_type=country', skyscannerUrl: 'https://www.skyscanner.de/fluege/ke/', airbnbUrl: 'https://www.airbnb.com/s/Kenya', getYourGuideUrl: 'https://www.getyourguide.com/kenya-l177/' },
        { code: 'TZ', name: 'Tanzania', nameDE: 'Tansania', continent: 'Africa', costs: { accommodation: { budget: 20, midrange: 75, luxury: 220 }, food: { budget: 8, midrange: 18, luxury: 45 }, transport: 8, activities: 60, flightFromEU: 600 }, bookingUrl: 'https://www.booking.com/searchresults.html?dest_id=-3247&dest_type=country', skyscannerUrl: 'https://www.skyscanner.de/fluege/tz/', airbnbUrl: 'https://www.airbnb.com/s/Tanzania', getYourGuideUrl: 'https://www.getyourguide.com/tanzania-l155/' },

        // Oceania
        { code: 'AU', name: 'Australia', nameDE: 'Australien', continent: 'Oceania', costs: { accommodation: { budget: 35, midrange: 100, luxury: 260 }, food: { budget: 20, midrange: 38, luxury: 80 }, transport: 12, activities: 35, flightFromEU: 900 }, bookingUrl: 'https://www.booking.com/searchresults.html?dest_id=-600&dest_type=country', skyscannerUrl: 'https://www.skyscanner.de/fluege/au/', airbnbUrl: 'https://www.airbnb.com/s/Australia', getYourGuideUrl: 'https://www.getyourguide.com/australia-l14/' },
        { code: 'NZ', name: 'New Zealand', nameDE: 'Neuseeland', continent: 'Oceania', costs: { accommodation: { budget: 30, midrange: 90, luxury: 230 }, food: { budget: 18, midrange: 35, luxury: 75 }, transport: 12, activities: 35, flightFromEU: 1100 }, bookingUrl: 'https://www.booking.com/searchresults.html?dest_id=-1944&dest_type=country', skyscannerUrl: 'https://www.skyscanner.de/fluege/nz/', airbnbUrl: 'https://www.airbnb.com/s/New-Zealand', getYourGuideUrl: 'https://www.getyourguide.com/new-zealand-l148/' },
    ];

    get continents(): string[] {
        return [...new Set(this.countries.map(c => c.continent))].sort();
    }

    get availableContinentFilters(): string[] {
        return ['all', ...this.continents];
    }

    readonly presets: TripPreset[] = [
        { key: 'backpacker', labelKey: 'calcPresetBackpacker', descKey: 'calcPresetBackpackerDesc', icon: 'backpacker', accommodationType: 'budget', travelStyle: 'budget', includeFlight: true, includeActivities: false, suggestedDuration: 14 },
        { key: 'comfort', labelKey: 'calcPresetComfort', descKey: 'calcPresetComfortDesc', icon: 'comfort', accommodationType: 'midrange', travelStyle: 'midrange', includeFlight: true, includeActivities: true, suggestedDuration: 10 },
        { key: 'luxury', labelKey: 'calcPresetLuxury', descKey: 'calcPresetLuxuryDesc', icon: 'luxury', accommodationType: 'luxury', travelStyle: 'luxury', includeFlight: true, includeActivities: true, suggestedDuration: 7 },
        { key: 'family', labelKey: 'calcPresetFamily', descKey: 'calcPresetFamilyDesc', icon: 'family', accommodationType: 'midrange', travelStyle: 'midrange', includeFlight: true, includeActivities: true, suggestedDuration: 10 },
        { key: 'adventure', labelKey: 'calcPresetAdventure', descKey: 'calcPresetAdventureDesc', icon: 'adventure', accommodationType: 'budget', travelStyle: 'midrange', includeFlight: true, includeActivities: true, suggestedDuration: 14 },
    ];

    readonly currencyOptions: Array<{ code: DisplayCurrency; label: string }> = [
        { code: 'USD', label: 'USD ($)' },
        { code: 'EUR', label: 'EUR (€)' },
        { code: 'GBP', label: 'GBP (£)' },
        { code: 'CHF', label: 'CHF (CHF)' },
        { code: 'CAD', label: 'CAD (C$)' },
        { code: 'AUD', label: 'AUD (A$)' },
        { code: 'JPY', label: 'JPY (¥)' },
    ];

    readonly travelMonths: number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

    private readonly exchangeRates: Record<DisplayCurrency, number> = {
        USD: 1,
        EUR: 0.92,
        GBP: 0.79,
        CHF: 0.88,
        CAD: 1.35,
        AUD: 1.52,
        JPY: 148.2,
    };

    private readonly countryCurrencyByCode: Record<string, string> = {
        DE: 'EUR', FR: 'EUR', ES: 'EUR', IT: 'EUR', PT: 'EUR', GR: 'EUR', HR: 'EUR', AT: 'EUR',
        PL: 'PLN', CZ: 'CZK', CH: 'CHF', IS: 'ISK', TH: 'THB', JP: 'JPY', ID: 'IDR', VN: 'VND',
        IN: 'INR', SG: 'SGD', AE: 'AED', TR: 'TRY', US: 'USD', MX: 'MXN', CR: 'CRC', BR: 'BRL',
        AR: 'ARS', CA: 'CAD', PE: 'PEN', MA: 'MAD', ZA: 'ZAR', EG: 'EGP', KE: 'KES', TZ: 'TZS',
        AU: 'AUD', NZ: 'NZD'
    };

    readonly countryInsights: Record<string, CountryInsight> = {
        'DE': { flagEmoji: '', currency: 'EUR', bestTime: 'May - Sep', bestTimeDE: 'Mai - Sep', savingTip: 'Use the Deutschlandticket for unlimited local travel.', savingTipDE: 'Mit dem Deutschlandticket unbegrenzt Nahverkehr nutzen.' },
        'FR': { flagEmoji: '', currency: 'EUR', bestTime: 'Apr - Jun, Sep - Oct', bestTimeDE: 'Apr - Jun, Sep - Okt', savingTip: 'Visit museums on the first Sunday of each month, many are free.', savingTipDE: 'Am ersten Sonntag im Monat sind viele Museen kostenlos.' },
        'ES': { flagEmoji: '', currency: 'EUR', bestTime: 'Mar - May, Sep - Nov', bestTimeDE: 'März - Mai, Sep - Nov', savingTip: 'Many tapas bars include small snacks with drinks.', savingTipDE: 'Viele Tapas-Bars bieten kleine Snacks zum Getränk.' },
        'IT': { flagEmoji: '', currency: 'EUR', bestTime: 'Apr - Jun, Sep - Oct', bestTimeDE: 'Apr - Jun, Sep - Okt', savingTip: 'Lunch menus are often cheaper than dinner menus.', savingTipDE: 'Mittagsmenüs sind oft günstiger als Abendkarten.' },
        'PT': { flagEmoji: '', currency: 'EUR', bestTime: 'Apr - Oct', bestTimeDE: 'Apr - Okt', savingTip: 'Look for local daily specials at neighborhood restaurants.', savingTipDE: 'Lokale Tagesmenues in Nachbarschaftsrestaurants nutzen.' },
        'GR': { flagEmoji: '', currency: 'EUR', bestTime: 'Apr - Jun, Sep - Oct', bestTimeDE: 'Apr - Jun, Sep - Okt', savingTip: 'Travel in shoulder season for lower hotel rates.', savingTipDE: 'In der Nebensaison reisen für niedrigere Hotelpreise.' },
        'HR': { flagEmoji: '', currency: 'EUR', bestTime: 'May - Jun, Sep', bestTimeDE: 'Mai - Jun, Sep', savingTip: 'Base on the mainland and do island day trips.', savingTipDE: 'Auf dem Festland wohnen und Inseln per Tagestour besuchen.' },
        'PL': { flagEmoji: '', currency: 'PLN', bestTime: 'May - Sep', bestTimeDE: 'Mai - Sep', savingTip: 'Poland offers very good value in major cities.', savingTipDE: 'Polen bietet in großen Städten ein sehr gutes Preisniveau.' },
        'CZ': { flagEmoji: '', currency: 'CZK', bestTime: 'Apr - Oct', bestTimeDE: 'Apr - Okt', savingTip: 'Eat one or two streets away from city-center hotspots.', savingTipDE: 'Zum Essen ein bis zwei Strassen vom Zentrum weggehen.' },
        'AT': { flagEmoji: '', currency: 'EUR', bestTime: 'Jun - Sep, Dec', bestTimeDE: 'Jun - Sep, Dez', savingTip: 'City cards can reduce transport and attraction costs.', savingTipDE: 'City Cards können Transport- und Eintrittskosten senken.' },
        'CH': { flagEmoji: '', currency: 'CHF', bestTime: 'Jun - Sep', bestTimeDE: 'Jun - Sep', savingTip: 'Self-catering helps a lot in high-cost destinations.', savingTipDE: 'Selbstverpflegung hilft stark in Hochpreisländern.' },
        'IS': { flagEmoji: '', currency: 'ISK', bestTime: 'Jun - Aug', bestTimeDE: 'Jun - Aug', savingTip: 'Grocery shopping can save a lot compared to restaurants.', savingTipDE: 'Einkaufen im Supermarkt spart viel gegenüber Restaurants.' },
        'TH': { flagEmoji: '', currency: 'THB', bestTime: 'Nov - Feb', bestTimeDE: 'Nov - Feb', savingTip: 'Street food is usually fresh and budget-friendly.', savingTipDE: 'Streetfood ist meist frisch und sehr budgetfreundlich.' },
        'JP': { flagEmoji: '', currency: 'JPY', bestTime: 'Mar - May, Oct - Nov', bestTimeDE: 'März - Mai, Okt - Nov', savingTip: 'Regional rail passes can be excellent value.', savingTipDE: 'Regionale Bahnpässe können sehr günstig sein.' },
        'ID': { flagEmoji: '', currency: 'IDR', bestTime: 'Apr - Oct', bestTimeDE: 'Apr - Okt', savingTip: 'Scooter rental is often cheaper than frequent taxis.', savingTipDE: 'Rollermiete ist oft günstiger als häufige Taxifahrten.' },
        'VN': { flagEmoji: '', currency: 'VND', bestTime: 'Nov - Apr', bestTimeDE: 'Nov - Apr', savingTip: 'Night buses and trains can lower accommodation spend.', savingTipDE: 'Nachtbusse und Züge können Unterkunftskosten senken.' },
        'IN': { flagEmoji: '', currency: 'INR', bestTime: 'Oct - Mar', bestTimeDE: 'Okt - März', savingTip: 'Train travel is a very low-cost option for long routes.', savingTipDE: 'Zugreisen sind für lange Strecken meist sehr günstig.' },
        'SG': { flagEmoji: '', currency: 'SGD', bestTime: 'Feb - Apr', bestTimeDE: 'Feb - Apr', savingTip: 'Hawker centers provide affordable meals with strong quality.', savingTipDE: 'Hawker Centers bieten günstige Mahlzeiten mit guter Qualität.' },
        'AE': { flagEmoji: '', currency: 'AED', bestTime: 'Nov - Mar', bestTimeDE: 'Nov - März', savingTip: 'Book tours online early to secure discounts.', savingTipDE: 'Touren früh online buchen, um Rabatte zu sichern.' },
        'TR': { flagEmoji: '', currency: 'TRY', bestTime: 'Apr - Jun, Sep - Oct', bestTimeDE: 'Apr - Jun, Sep - Okt', savingTip: 'Avoid restaurants right next to major attractions.', savingTipDE: 'Restaurants direkt an Sehenswürdigkeiten eher meiden.' },
        'US': { flagEmoji: '', currency: 'USD', bestTime: 'Sep - Nov', bestTimeDE: 'Sep - Nov', savingTip: 'National park passes can cut multi-stop roadtrip costs.', savingTipDE: 'Nationalpark-Paesse senken Kosten bei mehreren Stopps.' },
        'MX': { flagEmoji: '', currency: 'MXN', bestTime: 'Nov - Apr', bestTimeDE: 'Nov - Apr', savingTip: 'Local lunch spots often beat tourist pricing.', savingTipDE: 'Lokale Mittagslokale sind oft günstiger als Touristenorte.' },
        'CR': { flagEmoji: '', currency: 'CRC', bestTime: 'Dec - Apr', bestTimeDE: 'Dez - Apr', savingTip: 'Shared shuttles are cheaper than private transfers.', savingTipDE: 'Geteilte Shuttles sind günstiger als Privattransfers.' },
        'BR': { flagEmoji: '', currency: 'BRL', bestTime: 'Mar - May, Sep - Nov', bestTimeDE: 'März - Mai, Sep - Nov', savingTip: 'Long-distance buses can significantly lower transport costs.', savingTipDE: 'Fernbusse senken die Transportkosten deutlich.' },
        'AR': { flagEmoji: '', currency: 'ARS', bestTime: 'Oct - Nov, Mar - Apr', bestTimeDE: 'Okt - Nov, März - Apr', savingTip: 'Set lunch menus can provide better value than dinner.', savingTipDE: 'Mittagsmenüs bieten oft ein besseres Preis-Leistungs-Verhältnis.' },
        'CA': { flagEmoji: '', currency: 'CAD', bestTime: 'Jun - Sep', bestTimeDE: 'Jun - Sep', savingTip: 'Campervan trips combine transport and accommodation.', savingTipDE: 'Campervan-Reisen kombinieren Transport und Unterkunft.' },
        'PE': { flagEmoji: '', currency: 'PEN', bestTime: 'May - Oct', bestTimeDE: 'Mai - Okt', savingTip: 'Popular attractions are much cheaper when booked early.', savingTipDE: 'Beliebte Attraktionen sind früh gebucht meist deutlich günstiger.' },
        'MA': { flagEmoji: '', currency: 'MAD', bestTime: 'Mar - May, Sep - Nov', bestTimeDE: 'März - Mai, Sep - Nov', savingTip: 'Negotiation is expected in many markets.', savingTipDE: 'In vielen Märkten ist Verhandeln üblich.' },
        'ZA': { flagEmoji: '', currency: 'ZAR', bestTime: 'Apr - Sep', bestTimeDE: 'Apr - Sep', savingTip: 'Self-drive routes can be cheaper than guided tours.', savingTipDE: 'Selbstfahrer-Routen sind oft günstiger als geführte Touren.' },
        'EG': { flagEmoji: '', currency: 'EGP', bestTime: 'Oct - Apr', bestTimeDE: 'Okt - Apr', savingTip: 'Bundled cruise or tour packages often reduce total cost.', savingTipDE: 'Gebündelte Kreuzfahrt- oder Tourpakete sind oft günstiger.' },
        'KE': { flagEmoji: '', currency: 'KES', bestTime: 'Jun - Oct', bestTimeDE: 'Jun - Okt', savingTip: 'Group safaris can drastically reduce per-person pricing.', savingTipDE: 'Gruppen-Safaris senken die Kosten pro Person deutlich.' },
        'TZ': { flagEmoji: '', currency: 'TZS', bestTime: 'Jul - Oct', bestTimeDE: 'Jul - Okt', savingTip: 'Combining nearby countries can improve airfare value.', savingTipDE: 'Die Kombination benachbarter Länder verbessert oft den Flugpreis.' },
        'AU': { flagEmoji: '', currency: 'AUD', bestTime: 'Mar - May, Sep - Nov', bestTimeDE: 'März - Mai, Sep - Nov', savingTip: 'Long stays can lower daily costs through weekly rates.', savingTipDE: 'Längere Aufenthalte senken oft die Tageskosten durch Wochenpreise.' },
        'NZ': { flagEmoji: '', currency: 'NZD', bestTime: 'Dec - Feb', bestTimeDE: 'Dez - Feb', savingTip: 'Campgrounds and holiday parks can reduce lodging spend.', savingTipDE: 'Campgrounds und Holiday Parks senken oft die Unterkunftskosten.' },
    };

    getCountriesByContinent(continent: string, applyFilters: boolean = true): CountryCostData[] {
        let candidates = this.countries.filter(c => c.continent === continent);

        if (applyFilters) {
            candidates = candidates.filter(c => this.matchesCountryFilters(c));
        }

        return candidates.sort((a, b) => (this.currentLanguage === 'de' ? a.nameDE : a.name)
            .localeCompare(this.currentLanguage === 'de' ? b.nameDE : b.name));
    }

    getFilteredCountByContinent(continent: string, applyFilters: boolean = true): number {
        return this.getCountriesByContinent(continent, applyFilters).length;
    }

    getVisibleContinents(applyFilters: boolean = true): string[] {
        return this.continents
            .filter(cont => !applyFilters || this.selectedContinentFilter === 'all' || cont === this.selectedContinentFilter)
            .filter(cont => this.getFilteredCountByContinent(cont, applyFilters) > 0);
    }

    getOriginVisibleContinents(): string[] {
        return this.getVisibleContinents(false);
    }

    getOriginCountriesByContinent(continent: string): CountryCostData[] {
        return this.getCountriesByContinent(continent, false);
    }

    getCountrySafety(country: CountryCostData): SafetyLevel {
        if (country.safety) {
            return country.safety;
        }
        return this.resolveCountryProfile(country).safety;
    }

    getCountryTourismDevelopment(country: CountryCostData): TourismDevelopment {
        if (country.tourismDevelopment) {
            return country.tourismDevelopment;
        }
        return this.resolveCountryProfile(country).tourismDevelopment;
    }

    getSafetyLabel(level: SafetyLevel): string {
        if (this.currentLanguage === 'de') {
            if (level === 'low') return 'Niedriges Risiko';
            if (level === 'medium') return 'Mittleres Risiko';
            return 'Hohes Risiko';
        }
        if (level === 'low') return 'Low risk';
        if (level === 'medium') return 'Medium risk';
        return 'High risk';
    }

    getTourismLabel(level: TourismDevelopment): string {
        if (this.currentLanguage === 'de') {
            if (level === 'high') return 'Stark erschlossen';
            if (level === 'medium') return 'Mittel erschlossen';
            return 'Weniger erschlossen';
        }
        if (level === 'high') return 'Highly developed';
        if (level === 'medium') return 'Moderately developed';
        return 'Less developed';
    }

    onCountryFilterChange(): void {
        const hasDestination = this.selectedCountryCode && this.countries
            .some(c => c.code === this.selectedCountryCode && this.matchesCountryFilters(c));

        if (!hasDestination) {
            this.selectedCountryCode = '';
            this.selectedCountry = null;
            this.result = null;
        }
        this.updateSelectedCountryComparison();
        this.cdr.markForCheck();
    }

    toggleWizardMode(enabled: boolean): void {
        this.wizardMode = enabled;
        this.cdr.markForCheck();
    }

    nextWizardStep(): void {
        if (!this.canProceedWizardStep() || this.wizardStep >= this.wizardTotalSteps) {
            return;
        }
        this.wizardStep += 1;
        if (this.wizardStep === this.wizardTotalSteps && this.selectedCountry) {
            this.calculate();
        }
        this.cdr.markForCheck();
    }

    prevWizardStep(): void {
        if (this.wizardStep <= 1) {
            return;
        }
        this.wizardStep -= 1;
        this.cdr.markForCheck();
    }

    goToWizardStep(step: number): void {
        if (step < 1 || step > this.wizardTotalSteps) {
            return;
        }
        this.wizardStep = step;
        this.cdr.markForCheck();
    }

    canProceedWizardStep(): boolean {
        if (this.wizardStep === 1) {
            return !!this.selectedOriginCountryCode;
        }
        if (this.wizardStep === 2) {
            return this.duration > 0 && this.persons > 0;
        }
        return true;
    }

    getWizardStepLabel(step: number): string {
        const de = ['Ziele', 'Reisedaten', 'Budgetsuche', 'Reisestil', 'Ergebnis'];
        const en = ['Destinations', 'Trip details', 'Budget search', 'Travel style', 'Result'];
        return this.currentLanguage === 'de' ? de[step - 1] : en[step - 1];
    }

    resetCountryFilters(): void {
        this.selectedContinentFilter = 'all';
        this.selectedSafetyFilter = 'all';
        this.selectedTourismFilter = 'all';
        this.cdr.markForCheck();
    }

    get currentInsight(): CountryInsight | null {
        if (!this.selectedCountryCode) return null;
        const base = this.countryInsights[this.selectedCountryCode] ?? null;
        if (!base) {
            const country = this.countries.find(c => c.code === this.selectedCountryCode);
            if (!country) return null;
            return {
                flagEmoji: this.getFallbackFlagEmoji(this.selectedCountryCode),
                currency: this.getCountryCurrency(country),
                bestTime: this.getDefaultBestTimeByContinent(country.continent),
                bestTimeDE: this.getDefaultBestTimeByContinentDE(country.continent),
                savingTip: 'Travel in shoulder season and compare accommodation locations before booking.',
                savingTipDE: 'Reise in der Nebensaison und vergleiche Unterkünfte nach Lage vor der Buchung.'
            };
        }
        const selectedCountry = this.countries.find(c => c.code === this.selectedCountryCode) ?? null;
        return {
            ...base,
            flagEmoji: this.getFallbackFlagEmoji(this.selectedCountryCode),
            currency: selectedCountry ? this.getCountryCurrency(selectedCountry) : base.currency
        };
    }

    private getDefaultBestTimeByContinent(continent: string): string {
        const map: Record<string, string> = {
            Europe: 'May - Sep',
            Asia: 'Nov - Mar',
            Africa: 'Oct - Apr',
            Americas: 'Apr - Oct',
            Oceania: 'Dec - Mar'
        };
        return map[continent] ?? 'Year-round';
    }

    private getDefaultBestTimeByContinentDE(continent: string): string {
        const map: Record<string, string> = {
            Europe: 'Mai - Sep',
            Asia: 'Nov - März',
            Africa: 'Okt - Apr',
            Americas: 'Apr - Okt',
            Oceania: 'Dez - März'
        };
        return map[continent] ?? 'Ganzjährig';
    }

    get selectedOriginCountry(): CountryCostData | null {
        if (!this.selectedOriginCountryCode) return null;
        return this.countries.find(c => c.code === this.selectedOriginCountryCode) ?? null;
    }

    private readonly countryPhotoCache = new Map<string, string>();
    private readonly countryPhotoLoading = new Set<string>();
    private autoCalcTimer: ReturnType<typeof setTimeout> | null = null;

    constructor(
        private languageService: LanguageService,
        private metaService: MetaService,
        private cdr: ChangeDetectorRef,
        private http: HttpClient
    ) { }

    startColumnResize(event: MouseEvent): void {
        if (window.matchMedia('(max-width: 960px)').matches) {
            return;
        }

        event.preventDefault();

        const minWidth = 320;
        const currentTarget = event.currentTarget as HTMLElement | null;
        const layout = currentTarget?.closest('.calc-layout') as HTMLElement | null;
        const layoutWidth = layout?.getBoundingClientRect().width ?? window.innerWidth;
        const maxWidth = Math.max(minWidth + 80, Math.floor(layoutWidth - 360));
        const startX = event.clientX;
        const startWidth = this.leftPaneWidth;

        const previousCursor = document.body.style.cursor;
        const previousUserSelect = document.body.style.userSelect;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';

        const onMouseMove = (moveEvent: MouseEvent) => {
            const deltaX = moveEvent.clientX - startX;
            const nextWidth = Math.max(minWidth, Math.min(maxWidth, startWidth + deltaX));
            this.leftPaneWidth = nextWidth;
            this.cdr.markForCheck();
        };

        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            document.body.style.cursor = previousCursor;
            document.body.style.userSelect = previousUserSelect;
            this.removeResizeListeners = null;
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
        this.removeResizeListeners = onMouseUp;
    }

    ngOnDestroy(): void {
        if (this.removeResizeListeners) {
            this.removeResizeListeners();
        }
        if (this.autoCalcTimer !== null) {
            clearTimeout(this.autoCalcTimer);
        }
    }

    ngOnInit(): void {
        this.countries = [...this.fallbackCountries];
        this.currentLanguage = this.languageService.getCurrentLanguage();
        this.updateSeo();
        void this.initializeCountriesFromApis();
        this.languageService.language$.subscribe(lang => {
            this.currentLanguage = lang;
            this.updateSeo();
            this.cdr.markForCheck();
        });
    }

    private async initializeCountriesFromApis(): Promise<void> {
        const cacheKey = 'travel-budget-country-costs-v1';
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
            try {
                const parsed = JSON.parse(cached) as CountryCostData[];
                if (Array.isArray(parsed) && parsed.length >= 180) {
                    this.countries = parsed;
                    this.syncStateAfterCountryReload();
                    this.cdr.markForCheck();
                }
            } catch {
                // Ignore invalid cache and continue with API loading.
            }
        }

        try {
            const [restRes, worldBankRes] = await Promise.all([
                fetch(this.getRestCountriesApiUrl()),
                fetch('https://api.worldbank.org/v2/country/all/indicator/NY.GDP.PCAP.PP.CD?format=json&per_page=20000')
            ]);

            if (!restRes.ok || !worldBankRes.ok) {
                throw new Error('Free API request failed.');
            }

            const restCountries = (await restRes.json()) as RestCountryApi[];
            const worldBankPayload = (await worldBankRes.json()) as unknown;
            const gdpByIso3 = this.extractGdpByIso3(worldBankPayload);
            const generated = this.buildCountryDataFromApis(restCountries, gdpByIso3);

            if (generated.length >= 180) {
                this.countries = generated;
                localStorage.setItem(cacheKey, JSON.stringify(generated));
                this.syncStateAfterCountryReload();
                this.cdr.markForCheck();
            }
        } catch {
            // Keep fallback data if free APIs are unavailable.
        }
    }

    private getRestCountriesApiUrl(): string {
        const endpoint = 'v3.1/all?fields=cca2,name,translations,region,latlng,currencies';
        const host = typeof window !== 'undefined' ? window.location.hostname : '';
        const isLocalDev = host === 'localhost' || host === '127.0.0.1';
        return isLocalDev ? `/api/restcountries/${endpoint}` : `https://restcountries.com/${endpoint}`;
    }

    private extractGdpByIso3(payload: unknown): Record<string, number> {
        if (!Array.isArray(payload) || payload.length < 2 || !Array.isArray(payload[1])) {
            return {};
        }

        const entries = payload[1] as WorldBankIndicatorEntry[];
        const gdpByIso3: Record<string, number> = {};

        for (const entry of entries) {
            const iso3 = entry.countryiso3code?.toUpperCase();
            const value = entry.value;
            if (!iso3 || iso3.length !== 3 || typeof value !== 'number' || value <= 0) {
                continue;
            }

            if (!gdpByIso3[iso3]) {
                gdpByIso3[iso3] = value;
            }
        }

        return gdpByIso3;
    }

    private buildCountryDataFromApis(restCountries: RestCountryApi[], gdpByIso3: Record<string, number>): CountryCostData[] {
        const regionMap: Record<string, string> = {
            Europe: 'Europe',
            Asia: 'Asia',
            Africa: 'Africa',
            Americas: 'Americas',
            Oceania: 'Oceania',
            Antarctic: 'Oceania'
        };

        const fallbackByCode = new Map(this.fallbackCountries.map(c => [c.code, c]));
        const fallbackByName = new Map(this.fallbackCountries.map(c => [c.name, c]));
        const gdpValues = Object.values(gdpByIso3).filter(v => v > 0).sort((a, b) => a - b);
        const medianGdp = gdpValues.length ? gdpValues[Math.floor(gdpValues.length / 2)] : 25000;

        return restCountries
            .filter(c => c.cca2 && c.cca2.length === 2 && c.name?.common)
            .map(country => {
                const code = country.cca2!.toUpperCase();
                const name = country.name!.common!.trim();
                const nameDE = country.translations?.deu?.common?.trim() || name;
                const continent = country.region && regionMap[country.region] ? regionMap[country.region] : 'Europe';
                const currencyCode = country.currencies ? Object.keys(country.currencies)[0]?.toUpperCase() : undefined;

                const fallback = fallbackByCode.get(code) || fallbackByName.get(name);
                const gdpFactor = this.getCountryCostFactor(code, gdpByIso3, medianGdp);
                const continentFactor = this.getContinentCostFactor(continent);
                const factor = Math.max(0.45, Math.min(2.8, gdpFactor * continentFactor));
                const reachability = this.getCountryReachability(continent, code, gdpByIso3, medianGdp);
                const hasGeo = Array.isArray(country.latlng) && country.latlng.length >= 2;

                const costs = fallback?.costs ?? {
                    accommodation: {
                        budget: Math.max(9, Math.round(16 * factor)),
                        midrange: Math.max(24, Math.round(48 * factor)),
                        luxury: Math.max(60, Math.round(135 * factor)),
                    },
                    food: {
                        budget: Math.max(6, Math.round(8 * factor)),
                        midrange: Math.max(10, Math.round(18 * factor)),
                        luxury: Math.max(24, Math.round(42 * factor)),
                    },
                    transport: Math.max(3, Math.round(5 * factor)),
                    activities: Math.max(8, Math.round(16 * factor)),
                    flightFromEU: this.getBaseFlightCostForContinent(continent),
                };

                const encodedName = encodeURIComponent(name);
                return {
                    code,
                    name,
                    nameDE,
                    continent,
                    currency: fallback?.currency || currencyCode || this.getCurrencyCodeForCountry(code),
                    costs,
                    bookingUrl: fallback?.bookingUrl || `https://www.booking.com/searchresults.html?ss=${encodedName}`,
                    skyscannerUrl: fallback?.skyscannerUrl || `https://www.skyscanner.de/fluege/${code.toLowerCase()}/`,
                    airbnbUrl: fallback?.airbnbUrl || `https://www.airbnb.com/s/${encodedName}`,
                    getYourGuideUrl: fallback?.getYourGuideUrl || `https://www.getyourguide.com/s/?q=${encodedName}`,
                    geo: hasGeo
                        ? {
                            lat: country.latlng![0],
                            lon: country.latlng![1],
                            reachability,
                        }
                        : undefined,
                } satisfies CountryCostData;
            })
            .sort((a, b) => a.name.localeCompare(b.name));
    }

    private getCountryCostFactor(iso2Code: string, gdpByIso3: Record<string, number>, medianGdp: number): number {
        const fallback = this.fallbackCountries.find(c => c.code === iso2Code);
        if (fallback) {
            return Math.max(0.45, Math.min(2.8, fallback.costs.accommodation.midrange / 55));
        }

        const iso3 = this.iso2ToIso3(iso2Code);
        const gdp = (iso3 && gdpByIso3[iso3]) ? gdpByIso3[iso3] : medianGdp;
        return Math.pow(gdp / medianGdp, 0.52);
    }

    private getContinentCostFactor(continent: string): number {
        const factors: Record<string, number> = {
            Europe: 1.06,
            Asia: 0.93,
            Africa: 0.85,
            Americas: 1,
            Oceania: 1.16,
        };
        return factors[continent] ?? 1;
    }

    private getBaseFlightCostForContinent(continent: string): number {
        const base: Record<string, number> = {
            Europe: 90,
            Asia: 600,
            Africa: 420,
            Americas: 560,
            Oceania: 980,
        };
        return base[continent] ?? 520;
    }

    private syncStateAfterCountryReload(): void {
        if (!this.countries.some(c => c.code === this.selectedOriginCountryCode)) {
            this.selectedOriginCountryCode = '';
        }

        if (this.selectedCountryCode && !this.countries.some(c => c.code === this.selectedCountryCode)) {
            this.selectedCountryCode = '';
            this.selectedCountry = null;
            this.result = null;
        } else {
            this.selectedCountry = this.countries.find(c => c.code === this.selectedCountryCode) ?? null;
        }

        if (this.reverseSearchPerformed) {
            this.findDestinationsByBudget();
        }
    }

    private iso2ToIso3(iso2: string): string | null {
        const map: Record<string, string> = {
            AD: 'AND', AE: 'ARE', AF: 'AFG', AG: 'ATG', AL: 'ALB', AM: 'ARM', AO: 'AGO', AR: 'ARG', AT: 'AUT', AU: 'AUS', AZ: 'AZE',
            BA: 'BIH', BB: 'BRB', BD: 'BGD', BE: 'BEL', BF: 'BFA', BG: 'BGR', BH: 'BHR', BI: 'BDI', BJ: 'BEN', BN: 'BRN', BO: 'BOL',
            BR: 'BRA', BS: 'BHS', BT: 'BTN', BW: 'BWA', BY: 'BLR', BZ: 'BLZ', CA: 'CAN', CD: 'COD', CF: 'CAF', CG: 'COG', CH: 'CHE',
            CI: 'CIV', CL: 'CHL', CM: 'CMR', CN: 'CHN', CO: 'COL', CR: 'CRI', CU: 'CUB', CV: 'CPV', CY: 'CYP', CZ: 'CZE', DE: 'DEU',
            DJ: 'DJI', DK: 'DNK', DM: 'DMA', DO: 'DOM', DZ: 'DZA', EC: 'ECU', EE: 'EST', EG: 'EGY', ER: 'ERI', ES: 'ESP', ET: 'ETH',
            FI: 'FIN', FJ: 'FJI', FM: 'FSM', FR: 'FRA', GA: 'GAB', GB: 'GBR', GD: 'GRD', GE: 'GEO', GH: 'GHA', GM: 'GMB', GN: 'GIN',
            GQ: 'GNQ', GR: 'GRC', GT: 'GTM', GW: 'GNB', GY: 'GUY', HN: 'HND', HR: 'HRV', HT: 'HTI', HU: 'HUN', ID: 'IDN', IE: 'IRL',
            IL: 'ISR', IN: 'IND', IQ: 'IRQ', IR: 'IRN', IS: 'ISL', IT: 'ITA', JM: 'JAM', JO: 'JOR', JP: 'JPN', KE: 'KEN', KG: 'KGZ',
            KH: 'KHM', KI: 'KIR', KM: 'COM', KN: 'KNA', KR: 'KOR', KW: 'KWT', KZ: 'KAZ', LA: 'LAO', LB: 'LBN', LC: 'LCA', LI: 'LIE',
            LK: 'LKA', LR: 'LBR', LS: 'LSO', LT: 'LTU', LU: 'LUX', LV: 'LVA', LY: 'LBY', MA: 'MAR', MD: 'MDA', ME: 'MNE', MG: 'MDG',
            MH: 'MHL', MK: 'MKD', ML: 'MLI', MM: 'MMR', MN: 'MNG', MR: 'MRT', MT: 'MLT', MU: 'MUS', MV: 'MDV', MW: 'MWI', MX: 'MEX',
            MY: 'MYS', MZ: 'MOZ', NA: 'NAM', NE: 'NER', NG: 'NGA', NI: 'NIC', NL: 'NLD', NO: 'NOR', NP: 'NPL', NR: 'NRU', NZ: 'NZL',
            OM: 'OMN', PA: 'PAN', PE: 'PER', PG: 'PNG', PH: 'PHL', PK: 'PAK', PL: 'POL', PT: 'PRT', PW: 'PLW', PY: 'PRY', QA: 'QAT',
            RO: 'ROU', RS: 'SRB', RU: 'RUS', RW: 'RWA', SA: 'SAU', SB: 'SLB', SC: 'SYC', SD: 'SDN', SE: 'SWE', SG: 'SGP', SI: 'SVN',
            SK: 'SVK', SL: 'SLE', SM: 'SMR', SN: 'SEN', SO: 'SOM', SR: 'SUR', ST: 'STP', SV: 'SLV', SY: 'SYR', SZ: 'SWZ', TD: 'TCD',
            TG: 'TGO', TH: 'THA', TJ: 'TJK', TL: 'TLS', TM: 'TKM', TN: 'TUN', TO: 'TON', TR: 'TUR', TT: 'TTO', TV: 'TUV', TZ: 'TZA',
            UA: 'UKR', UG: 'UGA', US: 'USA', UY: 'URY', UZ: 'UZB', VC: 'VCT', VE: 'VEN', VN: 'VNM', VU: 'VUT', WS: 'WSM', YE: 'YEM',
            ZA: 'ZAF', ZM: 'ZMB', ZW: 'ZWE'
        };
        return map[iso2.toUpperCase()] ?? null;
    }

    private updateSeo(): void {
        const isGerman = this.currentLanguage === 'de';
        const title = isGerman
            ? 'Reisebudget-Rechner 2026: Flüge, Hotels & Tageskosten weltweit planen | Christian Böhme'
            : 'Travel Budget Calculator 2026: Plan Flights, Hotels & Daily Costs Worldwide | Christian Boehme';
        const description = isGerman
            ? 'Reisebudget für über 180 Länder weltweit berechnen – Flüge, Unterkunft, Essen, Transport und Aktivitäten nach Reisestil, Saison, Startland und Sicherheitspuffer. Kostenlos, ohne Anmeldung.'
            : 'Plan your travel budget for 180+ countries worldwide. Calculate flights, accommodation, food, transport and activities by travel style, season, origin country and safety buffer. Free, no sign-up required.';
        const keywords = isGerman
            ? 'Reisebudget Rechner, Reisekosten berechnen, Urlaubsbudget planen, Flugkosten schätzen, Hotelkosten weltweit, Tageskosten Reise, Reiseplaner kostenlos'
            : 'travel budget calculator, travel cost estimator, trip budget planner, flight cost calculator, hotel cost by country, daily travel costs, free travel planner';

        this.metaService.updateSEO(
            {
                title,
                description,
                keywords,
                url: 'https://www.christian-boehme.com/travel-budget-calculator',
                type: 'website'
            },
            [
                {
                    '@context': 'https://schema.org',
                    '@type': 'WebApplication',
                    name: isGerman ? 'Reisebudget-Rechner' : 'Travel Budget Calculator',
                    applicationCategory: 'TravelApplication',
                    operatingSystem: 'Any',
                    isAccessibleForFree: true,
                    url: 'https://www.christian-boehme.com/travel-budget-calculator',
                    description,
                    offers: {
                        '@type': 'Offer',
                        price: '0',
                        priceCurrency: 'USD',
                        shippingDetails: {
                            '@type': 'OfferShippingDetails',
                            shippingRate: {
                                '@type': 'MonetaryAmount',
                                value: '0',
                                currency: 'USD'
                            }
                        },
                        hasMerchantReturnPolicy: {
                            '@type': 'MerchantReturnPolicy',
                            returnPolicyCategory: 'https://schema.org/MerchantReturnNotPermitted'
                        }
                    },
                    featureList: isGerman
                        ? [
                            'Startland für realistischere Flugschätzung',
                            'Währungsumschaltung für die Anzeige',
                            'Sicherheitspuffer für Nebenkosten',
                            'Budget-Vergleich für mehrere Reiseniveaus'
                        ]
                        : [
                            'Departure country for more realistic flight estimates',
                            'Display currency switching',
                            'Safety buffer for extra costs',
                            'Budget comparison across multiple travel tiers'
                        ]
                },
                {
                    '@context': 'https://schema.org',
                    '@type': 'FAQPage',
                    mainEntity: [
                        {
                            '@type': 'Question',
                            name: this.t('calcFaq1Q'),
                            acceptedAnswer: {
                                '@type': 'Answer',
                                text: this.t('calcFaq1A')
                            }
                        },
                        {
                            '@type': 'Question',
                            name: this.t('calcFaq2Q'),
                            acceptedAnswer: {
                                '@type': 'Answer',
                                text: this.t('calcFaq2A')
                            }
                        },
                        {
                            '@type': 'Question',
                            name: this.t('calcFaq3Q'),
                            acceptedAnswer: {
                                '@type': 'Answer',
                                text: this.t('calcFaq3A')
                            }
                        },
                        {
                            '@type': 'Question',
                            name: this.t('calcFaq4Q'),
                            acceptedAnswer: {
                                '@type': 'Answer',
                                text: this.t('calcFaq4A')
                            }
                        }
                    ]
                },
                {
                    '@context': 'https://schema.org',
                    '@type': 'HowTo',
                    name: isGerman ? 'Reisekosten Schritt für Schritt ermitteln' : 'Calculate travel costs step by step',
                    description: isGerman
                        ? 'Geführter Reisebudget-Prozess mit Zielwahl, Reisedaten, Stil und klarer Endübersicht.'
                        : 'Guided travel budget process with destination, trip details, style and a clear final summary.',
                    step: [
                        {
                            '@type': 'HowToStep',
                            name: isGerman ? 'Ziel und Startland wählen' : 'Choose destination and origin',
                            text: isGerman
                                ? 'Filtere Länder nach Kontinent, Sicherheit und Erschlossenheit und wähle dein Ziel.'
                                : 'Filter countries by continent, safety and tourism development and select your destination.'
                        },
                        {
                            '@type': 'HowToStep',
                            name: isGerman ? 'Reisedaten festlegen' : 'Set trip details',
                            text: isGerman
                                ? 'Definiere Dauer, Personen und Reisemonat; die Saison wird automatisch abgeleitet.'
                                : 'Set duration, number of travelers and travel month; season is derived automatically.'
                        },
                        {
                            '@type': 'HowToStep',
                            name: isGerman ? 'Budgetoptionen prüfen' : 'Review budget options',
                            text: isGerman
                                ? 'Nutze die Budgetsuche für passende Ziele im verfügbaren Rahmen.'
                                : 'Use budget search to find matching destinations within your budget.'
                        },
                        {
                            '@type': 'HowToStep',
                            name: isGerman ? 'Reisestil bestimmen' : 'Select travel style',
                            text: isGerman
                                ? 'Lege Unterkunft, Stil, Aktivitäten und Fluganteil fest.'
                                : 'Set accommodation level, style, activities and flight inclusion.'
                        },
                        {
                            '@type': 'HowToStep',
                            name: isGerman ? 'Klare Gesamtauswertung erhalten' : 'Get a clear final summary',
                            text: isGerman
                                ? 'Erhalte Gesamtkosten, Tageskosten und Kostentreiber als finale Übersicht.'
                                : 'Review total, daily cost and key cost drivers in a final summary.'
                        }
                    ]
                }
            ]
        );
    }

    t(key: string): string {
        return this.languageService.getTranslation(key);
    }

    getCountryLabel(c: CountryCostData): string {
        return this.currentLanguage === 'de' ? c.nameDE : c.name;
    }

    onCountryChange(): void {
        this.selectedCountry = this.countries.find(c => c.code === this.selectedCountryCode) ?? null;
        this.result = null;
        if (this.selectedCountry) {
            this.bufferPercentage = this.getRecommendedBufferPercentage(this.selectedCountry);
        }
        this.updateSelectedCountryComparison();
        if (!this.wizardMode && this.selectedCountry) {
            this.calculate();
        }
        this.cdr.markForCheck();
    }

    onOriginCountryChange(): void {
        if (!this.displayCurrencyOverridden) {
            this.selectedCurrency = this.getPreferredDisplayCurrencyForCountry(this.selectedOriginCountryCode);
        }
        this.updateSelectedCountryComparison();
        this.refreshEstimate();
    }

    onDisplayCurrencyChange(): void {
        this.displayCurrencyOverridden = true;
        this.cdr.markForCheck();
    }

    private getPreferredDisplayCurrencyForCountry(countryCode: string): DisplayCurrency {
        const local = this.getCurrencyCodeForCountry(countryCode);
        const supported: DisplayCurrency[] = ['USD', 'EUR', 'GBP', 'CHF', 'CAD', 'AUD', 'JPY'];
        if (supported.includes(local as DisplayCurrency)) {
            return local as DisplayCurrency;
        }
        return 'USD';
    }

    applyPreset(preset: TripPreset): void {
        this.activePreset = preset.key;
        this.accommodationType = preset.accommodationType;
        this.travelStyle = preset.travelStyle;
        this.includeFlight = true;
        this.includeActivities = true;
        this.duration = preset.suggestedDuration;
        if (this.selectedCountryCode) {
            this.calculate();
        }
        this.cdr.markForCheck();
    }

    getPresetIcon(key: string): string {
        const icons: Record<string, string> = {
            backpacker: '&#127890;',
            comfort: '&#129703;',
            luxury: '&#128142;',
            family: '&#128104;&#8205;&#128105;&#8205;&#128103;&#8205;&#128102;',
            adventure: '&#129495;'
        };
        return icons[key] ?? '&#9992;&#65039;';
    }

    getContinentLabel(cont: string): string {
        const labels: Record<string, string> = {
            'Europe': this.currentLanguage === 'de' ? 'Europa' : 'Europe',
            'Asia': this.currentLanguage === 'de' ? 'Asien' : 'Asia',
            'Americas': this.currentLanguage === 'de' ? 'Amerika' : 'Americas',
            'Africa': this.currentLanguage === 'de' ? 'Afrika' : 'Africa',
            'Oceania': this.currentLanguage === 'de' ? 'Ozeanien' : 'Oceania',
        };
        return labels[cont] ?? cont;
    }

    getCountryInsightFlag(code: string): string {
        return this.getFallbackFlagEmoji(code);
    }

    getFlagApiUrl(code: string): string {
        const normalized = code?.toLowerCase();
        if (!normalized || normalized.length !== 2) {
            return '';
        }
        // flagcdn.com is a free flag CDN for country flag assets.
        return `https://flagcdn.com/24x18/${normalized}.png`;
    }

    onFlagImageError(code: string): void {
        if (!code || code.length !== 2) {
            return;
        }
        this.brokenFlagCodes.add(code.toUpperCase());
        this.cdr.markForCheck();
    }

    shouldUseFallbackFlag(code: string): boolean {
        if (!code || code.length !== 2) {
            return true;
        }
        return this.brokenFlagCodes.has(code.toUpperCase());
    }

    getFallbackFlagEmoji(code: string): string {
        if (!code || code.length !== 2) return '';
        const upper = code.toUpperCase();
        return String.fromCodePoint(127397 + upper.charCodeAt(0), 127397 + upper.charCodeAt(1));
    }

    getConvertedAmount(amount: number): number {
        return amount * this.exchangeRates[this.selectedCurrency];
    }

    formatCurrency(amount: number): string {
        const locale = this.currentLanguage === 'de' ? 'de-DE' : 'en-US';
        return new Intl.NumberFormat(locale, {
            style: 'currency',
            currency: this.selectedCurrency,
            maximumFractionDigits: 0,
        }).format(this.getConvertedAmount(amount));
    }

    getDisplayCurrencyHelperText(): string {
        return this.currentLanguage === 'de'
            ? `Anzeige in ${this.selectedCurrency}. Basiswerte werden intern in USD kalkuliert.`
            : `Displayed in ${this.selectedCurrency}. Base modelling remains in USD.`;
    }

    formatDisplayCurrencyAmount(amount: number): string {
        const locale = this.currentLanguage === 'de' ? 'de-DE' : 'en-US';
        return new Intl.NumberFormat(locale, {
            style: 'currency',
            currency: this.selectedCurrency,
            maximumFractionDigits: 0,
        }).format(amount);
    }

    getCountryCurrency(country: CountryCostData): string {
        if (country.currency) {
            return country.currency;
        }
        return this.getCurrencyCodeForCountry(country.code);
    }

    refreshEstimate(): void {
        this.updateSelectedCountryComparison();
        if (this.selectedCountry && this.selectedOriginCountryCode) {
            this.scheduleAutoCalc();
            return;
        }
        this.cdr.markForCheck();
    }

    scheduleAutoCalc(delay = 350): void {
        if (this.autoCalcTimer !== null) {
            clearTimeout(this.autoCalcTimer);
        }
        this.autoCalcTimer = setTimeout(() => {
            this.autoCalcTimer = null;
            if (this.selectedCountry && this.selectedOriginCountryCode) {
                this.calculate();
            }
        }, delay);
    }

    buildSummaryLink(entry: { country: CountryCostData; total: number }): Record<string, string | number> {
        const est = this.getEstimateForCountry(entry.country);
        return {
            c: entry.country.code,
            o: this.selectedOriginCountryCode,
            n: this.currentLanguage === 'de' ? entry.country.nameDE : entry.country.name,
            cont: this.getContinentLabel(entry.country.continent),
            d: this.duration,
            p: this.persons,
            cur: this.selectedCurrency,
            buf: this.bufferPercentage,
            acc: est.accommodation,
            food: est.food,
            trans: est.transport,
            acts: est.activities,
            fl: est.flight,
            sub: est.subtotal,
            bufamt: est.buffer,
            total: est.grandTotal,
            pp: est.totalPerPerson,
            ppd: est.dailyPerPerson,
        };
    }

    onTravelMonthChange(): void {
        this.refreshEstimate();
    }

    getSafetyBufferRecommendation(): string {
        if (!this.selectedCountry) {
            return this.currentLanguage === 'de'
                ? 'Empfehlung erscheint nach Auswahl eines Ziellandes.'
                : 'Recommendation appears after selecting a destination.';
        }

        const recommended = this.getRecommendedBufferPercentage(this.selectedCountry);
        const risk = this.getCountrySafety(this.selectedCountry);

        if (this.currentLanguage === 'de') {
            const riskLabel = risk === 'low' ? 'niedrigem Risiko' : risk === 'medium' ? 'mittlerem Risiko' : 'höherem Risiko';
            return `Empfohlen: ${recommended}% bei ${riskLabel}.`;
        }

        const riskLabel = risk === 'low' ? 'low risk' : risk === 'medium' ? 'medium risk' : 'higher risk';
        return `Recommended: ${recommended}% for ${riskLabel}.`;
    }

    getAutoTravelMonthHint(): string {
        if (!this.selectedCountry) {
            return this.currentLanguage === 'de'
                ? 'Wenn kein Monat gewählt ist, wird automatisch die günstigste Saison kalkuliert.'
                : 'If no month is selected, the calculator automatically uses the cheapest season.';
        }

        if (this.selectedTravelMonth) {
            return this.currentLanguage === 'de'
                ? 'Monat manuell gewählt.'
                : 'Month selected manually.';
        }

        const month = this.getCheapestTravelMonthForCountry(this.selectedCountry);
        const monthLabel = this.getTravelMonthLabel(month);
        return this.currentLanguage === 'de'
            ? `Automatisch gewählt: ${monthLabel} (günstigster Monat).`
            : `Automatically selected: ${monthLabel} (cheapest month).`;
    }

    getTravelMonthLabel(month: number): string {
        const locale = this.currentLanguage === 'de' ? 'de-DE' : 'en-US';
        return new Intl.DateTimeFormat(locale, { month: 'long' }).format(new Date(2026, month - 1, 1));
    }

    getPriceLevelLabel(country: CountryCostData): string {
        const midrange = country.costs.accommodation.midrange;
        if (midrange < 50) return this.currentLanguage === 'de' ? 'Günstig' : 'Budget';
        if (midrange < 120) return this.currentLanguage === 'de' ? 'Mittel' : 'Moderate';
        return this.currentLanguage === 'de' ? 'Teuer' : 'Expensive';
    }

    getDerivedSeasonLabelForCountry(country: CountryCostData | null): string {
        if (!country) {
            return this.t('calcSeasonUnknown');
        }

        const derived = this.getDerivedSeasonForCountry(country);
        if (derived === 'high') {
            return this.t('calcSeasonHigh');
        }
        if (derived === 'low') {
            return this.t('calcSeasonLow');
        }
        return this.t('calcSeasonShoulder');
    }

    get reverseResultsCount(): number {
        return this.reverseMatches.length;
    }

    isSectionExpanded(key: CollapsibleSectionKey): boolean {
        return this.sectionExpanded[key];
    }

    toggleSection(key: CollapsibleSectionKey): void {
        this.sectionExpanded[key] = !this.sectionExpanded[key];
        this.cdr.markForCheck();
    }

    areAllSectionsExpanded(): boolean {
        return Object.values(this.sectionExpanded).every(value => value);
    }

    toggleAllSections(): void {
        const next = !this.areAllSectionsExpanded();
        (Object.keys(this.sectionExpanded) as CollapsibleSectionKey[]).forEach(key => {
            this.sectionExpanded[key] = next;
        });
        this.cdr.markForCheck();
    }

    onReverseBudgetRangeChange(changed: 'min' | 'max'): void {
        if (changed === 'min' && this.reverseBudgetMin > this.reverseBudgetMax) {
            this.reverseBudgetMax = this.reverseBudgetMin;
        }

        if (changed === 'max' && this.reverseBudgetMax < this.reverseBudgetMin) {
            this.reverseBudgetMin = this.reverseBudgetMax;
        }

        this.reverseBudgetMin = this.clampReverseBudget(this.reverseBudgetMin);
        this.reverseBudgetMax = this.clampReverseBudget(this.reverseBudgetMax);
        this.cdr.markForCheck();
    }

    getReverseBudgetPreviewBuckets(): Array<{ label: string; count: number; heightPercent: number; active: boolean }> {
        const estimates = this.getFilteredCountryEstimateTotalsInDisplayCurrency();
        const domain = this.getReverseBudgetPreviewDomain();
        const bucketCount = 10;
        const span = domain.max - domain.min;
        const bucketSize = Math.max(this.reverseBudgetStep, Math.ceil(span / bucketCount));

        const buckets = Array.from({ length: bucketCount }, (_, index) => {
            const min = domain.min + (index * bucketSize);
            const max = index === bucketCount - 1 ? domain.max : min + bucketSize;
            const count = estimates.filter(total => total >= min && total <= max).length;
            const active = max >= this.reverseBudgetMin && min <= this.reverseBudgetMax;
            const label = `${min}-${max}`;
            return { label, count, min, max, active };
        });

        const maxCount = Math.max(1, ...buckets.map(b => b.count));
        return buckets.map(bucket => ({
            label: bucket.label,
            count: bucket.count,
            active: bucket.active,
            heightPercent: Math.max(12, Math.round((bucket.count / maxCount) * 100)),
        }));
    }

    getReverseBudgetPreviewHitCount(): number {
        return this.getFilteredCountryEstimateTotalsInDisplayCurrency()
            .filter(total => total >= this.reverseBudgetMin && total <= this.reverseBudgetMax)
            .length;
    }

    getTopCheapestCountries(limit = 3): Array<{ country: CountryCostData; total: number }> {
        if (!this.selectedOriginCountryCode) {
            return [];
        }

        return this.countries
            .filter(country => this.matchesCountryFilters(country))
            .map(country => ({ country, total: Math.round(this.getEstimateForCountry(country).grandTotal) }))
            .sort((a, b) => a.total - b.total)
            .slice(0, limit);
    }

    getCountryPhotoUrl(country: CountryCostData): string {
        const key = country.code;
        if (this.countryPhotoCache.has(key)) {
            return this.countryPhotoCache.get(key)!;
        }
        if (!this.countryPhotoLoading.has(key)) {
            this.countryPhotoLoading.add(key);
            const query = `${country.name} travel landscape`;
            const url = `/api/unsplash-proxy.php?query=${encodeURIComponent(query)}&per_page=1`;
            this.http.get<{ results?: Array<{ urls?: { small?: string; regular?: string } }> }>(url).subscribe({
                next: (res) => {
                    const imgUrl = res?.results?.[0]?.urls?.regular ?? res?.results?.[0]?.urls?.small ?? '';
                    if (imgUrl) {
                        this.countryPhotoCache.set(key, imgUrl);
                        this.cdr.markForCheck();
                    }
                    this.countryPhotoLoading.delete(key);
                },
                error: () => {
                    this.countryPhotoLoading.delete(key);
                    const fallback = `https://picsum.photos/seed/${key}/400/250`;
                    this.countryPhotoCache.set(key, fallback);
                    this.cdr.markForCheck();
                }
            });
        }
        return '';
    }

    getCompareRankPercent(comparison: CountryPriceComparison | null): number {
        if (!comparison || comparison.totalCountries <= 0) {
            return 0;
        }
        return Math.max(4, Math.round((comparison.rank / comparison.totalCountries) * 100));
    }

    getReverseBudgetPreviewDomain(): { min: number; max: number } {
        const estimates = this.getFilteredCountryEstimateTotalsInDisplayCurrency();
        if (estimates.length === 0) {
            return { min: this.reverseBudgetFloor, max: this.reverseBudgetCeiling };
        }

        const dataMin = Math.min(...estimates);
        const dataMax = Math.max(...estimates);

        const min = Math.min(this.reverseBudgetFloor, this.reverseBudgetMin, Math.floor(dataMin / 100) * 100);
        const max = Math.max(this.reverseBudgetCeiling, this.reverseBudgetMax, Math.ceil(dataMax / 100) * 100);

        return { min, max };
    }

    findDestinationsByBudget(): void {
        this.reverseSearchPerformed = true;
        this.reverseMatches = [];

        if (this.reverseBudgetMax <= 0 || this.duration <= 0 || this.persons <= 0) {
            this.cdr.markForCheck();
            return;
        }

        const minBudgetUsd = this.reverseBudgetMin / this.exchangeRates[this.selectedCurrency];
        const maxBudgetUsd = this.reverseBudgetMax / this.exchangeRates[this.selectedCurrency];

        this.reverseMatches = this.countries
            .filter(country => this.matchesCountryFilters(country))
            .map(country => {
                const estimate = this.getEstimateForCountry(country);
                return {
                    country,
                    total: Math.round(estimate.grandTotal),
                    perPerson: Math.round(estimate.grandTotal / this.persons),
                    perDayPerPerson: Math.round(estimate.grandTotal / this.duration / this.persons)
                } as ReverseBudgetMatch;
            })
            .filter(match => match.total >= minBudgetUsd && match.total <= maxBudgetUsd)
            .sort((a, b) => a.total - b.total)
            .slice(0, 24);

        this.cdr.markForCheck();
    }

    clearReverseSearch(): void {
        this.reverseSearchPerformed = false;
        this.reverseMatches = [];
        this.cdr.markForCheck();
    }

    selectCountryFromReverse(countryCode: string): void {
        this.selectedCountryCode = countryCode;
        this.onCountryChange();
        this.calculate();
    }

    private getRouteFactor(originContinent: string, destinationContinent: string): number {
        if (originContinent === destinationContinent) {
            const sameContinentFactors: Record<string, number> = {
                Europe: 0.38,
                Asia: 0.45,
                Americas: 0.48,
                Africa: 0.5,
                Oceania: 0.55,
            };
            return sameContinentFactors[originContinent] ?? 0.45;
        }

        const routeKey = [originContinent, destinationContinent].sort().join(':');
        const routeFactors: Record<string, number> = {
            'Africa:Americas': 1.25,
            'Africa:Asia': 0.95,
            'Africa:Europe': 0.85,
            'Africa:Oceania': 1.45,
            'Americas:Asia': 1.35,
            'Americas:Europe': 1.2,
            'Americas:Oceania': 1.4,
            'Asia:Europe': 1,
            'Asia:Oceania': 0.95,
            'Europe:Oceania': 1.6,
        };

        return routeFactors[routeKey] ?? 1.15;
    }

    private getEstimatedFlightCost(destination: CountryCostData, passengers: number): number {
        const origin = this.selectedOriginCountry;
        if (!origin) {
            return destination.costs.flightFromEU * passengers;
        }

        if (origin.code === destination.code) {
            return 0;
        }

        // Primary model: distance and route accessibility.
        if (origin.geo && destination.geo) {
            const distanceKm = this.getDistanceKm(origin.geo.lat, origin.geo.lon, destination.geo.lat, destination.geo.lon);
            const oneWayBase = this.getBaseFareByDistance(distanceKm);
            const reachabilityFactor = this.getReachabilityPriceFactor(origin.geo.reachability, destination.geo.reachability);
            const marketFactor = 1.06;
            const roundTripPerPassenger = Math.round(oneWayBase * 2 * reachabilityFactor * marketFactor);
            return Math.max(0, roundTripPerPassenger * passengers);
        }

        // Fallback model for countries without geocoordinates.
        const referenceCost = Math.max(origin.costs.flightFromEU, destination.costs.flightFromEU);
        const routeFactor = this.getRouteFactor(origin.continent, destination.continent);
        return Math.round(referenceCost * routeFactor * passengers);
    }

    private getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
        const toRad = (deg: number) => deg * (Math.PI / 180);
        const earthRadiusKm = 6371;
        const dLat = toRad(lat2 - lat1);
        const dLon = toRad(lon2 - lon1);
        const a = Math.sin(dLat / 2) ** 2
            + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return earthRadiusKm * c;
    }

    private getBaseFareByDistance(distanceKm: number): number {
        if (distanceKm <= 1200) {
            return 45 + (distanceKm * 0.085);
        }
        if (distanceKm <= 4000) {
            return 90 + (distanceKm * 0.065);
        }
        if (distanceKm <= 9000) {
            return 170 + (distanceKm * 0.055);
        }
        return 260 + (distanceKm * 0.048);
    }

    private getCountryReachability(
        continent: string,
        iso2Code: string,
        gdpByIso3: Record<string, number>,
        medianGdp: number
    ): number {
        const baseByContinent: Record<string, number> = {
            Europe: 1.12,
            Americas: 1.0,
            Asia: 0.94,
            Africa: 0.82,
            Oceania: 0.78,
        };

        const iso3 = this.iso2ToIso3(iso2Code);
        const gdp = (iso3 && gdpByIso3[iso3]) ? gdpByIso3[iso3] : medianGdp;
        const economicConnector = Math.max(0.85, Math.min(1.2, Math.pow(gdp / medianGdp, 0.12)));
        const reachability = (baseByContinent[continent] ?? 0.95) * economicConnector;
        return Math.max(0.55, Math.min(1.35, reachability));
    }

    private getReachabilityPriceFactor(originReachability: number, destinationReachability: number): number {
        const avgReachability = (originReachability + destinationReachability) / 2;
        // Better reachable destinations trend cheaper; remote combinations trend pricier.
        const factor = 1.42 - (avgReachability * 0.44);
        return Math.max(0.78, Math.min(1.35, factor));
    }

    private getOriginDependentLocalCostMultiplier(destination: CountryCostData): number {
        const origin = this.selectedOriginCountry;
        if (!origin || origin.code === destination.code) {
            return 1;
        }

        // If geodata is available, model arrival complexity by distance and connectivity.
        if (origin.geo && destination.geo) {
            const distanceKm = this.getDistanceKm(origin.geo.lat, origin.geo.lon, destination.geo.lat, destination.geo.lon);
            const distanceImpact = Math.min(0.16, (distanceKm / 10000) * 0.16);
            const avgReachability = (origin.geo.reachability + destination.geo.reachability) / 2;
            const connectivityImpact = Math.max(-0.04, Math.min(0.06, (1 - avgReachability) * 0.15));
            const continentImpact = origin.continent === destination.continent ? -0.03 : 0.03;

            return Math.max(0.92, Math.min(1.22, 1 + distanceImpact + connectivityImpact + continentImpact));
        }

        // Fallback without geodata: infer a moderate impact from route complexity.
        const routeFactor = this.getRouteFactor(origin.continent, destination.continent);
        const routeImpact = Math.max(-0.05, Math.min(0.18, (routeFactor - 0.75) * 0.18));
        return Math.max(0.92, Math.min(1.22, 1 + routeImpact));
    }

    private getSeasonCostMultiplier(country: CountryCostData): number {
        const map: Record<TravelSeason, number> = {
            low: 0.9,
            shoulder: 1,
            high: 1.22,
        };
        return map[this.getDerivedSeasonForCountry(country)] ?? 1;
    }

    private getSeasonFlightMultiplier(country: CountryCostData): number {
        const map: Record<TravelSeason, number> = {
            low: 0.92,
            shoulder: 1,
            high: 1.28,
        };
        return map[this.getDerivedSeasonForCountry(country)] ?? 1;
    }

    private getDerivedSeasonForCountry(country: CountryCostData): TravelSeason {
        const month = this.selectedTravelMonth ?? this.getCheapestTravelMonthForCountry(country);
        return this.getDerivedSeasonForCountryByMonth(country, month);
    }

    private getDerivedSeasonForCountryByMonth(country: CountryCostData, month: number): TravelSeason {
        const lat = country.geo?.lat ?? this.getFallbackLatitudeForContinent(country.continent);

        if (Math.abs(lat) < 15) {
            return this.getTropicalSeason(month);
        }

        const northernHemisphere = lat >= 0;
        return this.getTemperateSeason(month, northernHemisphere);
    }

    private getCheapestTravelMonthForCountry(country: CountryCostData): number {
        let cheapestMonth = 1;
        let cheapestScore = Number.POSITIVE_INFINITY;

        for (let month = 1; month <= 12; month += 1) {
            const season = this.getDerivedSeasonForCountryByMonth(country, month);
            const cost = this.getSeasonCostMultiplierBySeason(season);
            const flight = this.getSeasonFlightMultiplierBySeason(season);
            const score = cost + flight;

            if (score < cheapestScore) {
                cheapestScore = score;
                cheapestMonth = month;
            }
        }

        return cheapestMonth;
    }

    private getSeasonCostMultiplierBySeason(season: TravelSeason): number {
        const map: Record<TravelSeason, number> = {
            low: 0.9,
            shoulder: 1,
            high: 1.22,
        };
        return map[season] ?? 1;
    }

    private getSeasonFlightMultiplierBySeason(season: TravelSeason): number {
        const map: Record<TravelSeason, number> = {
            low: 0.92,
            shoulder: 1,
            high: 1.28,
        };
        return map[season] ?? 1;
    }

    private getRecommendedBufferPercentage(country: CountryCostData): number {
        const safety = this.getCountrySafety(country);
        if (safety === 'low') return 10;
        if (safety === 'medium') return 15;
        return 22;
    }

    private getTemperateSeason(month: number, northernHemisphere: boolean): TravelSeason {
        if (northernHemisphere) {
            if ([6, 7, 8].includes(month)) return 'high';
            if ([4, 5, 9, 10].includes(month)) return 'shoulder';
            return 'low';
        }

        if ([12, 1, 2].includes(month)) return 'high';
        if ([3, 4, 10, 11].includes(month)) return 'shoulder';
        return 'low';
    }

    private getTropicalSeason(month: number): TravelSeason {
        if ([12, 1, 2].includes(month)) return 'high';
        if ([6, 7, 8].includes(month)) return 'low';
        return 'shoulder';
    }

    private getFallbackLatitudeForContinent(continent: string): number {
        const latByContinent: Record<string, number> = {
            Europe: 50,
            Asia: 30,
            Americas: 18,
            Africa: 1,
            Oceania: -25,
        };
        return latByContinent[continent] ?? 20;
    }

    private updateSelectedCountryComparison(): void {
        if (!this.selectedCountry) {
            this.selectedCountryComparison = null;
            return;
        }

        const pool = this.countries
            .filter(country => this.matchesCountryFilters(country))
            .map(country => ({ country, total: this.getEstimateForCountry(country).grandTotal }))
            .sort((a, b) => a.total - b.total);

        const selectedIndex = pool.findIndex(item => item.country.code === this.selectedCountry!.code);
        if (selectedIndex === -1) {
            this.selectedCountryComparison = null;
            return;
        }

        const selectedTotal = pool[selectedIndex].total;
        const cheaperAlternatives = pool
            .filter(item => item.total < selectedTotal)
            .slice(-3);
        const pricierAlternatives = pool
            .filter(item => item.total > selectedTotal)
            .slice(0, 3);

        this.selectedCountryComparison = {
            rank: selectedIndex + 1,
            totalCountries: pool.length,
            cheaperCount: selectedIndex,
            expensiveCount: Math.max(0, pool.length - selectedIndex - 1),
            selectedTotal,
            cheaperAlternatives,
            pricierAlternatives,
        };
    }

    private getEstimateForCountry(
        country: CountryCostData,
        forcedStyle?: 'budget' | 'midrange' | 'luxury'
    ): BudgetResult {
        const nights = this.duration;
        const p = this.persons;
        const style = forcedStyle ?? this.travelStyle;
        const accommodationType = forcedStyle ?? this.accommodationType;
        const seasonCostFactor = this.getSeasonCostMultiplier(country);
        const seasonFlightFactor = this.getSeasonFlightMultiplier(country);
        const originLocalMultiplier = this.getOriginDependentLocalCostMultiplier(country);
        const foodOriginAdjustment = 1 + ((originLocalMultiplier - 1) * 0.25);

        const accommodation = Math.round(country.costs.accommodation[accommodationType] * nights * p * seasonCostFactor);
        const food = Math.round(country.costs.food[style] * nights * p * seasonCostFactor * foodOriginAdjustment);
        const transport = Math.round(country.costs.transport * nights * p * seasonCostFactor * originLocalMultiplier);
        const activities = Math.round(country.costs.activities * nights * p * seasonCostFactor * originLocalMultiplier);
        const flight = Math.round(this.getEstimatedFlightCost(country, p) * seasonFlightFactor);

        const subtotal = accommodation + food + transport + activities + flight;
        const buffer = Math.round(subtotal * (this.bufferPercentage / 100));
        const grandTotal = subtotal + buffer;

        return {
            accommodation,
            food,
            transport,
            activities,
            flight,
            subtotal,
            buffer,
            totalPerPerson: Math.round(grandTotal / p),
            grandTotal: Math.round(grandTotal),
            dailyPerPerson: Math.round(grandTotal / nights / p)
        };
    }

    calculate(): void {
        if (!this.selectedCountry || !this.selectedOriginCountryCode) return;
        this.isCalculating = true;
        this.result = null;
        this.cdr.markForCheck();
        setTimeout(() => {
            this.result = this.getEstimateForCountry(this.selectedCountry!);
            this.updateSelectedCountryComparison();
            this.isCalculating = false;
            this.cdr.markForCheck();
        }, 600);
    }

    reset(): void {
        this.selectedCountryCode = '';
        this.selectedOriginCountryCode = '';
        this.selectedCurrency = 'USD';
        this.displayCurrencyOverridden = false;
        this.selectedCountry = null;
        this.result = null;
        this.activePreset = null;
        this.isCalculating = false;
        this.selectedCountryComparison = null;
        this.duration = 7;
        this.persons = 2;
        this.bufferPercentage = 15;
        this.accommodationType = 'midrange';
        this.travelStyle = 'midrange';
        this.includeFlight = true;
        this.includeActivities = true;
        this.reverseBudgetMin = 1500;
        this.reverseBudgetMax = 4000;
        this.selectedTravelMonth = null;
        this.selectedContinentFilter = 'all';
        this.selectedSafetyFilter = 'all';
        this.selectedTourismFilter = 'all';
        this.reverseMatches = [];
        this.reverseSearchPerformed = false;
    }

    getBarWidth(value: number, total: number): string {
        if (!total) return '0%';
        return Math.round((value / total) * 100) + '%';
    }

    openLink(url: string): void {
        window.open(url, '_blank', 'noopener,noreferrer');
    }

    private matchesCountryFilters(country: CountryCostData): boolean {
        if (this.selectedContinentFilter !== 'all' && country.continent !== this.selectedContinentFilter) {
            return false;
        }
        const safety = this.getCountrySafety(country);
        if (this.selectedSafetyFilter !== 'all' && safety !== this.selectedSafetyFilter) {
            return false;
        }
        const tourism = this.getCountryTourismDevelopment(country);
        if (this.selectedTourismFilter !== 'all' && tourism !== this.selectedTourismFilter) {
            return false;
        }
        return true;
    }

    private getFilteredCountryEstimateTotalsInDisplayCurrency(): number[] {
        return this.countries
            .filter(country => this.matchesCountryFilters(country))
            .map(country => this.getEstimateForCountry(country).grandTotal * this.exchangeRates[this.selectedCurrency]);
    }

    private clampReverseBudget(value: number): number {
        if (Number.isNaN(value)) {
            return this.reverseBudgetFloor;
        }
        return Math.min(this.reverseBudgetCeiling, Math.max(this.reverseBudgetFloor, value));
    }

    private resolveCountryProfile(country: CountryCostData): CountryProfile {
        const known = this.countryProfiles[country.code];
        if (known) {
            return known;
        }

        const mid = country.costs.accommodation.midrange;
        const reachability = country.geo?.reachability ?? 0.95;
        const safety: SafetyLevel = reachability >= 1.02 ? 'low' : reachability >= 0.87 ? 'medium' : 'high';

        let tourismDevelopment: TourismDevelopment = 'medium';
        if (mid >= 95 || reachability >= 1.08) {
            tourismDevelopment = 'high';
        } else if (mid <= 45 && reachability < 0.9) {
            tourismDevelopment = 'low';
        }

        return {
            safety,
            tourismDevelopment
        };
    }

    private getCurrencyCodeForCountry(code: string): string {
        if (!code || code.length !== 2) {
            return 'USD';
        }
        return this.countryCurrencyByCode[code.toUpperCase()] ?? 'USD';
    }
}
