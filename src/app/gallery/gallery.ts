import { Component, OnInit, HostListener, ChangeDetectorRef, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { ManifestService } from './manifest.service';
import { LanguageService, Language } from '../language.service';
import { MetaService } from '../services/meta.service';
import { ShopService } from '../shop/shop.service';
import { ShopCart } from '../shop/shop-cart';
import { Counters } from '../homepage/counters/counters';

interface GalleryImage {
    id: number;
    url: string;
    title: string;
    titleDE?: string;
    category: 'Aviation' | 'Travel' | 'All';
    continent: string;
    country: string;
    description: string;
    fileName: string;
    fileNameDE?: string;
    path: string;
}

interface ImageManifest {
    generated: string;
    statistics: {
        totalImages: number;
        aviationPhotos: number;
        travelPhotos: number;
        continents: string[];
        countries: string[];
    };
    images: Array<{
        url: string;
        title: string;
        titleDE?: string;
        category: string;
        continent: string;
        country: string;
        fileName: string;
        path: string;
    }>;
}

@Component({
    selector: 'app-gallery',
    standalone: true,
    imports: [CommonModule, FormsModule, ShopCart, Counters],
    templateUrl: './gallery.html',
    styleUrls: ['./gallery.scss'],
})
export class Gallery implements OnInit {
    images: GalleryImage[] = [];
    filteredImages: GalleryImage[] = [];
    currentLanguage: Language = 'en';

    selectedCategory: string = 'All';
    selectedContinent: string = 'All';
    selectedCountry: string = 'All';
    searchQuery: string = '';
    currentPage: number = 1;
    imagesPerPage: number = 15;

    categories: string[] = ['All', 'Aviation', 'Travel'];
    continents: string[] = [];
    countries: string[] = [];

    // Lightbox Properties
    isLightboxOpen: boolean = false;
    currentLightboxImageIndex: number = 0;
    currentLightboxImage: GalleryImage | null = null;
    allImages: GalleryImage[] = [];
    private pendingQueryParams: any = null;
    isLoading: boolean = true;
    private searchAliases: Record<string, string> = {
        'united arab emirates': 'united arab emirates (uae)',
        'uae': 'united arab emirates (uae)',
        'czechia': 'czech republic'
    };

    // Touch Events for Swipe
    private touchStartX: number = 0;
    private touchEndX: number = 0;

    constructor(
        private route: ActivatedRoute,
        private http: HttpClient,
        private manifestService: ManifestService,
        private languageService: LanguageService,
        private cdr: ChangeDetectorRef,
        private metaService: MetaService,
        private shopService: ShopService
    ) { }

    ngOnInit() {
        // SEO Meta Tags
        this.metaService.updateSEO(
            {
                title: 'Photography Gallery - Aviation & Travel | Christian Böhme',
                description: 'Browse aviation and travel photography from around the world. High-quality photos from Asia, Europe, America, Africa and Oceania featuring aircraft, landscapes, and travel destinations.',
                image: 'https://www.christian-boehme.com/assets/img/other/Dresden%20Skyline.jpg',
                url: 'https://www.christian-boehme.com/gallery',
                type: 'website'
            },
            {
                "@context": "https://schema.org",
                "@type": "ImageGallery",
                "name": "Aviation & Travel Photography Gallery",
                "description": "Collection of aviation and travel photographs from around the world",
                "author": {
                    "@type": "Person",
                    "name": "Christian Böhme",
                    "url": "https://www.christian-boehme.com"
                },
                "url": "https://www.christian-boehme.com/gallery"
            }
        );

        this.currentLanguage = this.languageService.getCurrentLanguage();
        this.languageService.language$.subscribe((lang) => {
            this.currentLanguage = lang;
            this.cdr.markForCheck();
        });

        // Load images first
        this.loadImages();

        // Subscribe to query params and react to changes
        this.route.queryParams.subscribe(params => {
            this.applyQueryParams(params);
        });
    }

    getTranslation(key: string): string {
        return this.languageService.getTranslation(key);
    }

    private applyQueryParams(params: any) {
        const hasFilter = !!params['filter'];
        const nextCategory = hasFilter
            ? params['filter'] === 'aviation' ? 'Aviation' : params['filter'] === 'travel' ? 'Travel' : 'All'
            : 'All';

        // When navigating with only a search term, reset category/continent/country to All to avoid stale filters
        this.selectedCategory = nextCategory;
        this.selectedContinent = params['continent'] ? params['continent'] : 'All';
        this.selectedCountry = params['country'] ? params['country'] : 'All';
        this.searchQuery = params['search'] ? String(params['search']) : '';

        if (!hasFilter && params['search']) {
            this.selectedCategory = 'All';
            this.selectedContinent = 'All';
            this.selectedCountry = 'All';
        }

        if (this.images.length === 0) {
            // Defer until images are loaded
            this.pendingQueryParams = params;
            return;
        }

        this.updateAvailableFilters();
        this.filterImages();
    }

    @HostListener('document:keydown', ['$event'])
    handleKeyboardEvent(event: KeyboardEvent) {
        if (!this.isLightboxOpen) return;

        switch (event.key.toLowerCase()) {
            case 'a':
            case 'arrowleft':
                event.preventDefault();
                this.previousLightboxImage();
                break;
            case 'd':
            case 'arrowright':
                event.preventDefault();
                this.nextLightboxImage();
                break;
            case 'escape':
                event.preventDefault();
                this.closeLightbox();
                break;
        }
    }

    loadImages() {
        this.isLoading = true;
        this.manifestService.loadManifest()
            .then((manifest) => {
                this.images = manifest.images.map((img, index) => ({
                    id: index + 1,
                    url: img.url,
                    title: this.cleanTitle(img.title),
                    titleDE: img.titleDE,
                    category: img.category as 'Aviation' | 'Travel' | 'All',
                    continent: img.continent,
                    country: img.country,
                    description: `${img.country} - ${img.continent}`,
                    fileName: img.fileName,
                    fileNameDE: img.fileNameDE,
                    path: img.path
                }));

                this.allImages = this.images;
                const qp = this.pendingQueryParams || this.route.snapshot.queryParams || {};
                this.pendingQueryParams = null;
                this.applyQueryParams(qp);
                this.isLoading = false;
            })
            .catch((error) => {
                console.error('Error loading image manifest:', error);
                // Fallback to empty array
                this.images = [];
                this.filterImages();
                this.isLoading = false;
            });
    }

    updateAvailableFilters() {
        // Get available continents based on selected category
        let baseImages = this.images;

        if (this.selectedCategory !== 'All') {
            baseImages = baseImages.filter(img => img.category === this.selectedCategory);
        }

        // Get unique continents
        const continentSet = new Set(baseImages.map(img => img.continent));
        this.continents = Array.from(continentSet).sort();

        // Get available countries based on selected category and continent
        if (this.selectedContinent !== 'All') {
            baseImages = baseImages.filter(img => img.continent === this.selectedContinent);
        }

        // Get unique countries
        const countrySet = new Set(baseImages.map(img => img.country));
        this.countries = Array.from(countrySet).sort();
    }

    cleanTitle(title: string): string {
        // Remove file extension if still present
        let cleaned = title.replace(/\.(jpg|jpeg|png|webp|JPG|JPEG|PNG|WEBP)$/i, '');
        // Trim whitespace
        cleaned = cleaned.trim();
        return cleaned;
    }

    filterImages() {
        this.currentPage = 1;
        const normalize = (s: string) => s.toLowerCase().replace(/[()]/g, '').trim();
        const rawQ = this.searchQuery.trim();
        const aliasQ = this.searchAliases[normalize(rawQ)] || rawQ;
        const q = aliasQ.toLowerCase();

        this.filteredImages = this.images.filter(img => {
            const matchesCategory = this.selectedCategory === 'All' || img.category === this.selectedCategory;
            const matchesContinent = this.selectedContinent === 'All' || img.continent === this.selectedContinent;
            const matchesCountry = this.selectedCountry === 'All' || img.country === this.selectedCountry;
            const matchesSearch =
                q === '' ||
                img.title.toLowerCase().includes(q) ||
                img.country.toLowerCase().includes(q) ||
                img.continent.toLowerCase().includes(q) ||
                img.description.toLowerCase().includes(q) ||
                img.path.toLowerCase().includes(q) ||
                normalize(img.country).includes(normalize(aliasQ)) ||
                normalize(img.title).includes(normalize(aliasQ)) ||
                normalize(img.path).includes(normalize(aliasQ));

            return matchesCategory && matchesContinent && matchesCountry && matchesSearch;
        });

        // Fallback: if search is non-empty and nothing matched, try looser normalization across all images
        if (q !== '' && this.filteredImages.length === 0) {
            const looseQ = normalize(aliasQ).replace(/\s+/g, '');
            this.filteredImages = this.images.filter(img => {
                const normPath = normalize(img.path).replace(/\s+/g, '');
                const normCountry = normalize(img.country).replace(/\s+/g, '');
                const normTitle = normalize(img.title).replace(/\s+/g, '');
                return normPath.includes(looseQ) || normCountry.includes(looseQ) || normTitle.includes(looseQ);
            });
        }
    }

    onCategoryChange(category: string) {
        this.selectedCategory = category;
        this.selectedContinent = 'All';
        this.selectedCountry = 'All';
        this.updateAvailableFilters();
        this.filterImages();
    }

    onContinentChange(continent: string) {
        this.selectedContinent = continent;
        this.selectedCountry = 'All';
        this.updateAvailableFilters();
        this.filterImages();
    }

    onCountryChange(country: string) {
        this.selectedCountry = country;
        this.filterImages();
    }

    resetFilters() {
        this.selectedCategory = 'All';
        this.selectedContinent = 'All';
        this.selectedCountry = 'All';
        this.updateAvailableFilters();
        this.filterImages();
    }

    onSearchChange(query: string) {
        this.searchQuery = query;
        this.filterImages();
    }

    get paginatedImages(): GalleryImage[] {
        const startIndex = (this.currentPage - 1) * this.imagesPerPage;
        return this.filteredImages.slice(startIndex, startIndex + this.imagesPerPage);
    }

    get totalPages(): number {
        return Math.ceil(this.filteredImages.length / this.imagesPerPage);
    }

    get pageNumbers(): number[] {
        const pages: number[] = [];
        for (let i = 1; i <= this.totalPages; i++) {
            pages.push(i);
        }
        return pages;
    }

    goToPage(page: number) {
        if (page >= 1 && page <= this.totalPages) {
            this.currentPage = page;
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }

    previousPage() {
        this.goToPage(this.currentPage - 1);
    }

    nextPage() {
        this.goToPage(this.currentPage + 1);
    }

    addToCart(image: GalleryImage | null) {
        if (!image) return;
        this.shopService.addImageToCart({
            id: String(image.id),
            title: this.getImageTitle(image),
            imageUrl: image.url,
            price: 19,
            currency: 'EUR'
        });
    }

    openLightbox(image: GalleryImage) {
        this.isLightboxOpen = true;
        this.currentLightboxImage = image;
        this.currentLightboxImageIndex = this.filteredImages.findIndex(img => img.id === image.id);
        document.body.style.overflow = 'hidden';
    }

    closeLightbox() {
        this.isLightboxOpen = false;
        this.currentLightboxImage = null;
        document.body.style.overflow = 'auto';
    }

    nextLightboxImage() {
        if (this.currentLightboxImageIndex < this.filteredImages.length - 1) {
            this.currentLightboxImageIndex++;
            this.currentLightboxImage = this.filteredImages[this.currentLightboxImageIndex];
        } else {
            this.currentLightboxImageIndex = 0;
            this.currentLightboxImage = this.filteredImages[0];
        }
    }

    previousLightboxImage() {
        if (this.currentLightboxImageIndex > 0) {
            this.currentLightboxImageIndex--;
            this.currentLightboxImage = this.filteredImages[this.currentLightboxImageIndex];
        } else {
            this.currentLightboxImageIndex = this.filteredImages.length - 1;
            this.currentLightboxImage = this.filteredImages[this.currentLightboxImageIndex];
        }
    }

    // Touch Event Handlers for Swipe Gestures
    onTouchStart(event: TouchEvent) {
        this.touchStartX = event.changedTouches[0].screenX;
    }

    onTouchEnd(event: TouchEvent) {
        this.touchEndX = event.changedTouches[0].screenX;
        this.handleSwipe();
    }

    private handleSwipe() {
        const swipeThreshold = 50; // Minimum distance for a swipe
        const difference = this.touchStartX - this.touchEndX;

        if (Math.abs(difference) > swipeThreshold) {
            if (difference > 0) {
                // Swipe left - next image
                this.nextLightboxImage();
            } else {
                // Swipe right - previous image
                this.previousLightboxImage();
            }
        }
    }

    // Translation functions for continents and countries
    translateContinent(continent: string): string {
        if (this.currentLanguage === 'de') {
            const translations: Record<string, string> = {
                'Africa': 'Afrika',
                'Asia': 'Asien',
                'Australia and Oceania': 'Australien und Ozeanien',
                'Europe': 'Europa',
                'North America': 'Nordamerika',
                'South America': 'Südamerika'
            };
            return translations[continent] || continent;
        }
        return continent;
    }

    translateCountry(country: string): string {
        if (this.currentLanguage === 'de') {
            const translations: Record<string, string> = {
                // Africa
                'Cape Verde': 'Kap Verde',
                'Egypt': 'Ägypten',
                // Asia
                'Indonesia': 'Indonesien',
                'Israel': 'Israel',
                'Malaysia': 'Malaysia',
                'Oman': 'Oman',
                'Philippines': 'Philippinen',
                'Qatar': 'Katar',
                'Singapore': 'Singapur',
                'Thailand': 'Thailand',
                'United Arab Emirates (UAE)': 'Vereinigte Arabische Emirate (VAE)',
                'South Korea': 'Südkorea',
                'Japan': 'Japan',
                'China': 'China',
                'Vietnam': 'Vietnam',
                // Australia and Oceania
                'Australia': 'Australien',
                'Fiji': 'Fidschi',
                'New Zealand': 'Neuseeland',
                // Europe
                'Austria': 'Österreich',
                'Belarus': 'Belarus',
                'Belgium': 'Belgien',
                'Bulgaria': 'Bulgarien',
                'Croatia': 'Kroatien',
                'Czech Republic': 'Tschechien',
                'Denmark': 'Dänemark',
                'England': 'England',
                'Estonia': 'Estland',
                'Finland': 'Finnland',
                'France': 'Frankreich',
                'Germany': 'Deutschland',
                'Greece': 'Griechenland',
                'Hungary': 'Ungarn',
                'Iceland': 'Island',
                'Ireland': 'Irland',
                'Italy': 'Italien',
                'Latvia': 'Lettland',
                'Lithuania': 'Litauen',
                'Luxembourg': 'Luxemburg',
                'Montenegro': 'Montenegro',
                'Netherlands': 'Niederlande',
                'Norway': 'Norwegen',
                'Poland': 'Polen',
                'Portugal': 'Portugal',
                'Romania': 'Rumänien',
                'Russia': 'Russland',
                'Serbia': 'Serbien',
                'Slovakia': 'Slowakei',
                'Slovenia': 'Slowenien',
                'Spain': 'Spanien',
                'Sweden': 'Schweden',
                'Switzerland': 'Schweiz',
                'Turkey': 'Türkei',
                'Ukraine': 'Ukraine',
                'United Kingdom': 'Vereinigtes Königreich',
                'Vatican City': 'Vatikanstadt',
                // North America
                'Canada': 'Kanada',
                'Costa Rica': 'Costa Rica',
                'Dominican Republic': 'Dominikanische Republik',
                'Mexico': 'Mexiko',
                'United States': 'Vereinigte Staaten'
            };
            return translations[country] || country;
        }
        return country;
    }

    translateCategory(category: string): string {
        if (this.currentLanguage === 'de') {
            const translations: Record<string, string> = {
                'Aviation': 'Luftfahrt',
                'Travel': 'Reisen',
                'All': 'Alle'
            };
            return translations[category] || category;
        }
        return category;
    }

    getImageTitle(image: GalleryImage): string {
        if (this.currentLanguage === 'de' && image.titleDE) {
            return image.titleDE;
        }
        return image.title;
    }
}

