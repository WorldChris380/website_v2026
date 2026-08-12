import { Component, OnInit, OnDestroy, HostListener, ChangeDetectorRef, ViewChild, ElementRef, AfterViewInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ManifestService } from './manifest.service';
import { LanguageService, Language } from '../language.service';
import { MetaService } from '../services/meta.service';
import { ShopService } from '../shop/shop.service';
import { ShopCart } from '../shop/shop-cart';
import { ShopAuthService } from '../shop/shop-auth.service';
import { ShopReviewsService, VerifiedReview } from '../shop/shop-reviews.service';
import { ShopSubscriptionService, ShopSubscriptionStatus } from '../shop/shop-subscription.service';
import { FavoritesService } from './favorites.service';
import { environment } from '../../environments/environment';

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
    imports: [CommonModule, FormsModule, RouterModule, ShopCart],
    templateUrl: './gallery.html',
    changeDetection: ChangeDetectionStrategy.Eager,
    styleUrls: ['./gallery.scss'],
})
export class Gallery implements OnInit, OnDestroy {
    images: GalleryImage[] = [];
    filteredImages: GalleryImage[] = [];
    currentLanguage: Language = 'en';

    selectedCategory: string = 'All';
    selectedContinent: string = 'All';
    selectedCountry: string = 'All';
    selectedSubfolders: string[] = [];
    searchQuery: string = '';
    showFavoritesOnly: boolean = false;
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
    private readonly baseGalleryUrl = 'https://www.christian-boehme.com/gallery';
    private readonly baseShopCartUrl = 'https://www.christian-boehme.com/shop/cart';

    // Loading mode
    isLazyLoad: boolean = false;
    lazyLoadCount: number = 15;
    private readonly lazyLoadIncrement: number = 15;
    private intersectionObserver?: IntersectionObserver;

    // Touch Events for Swipe
    private touchStartX: number = 0;
    private touchEndX: number = 0;
    private touchStartY: number = 0;
    private touchEndY: number = 0;
    private searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
    copiedImageId: number | null = null;
    private copiedImageTimer: ReturnType<typeof setTimeout> | null = null;
    copiedDrivePathId: number | null = null;
    private copiedDrivePathTimer: ReturnType<typeof setTimeout> | null = null;
    reviews: VerifiedReview[] = [];
    isReviewsLoading = false;
    reviewError = '';
    reviewSuccess = '';
    reviewRating = 5;
    reviewText = '';
    isReviewSubmitting = false;
    canLeaveVerifiedReview = false;
    subscriptionStatus: ShopSubscriptionStatus | null = null;
    isSubscriptionLoading = false;
    isSubscriptionDownloadPending = false;
    subscriptionMessage = '';
    @ViewChild('lightboxImg') lightboxImg?: ElementRef<HTMLImageElement>;

    constructor(
        private route: ActivatedRoute,
        private router: Router,
        private manifestService: ManifestService,
        private languageService: LanguageService,
        private cdr: ChangeDetectorRef,
        private metaService: MetaService,
        private shopService: ShopService,
        public shopAuthService: ShopAuthService,
        private shopReviewsService: ShopReviewsService,
        private shopSubscriptionService: ShopSubscriptionService,
        public favoritesService: FavoritesService
    ) { }

    ngOnInit() {
        this.currentLanguage = this.languageService.getCurrentLanguage();
        this.languageService.language$.subscribe((lang) => {
            this.currentLanguage = lang;
            this.updateGallerySeo();
            this.cdr.markForCheck();
        });

        this.updateGallerySeo();
        this.refreshSubscriptionStatus();

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
        this.lazyLoadCount = this.lazyLoadIncrement;
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
            const matchesFavorites = !this.showFavoritesOnly || this.favoritesService.isFavorite(img.id);
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

            return matchesCategory && matchesContinent && matchesCountry && matchesSubfolders && matchesFavorites && matchesSearch;
        });

        // Fallback: if search is non-empty and nothing matched, try looser normalization across all images
        if (q !== '' && this.filteredImages.length === 0) {
            const looseQ = normalize(aliasQ).replace(/\s+/g, '');
            this.filteredImages = this.images.filter(img => {
                if (this.showFavoritesOnly && !this.favoritesService.isFavorite(img.id)) return false;
                const normPath = normalize(img.path).replace(/\s+/g, '');
                const normCountry = normalize(img.country).replace(/\s+/g, '');
                const normTitle = normalize(img.title).replace(/\s+/g, '');
                const normTitleDe = normalize(img.titleDE || '').replace(/\s+/g, '');
                return normPath.includes(looseQ) || normCountry.includes(looseQ) || normTitle.includes(looseQ) || normTitleDe.includes(looseQ);
            });
        }

        this.updateGallerySeo();
        if (this.isLazyLoad) {
            this.setupLazyLoadObserver();
        }
    }

    private updateGallerySeo(): void {
        const isDE = this.currentLanguage === 'de';
        const contextLabel = this.getSeoContextLabel();
        const isGlobalContext = this.isGlobalSeoContext();
        const count = this.filteredImages.length || this.images.length;
        const minPrice = this.getLowestVisiblePrice();
        const canonicalUrl = this.buildSeoCanonicalUrl();

        const title = isDE
            ? `Fotos kaufen: ${contextLabel} | ${count} lizenzierbare Bilder | Christian Böhme`
            : `Buy ${contextLabel} Photos | ${count} licensable images | Christian Böhme`;

        const description = isDE
            ? `Lizenzierbare Luftfahrt- und Reisefotografie ${isGlobalContext ? 'aus aller Welt' : `für ${contextLabel}`}. Sofortiger Checkout per PayPal. Preise ab ${minPrice.toFixed(2)} EUR pro Bild.`
            : `Licensable aviation and travel photography ${isGlobalContext ? 'from around the world' : `for ${contextLabel}`}. Instant PayPal checkout. Prices from EUR ${minPrice.toFixed(2)} per image.`;

        const keywords = isDE
            ? `fotografie kaufen, luftfahrt fotos kaufen, reisefotos lizenzieren, bildlizenz, christian boehme galerie, ${this.selectedCountry !== 'All' ? this.selectedCountry.toLowerCase() + ', ' : ''}${this.selectedCategory !== 'All' ? this.selectedCategory.toLowerCase() + ', ' : ''}paypal checkout`
            : `buy photos online, aviation photo licensing, travel photo licensing, image license, christian boehme gallery, ${this.selectedCountry !== 'All' ? this.selectedCountry.toLowerCase() + ', ' : ''}${this.selectedCategory !== 'All' ? this.selectedCategory.toLowerCase() + ', ' : ''}paypal checkout`;

        this.metaService.updateSEO(
            {
                title,
                description,
                keywords,
                image: 'https://www.christian-boehme.com/assets/img/other/Dresden%20Skyline.jpg',
                url: canonicalUrl,
                type: 'website'
            },
            this.buildGalleryStructuredData(title, description, canonicalUrl, count)
        );
    }

    private getSeoContextLabel(): string {
        const search = this.searchQuery.trim();
        if (search) {
            return search;
        }

        if (this.selectedCountry !== 'All') {
            return this.translateCountry(this.selectedCountry);
        }

        if (this.selectedContinent !== 'All') {
            return this.translateContinent(this.selectedContinent);
        }

        if (this.selectedCategory !== 'All') {
            return this.translateCategory(this.selectedCategory);
        }

        return this.currentLanguage === 'de' ? 'Weltweit' : 'Worldwide';
    }

    private isGlobalSeoContext(): boolean {
        return this.searchQuery.trim() === ''
            && this.selectedCategory === 'All'
            && this.selectedContinent === 'All'
            && this.selectedCountry === 'All';
    }

    private getLowestVisiblePrice(): number {
        const source = this.filteredImages.length > 0 ? this.filteredImages : this.images;
        if (source.length === 0) {
            return 19;
        }

        return source.reduce((minPrice, image) => Math.min(minPrice, image.price || 19), source[0].price || 19);
    }

    private buildSeoCanonicalUrl(): string {
        const params = new URLSearchParams();

        if (this.selectedCategory !== 'All') {
            params.set('filter', this.selectedCategory);
        }

        if (this.selectedContinent !== 'All') {
            params.set('continent', this.selectedContinent);
        }

        if (this.selectedCountry !== 'All') {
            params.set('country', this.selectedCountry);
        }

        const search = this.searchQuery.trim();
        if (search) {
            params.set('search', search);
        }

        const queryString = params.toString();
        return queryString ? `${this.baseGalleryUrl}?${queryString}` : this.baseGalleryUrl;
    }

    private buildGalleryStructuredData(title: string, description: string, url: string, count: number): any {
        const items = (this.filteredImages.length > 0 ? this.filteredImages : this.images).slice(0, 8);

        return {
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            "name": title,
            "description": description,
            "url": url,
            "isPartOf": {
                "@type": "WebSite",
                "name": "Christian Boehme",
                "url": "https://www.christian-boehme.com"
            },
            "mainEntity": {
                "@type": "ItemList",
                "numberOfItems": count,
                "itemListElement": items.map((image, index) => ({
                    "@type": "ListItem",
                    "position": index + 1,
                    "item": {
                        "@type": "ImageObject",
                        "name": this.getImageTitle(image),
                        "contentUrl": image.originalUrl || image.gridUrl || image.url,
                        "thumbnailUrl": image.thumbnailUrl || image.gridUrl || image.url,
                        "description": this.getImageSeoDescription(image),
                        "license": "https://www.christian-boehme.com/shop",
                        "acquireLicensePage": this.baseShopCartUrl,
                        "creator": {
                            "@type": "Person",
                            "name": "Christian Boehme"
                        },
                        "creditText": "Christian Boehme / christian-boehme.com",
                        "copyrightNotice": "© Christian Boehme",
                        "keywords": [image.category, image.country]
                    }
                }))
            }
        };
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

    isFavorite(image: GalleryImage | null): boolean {
        return !!image && this.favoritesService.isFavorite(image.id);
    }

    toggleFavorite(image: GalleryImage | null, event?: Event): void {
        event?.stopPropagation();
        if (!image) return;
        this.favoritesService.toggle(image.id);
        if (this.showFavoritesOnly) {
            this.filterImages();
        }
        this.cdr.markForCheck();
    }

    toggleFavoritesOnly(): void {
        this.showFavoritesOnly = !this.showFavoritesOnly;
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
        this.searchQuery = '';
        if (this.searchDebounceTimer) {
            clearTimeout(this.searchDebounceTimer);
            this.searchDebounceTimer = null;
        }
        this.filterImages();
        this.cdr.markForCheck();
    }

    goToCountryResults(country: string, event?: Event): void {
        event?.stopPropagation();
        const target = (country || '').trim();
        if (!target) {
            return;
        }

        this.router.navigate(['/photography'], {
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

    get displayedImages(): GalleryImage[] {
        if (this.isLazyLoad) {
            return this.filteredImages.slice(0, this.lazyLoadCount);
        }
        return this.paginatedImages;
    }

    onToggleLoadingMode(): void {
        this.lazyLoadCount = this.lazyLoadIncrement;
        if (this.isLazyLoad) {
            this.setupLazyLoadObserver();
        } else {
            this.teardownLazyLoadObserver();
            this.currentPage = 1;
        }
        this.cdr.markForCheck();
    }

    private setupLazyLoadObserver(): void {
        this.teardownLazyLoadObserver();
        setTimeout(() => {
            const sentinel = document.getElementById('lazy-load-sentinel');
            if (!sentinel || !this.isLazyLoad) return;
            this.intersectionObserver = new IntersectionObserver(
                (entries) => {
                    if (entries[0].isIntersecting && this.lazyLoadCount < this.filteredImages.length) {
                        this.lazyLoadCount += this.lazyLoadIncrement;
                        this.cdr.markForCheck();
                    }
                },
                { rootMargin: '300px', threshold: 0 }
            );
            this.intersectionObserver.observe(sentinel);
        }, 50);
    }

    private teardownLazyLoadObserver(): void {
        this.intersectionObserver?.disconnect();
        this.intersectionObserver = undefined;
    }

    ngOnDestroy(): void {
        this.teardownLazyLoadObserver();
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
        this.subscriptionMessage = '';
        document.body.style.overflow = 'hidden';
        this.applyLightboxAccentFromCurrentImage();
        this.refreshLightboxReviews();
        this.refreshSubscriptionStatus();
    }

    closeLightbox() {
        this.isLightboxOpen = false;
        this.currentLightboxImage = null;
        this.reviews = [];
        this.reviewError = '';
        this.reviewSuccess = '';
        this.subscriptionMessage = '';
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
        this.refreshLightboxReviews();
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
        this.refreshLightboxReviews();
    }

    private refreshLightboxReviews(): void {
        const image = this.currentLightboxImage;
        if (!image) {
            this.reviews = [];
            this.canLeaveVerifiedReview = false;
            return;
        }

        const productId = String(image.id);
        this.reviewError = '';
        this.reviewSuccess = '';
        this.isReviewsLoading = true;

        this.shopReviewsService.listReviews(productId).subscribe((result) => {
            this.isReviewsLoading = false;
            if (!result.success) {
                this.reviewError = result.error || (this.currentLanguage === 'de' ? 'Bewertungen konnten nicht geladen werden.' : 'Could not load reviews.');
                this.reviews = [];
                this.cdr.markForCheck();
                return;
            }

            this.reviews = result.reviews;
            this.cdr.markForCheck();
        });

        this.updateVerifiedReviewEligibility(productId);
    }

    private updateVerifiedReviewEligibility(productId: string): void {
        this.canLeaveVerifiedReview = false;

        if (!this.shopAuthService.isAuthenticated()) {
            return;
        }

        const currentOrders = this.shopAuthService.orderHistory();
        if (currentOrders.length > 0) {
            this.canLeaveVerifiedReview = this.hasPurchasedProduct(productId, currentOrders);
            return;
        }

        this.shopAuthService.fetchOrders().subscribe(() => {
            this.canLeaveVerifiedReview = this.hasPurchasedProduct(productId, this.shopAuthService.orderHistory());
            this.cdr.markForCheck();
        });
    }

    private hasPurchasedProduct(productId: string, orders: { items: { productId: string }[] }[]): boolean {
        return orders.some((order) => Array.isArray(order.items) && order.items.some((item) => item.productId === productId));
    }

    get canUseSubscriptionDownload(): boolean {
        return !!this.currentLightboxImage
            && this.shopAuthService.isAuthenticated()
            && !!this.subscriptionStatus?.active
            && this.subscriptionStatus.monthlyDownloadsRemaining > 0
            && !this.isSubscriptionDownloadPending;
    }

    get hasActiveSubscription(): boolean {
        return !!this.subscriptionStatus?.active;
    }

    get subscriptionDownloadHint(): string {
        if (this.subscriptionStatus?.active) {
            return (this.currentLanguage === 'de' ? 'Verbleibende Abo-Downloads in diesem Monat: ' : 'Remaining subscription downloads this month: ')
                + this.subscriptionStatus.monthlyDownloadsRemaining
                + ' / '
                + this.subscriptionStatus.monthlyDownloadLimit;
        }

        return this.currentLanguage === 'de'
            ? 'Kein aktives Abo. Im Konto kannst du ein Monats- oder Jahresabo buchen.'
            : 'No active subscription. You can activate a monthly or annual plan in your account.';
    }

    downloadWithSubscription(image?: GalleryImage | null, event?: Event): void {
        event?.stopPropagation();

        const targetImage = image ?? this.currentLightboxImage;
        const token = this.shopAuthService.getToken();
        if (!targetImage || !token) {
            this.subscriptionMessage = this.currentLanguage === 'de'
                ? 'Bitte zuerst einloggen.'
                : 'Please sign in first.';
            return;
        }

        this.isSubscriptionDownloadPending = true;
        this.subscriptionMessage = '';
        this.shopSubscriptionService.consumeDownload({
            token,
            imageId: targetImage.id,
        }).subscribe((result) => {
            this.isSubscriptionDownloadPending = false;
            if (!result.success || !result.downloadUrl) {
                this.subscriptionMessage = result.error || (this.currentLanguage === 'de'
                    ? 'Abo-Download konnte nicht gestartet werden.'
                    : 'Could not start subscription download.');
                return;
            }

            this.subscriptionStatus = result.status ?? this.subscriptionStatus;
            this.subscriptionMessage = this.currentLanguage === 'de'
                ? `Download gestartet. Verbleibend: ${result.remainingDownloads ?? this.subscriptionStatus?.monthlyDownloadsRemaining ?? 0}`
                : `Download started. Remaining: ${result.remainingDownloads ?? this.subscriptionStatus?.monthlyDownloadsRemaining ?? 0}`;
            window.open(result.downloadUrl, '_blank', 'noopener,noreferrer');
        });
    }

    private refreshSubscriptionStatus(): void {
        const token = this.shopAuthService.getToken();
        if (!token || !this.shopAuthService.isAuthenticated()) {
            this.subscriptionStatus = null;
            this.isSubscriptionLoading = false;
            return;
        }

        this.isSubscriptionLoading = true;
        this.shopSubscriptionService.getStatus(token).subscribe((result) => {
            this.isSubscriptionLoading = false;
            if (!result.success) {
                this.subscriptionStatus = null;
                return;
            }

            this.subscriptionStatus = result.status;
        });
    }

    submitVerifiedReview(): void {
        this.reviewError = '';
        this.reviewSuccess = '';

        const image = this.currentLightboxImage;
        if (!image) {
            return;
        }

        if (!this.canLeaveVerifiedReview) {
            this.reviewError = this.currentLanguage === 'de'
                ? 'Nur verifizierte Käufer können dieses Bild bewerten.'
                : 'Only verified buyers can review this image.';
            return;
        }

        const text = this.reviewText.trim();
        if (text.length < 10) {
            this.reviewError = this.currentLanguage === 'de'
                ? 'Bitte mindestens 10 Zeichen schreiben.'
                : 'Please write at least 10 characters.';
            return;
        }

        const token = this.shopAuthService.getToken();
        if (!token) {
            this.reviewError = this.currentLanguage === 'de'
                ? 'Bitte erneut einloggen.'
                : 'Please log in again.';
            return;
        }

        this.isReviewSubmitting = true;
        this.shopReviewsService.saveReview({
            token,
            productId: String(image.id),
            rating: this.reviewRating,
            reviewText: text,
        }).subscribe((result) => {
            this.isReviewSubmitting = false;
            if (!result.success) {
                this.reviewError = result.error || (this.currentLanguage === 'de'
                    ? 'Bewertung konnte nicht gespeichert werden.'
                    : 'Could not save review.');
                this.cdr.markForCheck();
                return;
            }

            this.reviewText = '';
            this.reviewSuccess = this.currentLanguage === 'de'
                ? 'Vielen Dank! Deine verifizierte Bewertung wurde gespeichert.'
                : 'Thanks! Your verified review has been saved.';
            this.refreshLightboxReviews();
        });
    }

    getReviewStars(rating: number): string {
        const clamped = Math.max(1, Math.min(5, Math.round(rating || 0)));
        return '★'.repeat(clamped) + '☆'.repeat(5 - clamped);
    }

    formatReviewDate(value: string): string {
        if (!value) {
            return '';
        }

        try {
            const locale = this.currentLanguage === 'de' ? 'de-DE' : 'en-US';
            return new Date(value).toLocaleDateString(locale, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
            });
        } catch {
            return value;
        }
    }

    onLightboxImageLoad(): void {
        this.applyLightboxAccentFromCurrentImage();
    }

    // Touch Event Handlers for Swipe Gestures
    onTouchStart(event: Event) {
        const touchEvent = event as TouchEvent;
        this.touchStartX = touchEvent.changedTouches[0].screenX;
        this.touchStartY = touchEvent.changedTouches[0].screenY;
        this.touchEndX = this.touchStartX;
        this.touchEndY = this.touchStartY;
    }

    onTouchMove(event: Event) {
        const touchEvent = event as TouchEvent;
        this.touchEndX = touchEvent.changedTouches[0].screenX;
        this.touchEndY = touchEvent.changedTouches[0].screenY;
    }

    onTouchEnd(event: Event) {
        const touchEvent = event as TouchEvent;
        this.touchEndX = touchEvent.changedTouches[0].screenX;
        this.touchEndY = touchEvent.changedTouches[0].screenY;
        this.handleSwipe();
    }

    private handleSwipe() {
        const swipeThreshold = 80;
        const diffX = this.touchStartX - this.touchEndX;
        const diffY = this.touchStartY - this.touchEndY;

        // Only trigger if horizontal movement exceeds threshold AND is clearly more horizontal than vertical
        if (Math.abs(diffX) > swipeThreshold && Math.abs(diffX) > Math.abs(diffY) * 1.8) {
            if (diffX > 0) {
                this.nextLightboxImage();
            } else {
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
            return `${title} aus ${country} (${continent}), Kategorie ${category}. Lizenzierbare Fotografie im Christian Böhme Shop.`;
        }

        return `${title} from ${country} (${continent}), category ${category}. Licensable photography in the Christian Böhme shop.`;
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
            return this.currentLanguage === 'de' ? 'Ordner nicht verfügbar' : 'Folder unavailable';
        }

        const normalized = rawPath.replace(/\\/g, '/').replace(/^\/+/, '');
        const parts = normalized.split('/').filter(Boolean);
        if (parts.length === 0) {
            return this.currentLanguage === 'de' ? 'Ordner nicht verfügbar' : 'Folder unavailable';
        }

        if (parts.length > 1) {
            parts.pop();
        }

        if (parts.length === 0) {
            return this.currentLanguage === 'de' ? 'Hauptordner' : 'Root folder';
        }

        return parts.join(' / ');
    }

    // Best-effort local source-folder path (D:\Bilder\...) for finding the
    // original/RAW file on disk. Built from category/continent/country/
    // subfolders — already de-slugified for display — rather than the raw
    // `path` field, whose filename segment is slug-cased and doesn't match
    // the real file name on disk. Folder-only: close enough to jump to the
    // right place, exact file still needs a quick look once there.
    getImageDrivePath(image: GalleryImage): string {
        const segments = [image.category, image.continent, image.country, ...(image.subfolders || [])]
            .map(s => (s || '').trim())
            .filter(Boolean);
        if (segments.length === 0) return '';
        return ['D:', 'Bilder', ...segments].join('\\');
    }

    copyDrivePath(image: GalleryImage, event?: Event): void {
        event?.stopPropagation();
        const drivePath = this.getImageDrivePath(image);
        if (!drivePath) return;

        const setCopiedState = () => {
            this.copiedDrivePathId = image.id;
            if (this.copiedDrivePathTimer) {
                clearTimeout(this.copiedDrivePathTimer);
            }
            this.copiedDrivePathTimer = setTimeout(() => {
                this.copiedDrivePathId = null;
                this.cdr.markForCheck();
            }, 1200);
            this.cdr.markForCheck();
        };

        if (navigator.clipboard?.writeText) {
            navigator.clipboard.writeText(drivePath)
                .then(() => setCopiedState())
                .catch(() => this.copyImageIdFallback(drivePath, setCopiedState));
            return;
        }

        this.copyImageIdFallback(drivePath, setCopiedState);
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
        sampleImage.src = this.toLightboxAccentSampleUrl(imageUrl);

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

    private toLightboxAccentSampleUrl(imageUrl: string): string {
        const absoluteUrl = this.toAbsoluteUrl(imageUrl);
        if (!absoluteUrl) {
            return imageUrl;
        }

        if (this.isSameOriginUrl(absoluteUrl)) {
            return absoluteUrl;
        }

        const proxyBaseUrl = environment.apiBaseUrl || window.location.origin;
        return `${proxyBaseUrl}/api/image-proxy.php?url=${encodeURIComponent(absoluteUrl)}`;
    }

    private toAbsoluteUrl(value: string): string {
        if (!value) {
            return '';
        }

        try {
            return new URL(value, window.location.origin).toString();
        } catch {
            return value;
        }
    }

    private isSameOriginUrl(value: string): boolean {
        if (!value) {
            return false;
        }

        try {
            return new URL(value, window.location.origin).origin === window.location.origin;
        } catch {
            return false;
        }
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
