import { Component, OnInit, HostListener, ChangeDetectorRef, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ManifestService } from './manifest.service';
import { LanguageService, Language } from '../language.service';
import { MetaService } from '../services/meta.service';
import { ShopService } from '../shop/shop.service';
import { ShopCart } from '../shop/shop-cart';

interface GalleryImage {
    id: number;
    url: string;
    thumbnailUrl: string;
    gridUrl: string;
    originalUrl: string;
    price: number;
    title: string;
    titleDE?: string;
    category: string;
    continent: string;
    country: string;
    subfolders: string[];
    description: string;
    fileName: string;
    fileNameDE?: string;
    path: string;
}

@Component({
    selector: 'app-gallery',
    standalone: true,
    imports: [CommonModule, FormsModule, ShopCart],
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
    selectedSubfolders: string[] = [];
    searchQuery: string = '';
    currentPage: number = 1;
    imagesPerPage: number = 15;

    categories: string[] = ['All'];
    continents: string[] = [];
    countries: string[] = [];
    availableSubfoldersByDepth: string[][] = [];

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
    private searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
    copiedImageId: number | null = null;
    private copiedImageTimer: ReturnType<typeof setTimeout> | null = null;
    @ViewChild('lightboxImg') lightboxImg?: ElementRef<HTMLImageElement>;

    constructor(
        private route: ActivatedRoute,
        private router: Router,
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
        const nextCategory = hasFilter ? this.resolveCategoryFromFilter(String(params['filter'])) : 'All';

        // When navigating with only a search term, reset category/continent/country to All to avoid stale filters
        this.selectedCategory = nextCategory;
        this.selectedContinent = params['continent'] ? params['continent'] : 'All';
        this.selectedCountry = params['country'] ? params['country'] : 'All';
        this.selectedSubfolders = [];
        this.searchQuery = params['search'] ? String(params['search']) : '';

        if (!hasFilter && params['search']) {
            this.selectedCategory = 'All';
            this.selectedContinent = 'All';
            this.selectedCountry = 'All';
            this.selectedSubfolders = [];
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
                    id: img.id > 0 ? img.id : index + 1,
                    url: img.url,
                    thumbnailUrl: img.thumbnailUrl,
                    gridUrl: img.gridUrl,
                    originalUrl: img.originalUrl,
                    price: img.price,
                    title: (img.title || '').trim(),
                    titleDE: img.titleDE?.trim(),
                    category: img.category,
                    continent: img.continent,
                    country: img.country,
                    subfolders: img.subfolders || [],
                    description: `${img.country} - ${img.continent}`,
                    fileName: img.fileName,
                    fileNameDE: img.fileNameDE,
                    path: img.path
                }));

                this.allImages = this.images;
                this.categories = ['All', ...this.getUniqueValues(this.images.map((img) => img.category))];
                const qp = this.pendingQueryParams || this.route.snapshot.queryParams || {};
                this.pendingQueryParams = null;
                this.applyQueryParams(qp);
                this.isLoading = false;
                this.cdr.markForCheck();
            })
            .catch((error) => {
                console.error('Error loading image manifest:', error);
                // Fallback to empty array
                this.images = [];
                this.filterImages();
                this.isLoading = false;
                this.cdr.markForCheck();
            });
    }

    updateAvailableFilters() {
        let baseImages = this.images;

        if (this.selectedCategory !== 'All') {
            baseImages = baseImages.filter(img => img.category === this.selectedCategory);
        }

        this.continents = this.getUniqueValues(baseImages.map(img => img.continent));

        if (this.selectedContinent !== 'All') {
            baseImages = baseImages.filter(img => img.continent === this.selectedContinent);
        }

        this.countries = this.getUniqueValues(baseImages.map(img => img.country));

        if (this.selectedCountry !== 'All') {
            baseImages = baseImages.filter(img => img.country === this.selectedCountry);
        }

        // Compute available subfolder options depth by depth
        this.availableSubfoldersByDepth = [];
        let levelImages = baseImages;

        for (let depth = 0; ; depth++) {
            const available = this.getUniqueValues(
                levelImages.map(img => img.subfolders[depth] || '').filter(s => s !== '')
            );
            if (available.length === 0) break;
            this.availableSubfoldersByDepth.push(available);

            // If user has not selected this depth, stop – no deeper level shown yet
            if (depth >= this.selectedSubfolders.length) break;

            // Filter down for the next depth
            levelImages = levelImages.filter(img => img.subfolders[depth] === this.selectedSubfolders[depth]);
        }
    }

    private resolveCategoryFromFilter(filterValue: string): string {
        const normalizedFilter = this.normalizeFilterValue(filterValue);
        const matchingCategory = this.categories.find(
            (category) => category !== 'All' && this.normalizeFilterValue(category) === normalizedFilter
        );

        return matchingCategory || 'All';
    }

    private normalizeFilterValue(value: string): string {
        return value
            .toLowerCase()
            .replace(/_/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    private getUniqueValues(values: string[]): string[] {
        return Array.from(new Set(values.filter((value) => value && value !== 'Unknown'))).sort();
    }

    cleanTitle(title: string): string {
        // Remove file extension if still present
        let cleaned = title.replace(/\.(jpg|jpeg|png|webp|JPG|JPEG|PNG|WEBP)$/i, '');
        cleaned = cleaned.replace(/_/g, ' ');
        // Trim whitespace
        cleaned = cleaned.trim();
        return cleaned;
    }

    filterImages() {
        this.currentPage = 1;
        const normalize = (s: string) => s
            .toLowerCase()
            .replace(/_/g, ' ')
            .replace(/[()]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
        const rawQ = this.searchQuery.trim();
        const aliasQ = this.searchAliases[normalize(rawQ)] || rawQ;
        const q = normalize(aliasQ);
        const qUnderscore = q.replace(/\s+/g, '_');
        const rawNeedle = aliasQ.toLowerCase().trim();

        this.filteredImages = this.images.filter(img => {
            const matchesCategory = this.selectedCategory === 'All' || img.category === this.selectedCategory;
            const matchesContinent = this.selectedContinent === 'All' || img.continent === this.selectedContinent;
            const matchesCountry = this.selectedCountry === 'All' || img.country === this.selectedCountry;
            const matchesSubfolders = this.selectedSubfolders.every(
                (sel, depth) => img.subfolders[depth] === sel
            );
            const searchFields = [
                img.title,
                img.titleDE || '',
                img.country,
                img.continent,
                img.description,
                img.path,
                img.fileName,
                img.fileNameDE || ''
            ];
            const normalizedHaystack = normalize(searchFields.join(' | '));
            const rawHaystack = searchFields.join(' | ').toLowerCase();
            const matchesSearch =
                q === '' ||
                normalizedHaystack.includes(q) ||
                normalizedHaystack.includes(normalize(rawQ)) ||
                rawHaystack.includes(rawNeedle) ||
                rawHaystack.includes(qUnderscore);

            return matchesCategory && matchesContinent && matchesCountry && matchesSubfolders && matchesSearch;
        });

        // Fallback: if search is non-empty and nothing matched, try looser normalization across all images
        if (q !== '' && this.filteredImages.length === 0) {
            const looseQ = normalize(aliasQ).replace(/\s+/g, '');
            this.filteredImages = this.images.filter(img => {
                const normPath = normalize(img.path).replace(/\s+/g, '');
                const normCountry = normalize(img.country).replace(/\s+/g, '');
                const normTitle = normalize(img.title).replace(/\s+/g, '');
                const normTitleDe = normalize(img.titleDE || '').replace(/\s+/g, '');
                return normPath.includes(looseQ) || normCountry.includes(looseQ) || normTitle.includes(looseQ) || normTitleDe.includes(looseQ);
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
        this.selectedSubfolders = [];
        this.updateAvailableFilters();
        this.filterImages();
    }

    onSubfolderChange(depth: number, value: string) {
        // Trim to this depth and set selection
        this.selectedSubfolders = [...this.selectedSubfolders.slice(0, depth), value];
        this.updateAvailableFilters();
        this.filterImages();
    }

    onSubfolderBreadcrumbClick(depth: number) {
        // Reset back to this depth (keep selections up to but not including depth)
        this.selectedSubfolders = this.selectedSubfolders.slice(0, depth);
        this.updateAvailableFilters();
        this.filterImages();
    }

    resetFilters() {
        this.selectedCategory = 'All';
        this.selectedContinent = 'All';
        this.selectedCountry = 'All';
        this.selectedSubfolders = [];
        this.updateAvailableFilters();
        this.filterImages();
    }

    onSearchChange(query: string) {
        this.searchQuery = query;
        if (this.searchDebounceTimer) clearTimeout(this.searchDebounceTimer);
        this.searchDebounceTimer = setTimeout(() => {
            this.filterImages();
            this.searchDebounceTimer = null;
            this.cdr.markForCheck();
        }, 200);
    }

    clearSearch(): void {
        this.onSearchChange('');
    }

    goToCountryResults(country: string, event?: Event): void {
        event?.stopPropagation();
        const target = (country || '').trim();
        if (!target) {
            return;
        }

        this.router.navigate(['/gallery'], {
            queryParams: {
                search: target
            }
        });
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
        this.addToCartWithAnimation(image);
    }

    addToCartWithAnimation(image: GalleryImage | null, event?: Event) {
        if (!image) return;
        this.shopService.addImageToCart({
            id: String(image.id),
            title: this.getImageTitle(image),
            imageUrl: image.gridUrl || image.url,
            originalImageUrl: image.originalUrl || image.gridUrl || image.url,
            price: image.price,
            currency: 'EUR'
        });

        this.animateItemToCart(event);
    }

    copyImageId(id: number, event?: Event): void {
        event?.stopPropagation();
        const idText = String(id);

        const setCopiedState = () => {
            this.copiedImageId = id;
            if (this.copiedImageTimer) {
                clearTimeout(this.copiedImageTimer);
            }
            this.copiedImageTimer = setTimeout(() => {
                this.copiedImageId = null;
                this.cdr.markForCheck();
            }, 1200);
            this.cdr.markForCheck();
        };

        if (navigator.clipboard?.writeText) {
            navigator.clipboard.writeText(idText)
                .then(() => setCopiedState())
                .catch(() => this.copyImageIdFallback(idText, setCopiedState));
            return;
        }

        this.copyImageIdFallback(idText, setCopiedState);
    }

    private copyImageIdFallback(text: string, onSuccess: () => void): void {
        const input = document.createElement('input');
        input.value = text;
        input.style.position = 'fixed';
        input.style.opacity = '0';
        document.body.appendChild(input);
        input.select();
        const copied = document.execCommand('copy');
        document.body.removeChild(input);
        if (copied) {
            onSuccess();
        }
    }

    private animateItemToCart(event?: Event): void {
        if (!event) {
            return;
        }

        const target = event.currentTarget as HTMLElement | null;
        if (!target) {
            return;
        }

        const cartEl = document.querySelector('.header-cart') as HTMLElement | null;
        if (!cartEl) {
            return;
        }

        const imageElement =
            target.closest('.gallery-item')?.querySelector('.gallery-image') as HTMLImageElement | null
            || target.closest('.lightbox-main')?.querySelector('.lightbox-image') as HTMLImageElement | null;

        if (!imageElement) {
            return;
        }

        const fromRect = imageElement.getBoundingClientRect();
        const toRect = cartEl.getBoundingClientRect();

        const ghost = document.createElement('img');
        ghost.src = imageElement.currentSrc || imageElement.src;
        ghost.alt = '';
        ghost.style.position = 'fixed';
        ghost.style.left = `${fromRect.left}px`;
        ghost.style.top = `${fromRect.top}px`;
        ghost.style.width = `${fromRect.width}px`;
        ghost.style.height = `${fromRect.height}px`;
        ghost.style.objectFit = 'cover';
        ghost.style.borderRadius = '10px';
        ghost.style.pointerEvents = 'none';
        ghost.style.zIndex = '10050';
        ghost.style.boxShadow = '0 16px 30px rgba(15, 23, 42, 0.35)';
        ghost.style.transition = 'transform 520ms cubic-bezier(0.22, 1, 0.36, 1), opacity 520ms ease';

        document.body.appendChild(ghost);

        const translateX = (toRect.left + (toRect.width / 2)) - (fromRect.left + (fromRect.width / 2));
        const translateY = (toRect.top + (toRect.height / 2)) - (fromRect.top + (fromRect.height / 2));
        const scale = Math.max(0.12, Math.min(0.28, toRect.width / fromRect.width));

        requestAnimationFrame(() => {
            ghost.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
            ghost.style.opacity = '0.12';
        });

        window.setTimeout(() => {
            ghost.remove();
        }, 560);
    }

    openLightbox(image: GalleryImage) {
        this.isLightboxOpen = true;
        this.currentLightboxImage = image;
        this.currentLightboxImageIndex = this.filteredImages.findIndex(img => img.id === image.id);
        document.body.style.overflow = 'hidden';
        this.applyLightboxAccentFromCurrentImage();
    }

    closeLightbox() {
        this.isLightboxOpen = false;
        this.currentLightboxImage = null;
        document.body.style.overflow = 'auto';
        this.resetLightboxAccent();
    }

    nextLightboxImage() {
        if (this.currentLightboxImageIndex < this.filteredImages.length - 1) {
            this.currentLightboxImageIndex++;
            this.currentLightboxImage = this.filteredImages[this.currentLightboxImageIndex];
        } else {
            this.currentLightboxImageIndex = 0;
            this.currentLightboxImage = this.filteredImages[0];
        }

        this.applyLightboxAccentFromCurrentImage();
    }

    previousLightboxImage() {
        if (this.currentLightboxImageIndex > 0) {
            this.currentLightboxImageIndex--;
            this.currentLightboxImage = this.filteredImages[this.currentLightboxImageIndex];
        } else {
            this.currentLightboxImageIndex = this.filteredImages.length - 1;
            this.currentLightboxImage = this.filteredImages[this.currentLightboxImageIndex];
        }

        this.applyLightboxAccentFromCurrentImage();
    }

    onLightboxImageLoad(): void {
        this.applyLightboxAccentFromCurrentImage();
    }

    // Touch Event Handlers for Swipe Gestures
    onTouchStart(event: Event) {
        const touchEvent = event as TouchEvent;
        this.touchStartX = touchEvent.changedTouches[0].screenX;
        this.touchEndX = this.touchStartX;
    }

    onTouchMove(event: TouchEvent) {
        this.touchEndX = event.changedTouches[0].screenX;
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
        const formattedContinent = this.formatDisplayLabel(continent);
        if (this.currentLanguage === 'de') {
            const translations: Record<string, string> = {
                'Africa': 'Afrika',
                'Asia': 'Asien',
                'Australia and Oceania': 'Australien und Ozeanien',
                'Europe': 'Europa',
                'North America': 'Nordamerika',
                'South America': 'Südamerika'
            };
            return translations[formattedContinent] || formattedContinent;
        }
        return formattedContinent;
    }

    translateCountry(country: string): string {
        const formattedCountry = this.formatDisplayLabel(country);
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
            return translations[formattedCountry] || formattedCountry;
        }
        return formattedCountry;
    }

    // Returns the next depth of subfolders to show as filter buttons
    get currentSubfolderFilterDepth(): number {
        return this.selectedSubfolders.length;
    }

    // Returns available options at the next subfolder depth
    get currentSubfolderOptions(): string[] {
        return this.availableSubfoldersByDepth[this.currentSubfolderFilterDepth] || [];
    }

    translateLocation(location: string): string {
        return this.formatDisplayLabel(location);
    }

    translateCategory(category: string): string {
        const formattedCategory = this.formatDisplayLabel(category);
        if (this.currentLanguage === 'de') {
            const translations: Record<string, string> = {
                'Aviation': 'Luftfahrt',
                'Travel': 'Reisen',
                'All': 'Alle'
            };
            return translations[formattedCategory] || formattedCategory;
        }
        return formattedCategory;
    }

    private formatDisplayLabel(value: string): string {
        return value.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
    }

    getImageTitle(image: GalleryImage): string {
        if (image.title && image.title.trim() !== '') {
            return image.title.trim();
        }
        if (this.currentLanguage === 'de' && image.titleDE) {
            return image.titleDE.trim();
        }
        return image.titleDE?.trim() || '';
    }

    getImageSeoAlt(image: GalleryImage): string {
        const title = this.getImageTitle(image) || (this.currentLanguage === 'de' ? 'Fotografie' : 'Photography');
        const country = this.translateCountry(image.country || '');
        const continent = this.translateContinent(image.continent || '');

        if (this.currentLanguage === 'de') {
            return `${title} - ${country}, ${continent}. Luftfahrt- und Reisefotografie von Christian Boehme.`;
        }

        return `${title} - ${country}, ${continent}. Aviation and travel photography by Christian Boehme.`;
    }

    getImageSeoTitle(image: GalleryImage): string {
        const title = this.getImageTitle(image);
        const country = this.translateCountry(image.country || '');
        return `${title} | ${country} | Christian Boehme`;
    }

    getImageSeoDescription(image: GalleryImage): string {
        const title = this.getImageTitle(image);
        const country = this.translateCountry(image.country || '');
        const continent = this.translateContinent(image.continent || '');
        const category = this.translateCategory(image.category || '');

        if (this.currentLanguage === 'de') {
            return `${title} aus ${country} (${continent}), Kategorie ${category}. Lizenzierbare Fotografie im Christian Boehme Shop.`;
        }

        return `${title} from ${country} (${continent}), category ${category}. Licensable photography in the Christian Boehme shop.`;
    }

    applyLightboxFilter(type: 'category' | 'continent' | 'country', value: string, event?: Event): void {
        event?.stopPropagation();
        if (!value) {
            return;
        }

        const currentImageId = this.currentLightboxImage?.id ?? -1;
        this.searchQuery = '';
        this.selectedSubfolders = [];

        if (type === 'category') {
            this.selectedCategory = value;
            this.selectedContinent = 'All';
            this.selectedCountry = 'All';
        }

        if (type === 'continent') {
            this.selectedCategory = 'All';
            this.selectedContinent = value;
            this.selectedCountry = 'All';
        }

        if (type === 'country') {
            this.selectedCategory = 'All';
            this.selectedContinent = 'All';
            this.selectedCountry = value;
        }

        this.updateAvailableFilters();
        this.filterImages();

        if (this.filteredImages.length === 0) {
            this.closeLightbox();
            this.cdr.markForCheck();
            return;
        }

        let nextIndex = this.filteredImages.findIndex((img) => img.id === currentImageId);
        if (nextIndex < 0) {
            nextIndex = 0;
        }

        this.currentLightboxImageIndex = nextIndex;
        this.currentLightboxImage = this.filteredImages[nextIndex];
        this.currentPage = Math.floor(nextIndex / this.imagesPerPage) + 1;
        this.cdr.markForCheck();
    }

    getImageFolderPath(image: GalleryImage): string {
        const rawPath = (image.path || '').trim();
        if (!rawPath) {
            return this.currentLanguage === 'de' ? 'Ordner nicht verfuegbar' : 'Folder unavailable';
        }

        const normalized = rawPath.replace(/\\/g, '/').replace(/^\/+/, '');
        const parts = normalized.split('/').filter(Boolean);
        if (parts.length === 0) {
            return this.currentLanguage === 'de' ? 'Ordner nicht verfuegbar' : 'Folder unavailable';
        }

        if (parts.length > 1) {
            parts.pop();
        }

        if (parts.length === 0) {
            return this.currentLanguage === 'de' ? 'Hauptordner' : 'Root folder';
        }

        return parts.join(' / ');
    }

    private applyLightboxAccentFromCurrentImage(): void {
        const root = document.documentElement;
        const imageUrl = this.currentLightboxImage?.gridUrl || this.currentLightboxImage?.url;
        if (!imageUrl) {
            this.resetLightboxAccent();
            return;
        }

        const sampleImage = new Image();
        sampleImage.crossOrigin = 'anonymous';
        sampleImage.referrerPolicy = 'no-referrer';
        sampleImage.src = imageUrl;

        sampleImage.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d', { willReadFrequently: true });
                if (!context) {
                    this.resetLightboxAccent();
                    return;
                }

                const sampleSize = 24;
                canvas.width = sampleSize;
                canvas.height = sampleSize;
                context.drawImage(sampleImage, 0, 0, sampleSize, sampleSize);
                const pixels = context.getImageData(0, 0, sampleSize, sampleSize).data;

                let r = 0;
                let g = 0;
                let b = 0;
                let count = 0;

                for (let i = 0; i < pixels.length; i += 4) {
                    const alpha = pixels[i + 3];
                    if (alpha < 120) {
                        continue;
                    }

                    r += pixels[i];
                    g += pixels[i + 1];
                    b += pixels[i + 2];
                    count++;
                }

                if (count === 0) {
                    this.resetLightboxAccent();
                    return;
                }

                const avgR = Math.round(r / count);
                const avgG = Math.round(g / count);
                const avgB = Math.round(b / count);
                const accent = this.boostColor(avgR, avgG, avgB, 1.08);
                const accentDark = this.boostColor(avgR, avgG, avgB, 0.68);

                root.style.setProperty('--lightbox-accent', `rgb(${accent.r}, ${accent.g}, ${accent.b})`);
                root.style.setProperty('--lightbox-accent-dark', `rgb(${accentDark.r}, ${accentDark.g}, ${accentDark.b})`);
            } catch {
                this.resetLightboxAccent();
            }
        };

        sampleImage.onerror = () => {
            this.resetLightboxAccent();
        };
    }

    private boostColor(r: number, g: number, b: number, factor: number): { r: number; g: number; b: number } {
        return {
            r: Math.max(0, Math.min(255, Math.round(r * factor))),
            g: Math.max(0, Math.min(255, Math.round(g * factor))),
            b: Math.max(0, Math.min(255, Math.round(b * factor))),
        };
    }

    private resetLightboxAccent(): void {
        const root = document.documentElement;
        root.style.removeProperty('--lightbox-accent');
        root.style.removeProperty('--lightbox-accent-dark');
    }
}
