import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export interface ImageManifest {
    generated: string;
    statistics: {
        totalImages: number;
        aviationPhotos: number;
        travelPhotos: number;
        continents: string[];
        countries: string[];
    };
    images: Array<{
        id: number;
        url: string;
        thumbnailUrl: string;
        gridUrl: string;
        originalUrl: string;
        title: string;
        titleDE?: string;
        category: string;
        continent: string;
        country: string;
        price: number;
        subfolders: string[];
        fileName: string;
        fileNameDE?: string;
        path: string;
    }>;
}

interface NameMapFile {
    generatedAt: string;
    entries: Record<string, {
        originalRelativePath: string;
        sanitizedRelativePath: string;
        originalFileName: string;
        sanitizedFileName: string;
        originalTitle: string;
    }>;
}

interface GalleryApiItem {
    id: number;
    category: string;
    continent: string;
    country: string;
    price_eur?: number | string | null;
    title: string;
    title_de?: string | null;
    path_original: string;
    path_grid: string;
    path_thumbnail: string;
}

interface GalleryApiResponse {
    ok: boolean;
    paging: {
        page: number;
        per_page: number;
        total: number;
        total_pages: number;
    };
    items: GalleryApiItem[];
}

@Injectable({ providedIn: 'root' })
export class ManifestService {
    private readonly bucketUrl = 'https://christian-boehme-gallery.s3.eu-central-3.ionoscloud.com';
    private readonly dbApiUrls = ['/api/gallery.php', 'https://www.christian-boehme.com/api/gallery.php'];
    private readonly dbOnlyMode = true;
    private readonly bucketApiUrl = '/api/ionos-gallery.php';
    private readonly imageVariantFolder = 'thumbnail';
    private readonly variantFolders = ['thumbnail', 'grid', 'original'] as const;
    private readonly maxKeys = 1000;
    private readonly imagePattern = /\.(jpg|jpeg|png|webp|avif)$/i;
    private readonly nameMapUrl = `${this.bucketUrl}/name-map.json`;
    private readonly fallbackImageUrls = [
        'https://christian-boehme-gallery.s3.eu-central-3.ionoscloud.com/_CRB1724%C3%9C.JPG'
    ];
    private manifest$?: Promise<ImageManifest>;

    constructor(private http: HttpClient) {
        // Prefetch immediately
        this.loadManifest();
    }

    loadManifest(forceRefresh = false): Promise<ImageManifest> {
        if (forceRefresh) {
            this.manifest$ = undefined;
        }

        if (!this.manifest$) {
            this.manifest$ = this.loadFromObjectStorage();
        }
        return this.manifest$;
    }

    private async loadFromObjectStorage(): Promise<ImageManifest> {
        const dbManifest = await this.fetchManifestFromDatabaseApi();
        if (dbManifest) {
            return dbManifest;
        }

        if (this.dbOnlyMode) {
            console.error('Gallery DB API unavailable. DB-only mode is active; object storage fallback disabled.');
            return {
                generated: new Date().toISOString(),
                statistics: {
                    totalImages: 0,
                    aviationPhotos: 0,
                    travelPhotos: 0,
                    continents: [],
                    countries: []
                },
                images: []
            };
        }

        const nameMap = await this.fetchNameMap();
        const apiKeys = await this.fetchKeysFromBackend();
        if (apiKeys.length > 0) {
            return this.buildManifestFromKeys(apiKeys, nameMap);
        }

        let keys: string[] = [];
        try {
            keys = await this.fetchAllImageKeys();
        } catch {
            keys = [];
        }

        if (keys.length > 0) {
            return this.buildManifestFromKeys(keys, nameMap);
        }

        const images = this.fallbackImageUrls.map((url) => {
            const key = decodeURIComponent(url.replace(`${this.bucketUrl}/`, ''));
            return this.buildFallbackImageEntry(url, key, nameMap);
        });

        const continents = [...new Set(images.map((img) => img.continent))].sort();
        const countries = [...new Set(images.map((img) => img.country))].sort();

        return {
            generated: new Date().toISOString(),
            statistics: {
                totalImages: images.length,
                aviationPhotos: images.filter((img) => img.category === 'Aviation').length,
                travelPhotos: images.filter((img) => img.category === 'Travel').length,
                continents,
                countries
            },
            images
        };
    }

    private async fetchManifestFromDatabaseApi(): Promise<ImageManifest | null> {
        let lastError: unknown = null;
        let lastUrl = '';
        for (const baseUrl of this.dbApiUrls) {
            try {
                const cacheBuster = Date.now();
                lastUrl = `${baseUrl}?page=1&per_page=100&_ts=${cacheBuster}`;
                const firstPage = await firstValueFrom(
                    this.http.get<GalleryApiResponse>(lastUrl)
                );

                if (!firstPage?.ok) {
                    continue;
                }

                const allItems: GalleryApiItem[] = [...(firstPage.items || [])];
                const totalPages = Math.max(1, firstPage.paging?.total_pages || 1);

                if (totalPages > 1) {
                    const pageRequests: Promise<GalleryApiResponse>[] = [];
                    for (let page = 2; page <= totalPages; page++) {
                        pageRequests.push(
                            firstValueFrom(
                                this.http.get<GalleryApiResponse>(`${baseUrl}?page=${page}&per_page=100&_ts=${cacheBuster}`)
                            )
                        );
                    }

                    const pageResults = await Promise.all(pageRequests);
                    for (const pageData of pageResults) {
                        if (pageData?.ok && Array.isArray(pageData.items)) {
                            allItems.push(...pageData.items);
                        }
                    }
                }

                const images = allItems.map((item) => {
                    const logicalPath = this.toLogicalPath(item.path_grid || item.path_thumbnail || item.path_original || '');
                    const pathParts = logicalPath.split('/').filter(Boolean);
                    const fileName = pathParts[pathParts.length - 1] || '';
                    const title = (item.title || '').trim() || fileName.replace(/\.[^/.]+$/, '');
                    const titleDe = (item.title_de || '').trim() || undefined;

                    const thumbnailUrl = this.ensureAbsoluteUrl(item.path_thumbnail || item.path_grid || item.path_original);
                    const gridUrl = this.ensureAbsoluteUrl(item.path_grid || item.path_thumbnail || item.path_original);
                    const originalUrl = this.ensureAbsoluteUrl(item.path_original || item.path_grid || item.path_thumbnail);

                    const locationSegment = pathParts[3] ?? '';
                    const subfolders = pathParts.slice(3, pathParts.length - 1)
                        .filter(s => s && !this.imagePattern.test(s))
                        .map(s => this.humanizeFolderSegment(s));

                    return {
                        id: item.id,
                        url: thumbnailUrl,
                        thumbnailUrl,
                        gridUrl,
                        originalUrl,
                        title,
                        titleDE: titleDe,
                        category: this.humanizeFolderSegment(item.category || 'Unknown'),
                        continent: this.humanizeFolderSegment(item.continent || 'Unknown'),
                        country: this.humanizeFolderSegment(item.country || 'Unknown'),
                        price: this.normalizePrice(item.price_eur),
                        subfolders,
                        fileName,
                        fileNameDE: titleDe ? `${titleDe}${fileName.match(/\.[^./]+$/)?.[0] || ''}` : undefined,
                        path: logicalPath
                    };
                });

                const continents = [...new Set(images.map((img) => img.continent))].sort();
                const countries = [...new Set(images.map((img) => img.country))].sort();

                return {
                    generated: new Date().toISOString(),
                    statistics: {
                        totalImages: images.length,
                        aviationPhotos: images.filter((img) => img.category === 'Aviation').length,
                        travelPhotos: images.filter((img) => img.category === 'Travel').length,
                        continents,
                        countries
                    },
                    images
                };
            } catch (error) {
                lastError = error;
                // Try next configured API URL.
            }
        }

        console.error('Gallery DB API unavailable.', {
            lastAttemptedUrl: lastUrl,
            error: lastError
        });

        return null;
    }

    private ensureAbsoluteUrl(pathOrUrl: string): string {
        if (!pathOrUrl) {
            return '';
        }

        if (/^https?:\/\//i.test(pathOrUrl)) {
            return pathOrUrl;
        }

        return `${this.bucketUrl}/${pathOrUrl.replace(/^\/+/, '')}`;
    }

    private normalizePrice(value: number | string | null | undefined): number {
        const numeric = Number(value ?? 19);
        return Number.isFinite(numeric) && numeric > 0 ? numeric : 19;
    }

    private toLogicalPath(pathValue: string): string {
        const cleaned = pathValue.replace(/^\/+/, '');
        for (const folder of this.variantFolders) {
            const prefix = `${folder}/`;
            if (cleaned.startsWith(prefix)) {
                return cleaned.slice(prefix.length);
            }
        }
        return cleaned;
    }

    private buildManifestFromKeys(keys: string[], nameMap: NameMapFile['entries']): ImageManifest {
        const assetsByLogicalKey = new Map<string, { thumbnail?: string; grid?: string; original?: string }>();

        for (const key of keys) {
            const parsed = this.parseVariantKey(key);
            const assets = assetsByLogicalKey.get(parsed.logicalKey) ?? {};

            if (parsed.variant === 'thumbnail') {
                assets.thumbnail = this.buildPublicUrl(key);
            } else if (parsed.variant === 'grid') {
                assets.grid = this.buildPublicUrl(key);
            } else {
                assets.original = this.buildPublicUrl(key);
            }

            assetsByLogicalKey.set(parsed.logicalKey, assets);
        }

        const images = Array.from(assetsByLogicalKey.entries()).map(([logicalKey, assets]) =>
            this.buildImageEntry(logicalKey, nameMap, assets)
        );
        const continents = [...new Set(images.map((img) => img.continent))].sort();
        const countries = [...new Set(images.map((img) => img.country))].sort();

        return {
            generated: new Date().toISOString(),
            statistics: {
                totalImages: images.length,
                aviationPhotos: images.filter((img) => img.category === 'Aviation').length,
                travelPhotos: images.filter((img) => img.category === 'Travel').length,
                continents,
                countries
            },
            images
        };
    }

    private async fetchKeysFromBackend(): Promise<string[]> {
        try {
            const response = await firstValueFrom(
                this.http.get<{ ok: boolean; keys?: string[] }>(this.bucketApiUrl)
            );

            if (response?.ok && Array.isArray(response.keys)) {
                return response.keys.filter((key) => typeof key === 'string' && this.imagePattern.test(key));
            }
        } catch {
            // Fall through to public listing fallback.
        }

        return [];
    }

    private buildImageEntry(
        logicalKey: string,
        nameMap: NameMapFile['entries'],
        assets?: { thumbnail?: string; grid?: string; original?: string }
    ) {
        const mapEntry = nameMap[logicalKey];
        const parts = logicalKey.split('/').filter(Boolean);
        const extMatch = logicalKey.match(/\.[^./]+$/);
        const extension = extMatch ? extMatch[0] : '';
        const fallbackFileName = parts[parts.length - 1] || logicalKey;
        const fileName = mapEntry?.originalFileName || fallbackFileName;
        const title = mapEntry?.originalTitle || fileName.replace(/\.[^/.]+$/, '');

        const thumbnailUrl = assets?.thumbnail || assets?.[this.imageVariantFolder] || assets?.grid || assets?.original || this.buildPublicUrl(`thumbnail/${logicalKey}`);
        const gridUrl = assets?.grid || assets?.thumbnail || assets?.original || this.buildPublicUrl(`grid/${logicalKey}`);
        const originalUrl = assets?.original || assets?.grid || assets?.thumbnail || this.buildPublicUrl(`original/${logicalKey}`);

        const subfolders = parts.slice(3, parts.length - 1)
            .filter(s => s && !this.imagePattern.test(s))
            .map(s => this.humanizeFolderSegment(s));

        return {
            id: 0,
            url: thumbnailUrl,
            thumbnailUrl,
            gridUrl,
            originalUrl,
            title,
            category: this.humanizeFolderSegment(parts[0] || 'Unknown'),
            continent: this.humanizeFolderSegment(parts[1] || 'Unknown'),
            country: this.humanizeFolderSegment(parts[2] || 'Unknown'),
            price: 19,
            subfolders,
            fileName,
            fileNameDE: title + extension,
            path: logicalKey
        };
    }

    private buildFallbackImageEntry(url: string, logicalKey: string, nameMap: NameMapFile['entries']) {
        const entry = this.buildImageEntry(logicalKey, nameMap);
        return {
            ...entry,
            url,
            thumbnailUrl: url,
            gridUrl: url,
            originalUrl: url
        };
    }

    private parseVariantKey(key: string): { logicalKey: string; variant: 'thumbnail' | 'grid' | 'original' } {
        for (const folder of this.variantFolders) {
            const prefix = `${folder}/`;
            if (key.startsWith(prefix)) {
                return {
                    logicalKey: key.slice(prefix.length),
                    variant: folder
                };
            }
        }

        return {
            logicalKey: key,
            variant: 'original'
        };
    }

    private async fetchNameMap(): Promise<NameMapFile['entries']> {
        try {
            const data = await firstValueFrom(this.http.get<NameMapFile>(this.nameMapUrl));
            if (data?.entries && typeof data.entries === 'object') {
                return data.entries;
            }
        } catch {
            // Optional file; ignore when unavailable.
        }

        return {};
    }

    private humanizeFolderSegment(segment: string): string {
        return decodeURIComponent(segment).replace(/_/g, ' ').trim();
    }

    private async fetchAllImageKeys(): Promise<string[]> {
        const keys: string[] = [];
        let continuationToken: string | null = null;

        do {
            const { pageKeys, nextToken } = await this.fetchImagePage(continuationToken);
            keys.push(...pageKeys);
            continuationToken = nextToken;
        } while (continuationToken);

        return keys;
    }

    private async fetchImagePage(continuationToken: string | null): Promise<{ pageKeys: string[]; nextToken: string | null }> {
        const params = new URLSearchParams({
            'list-type': '2',
            'max-keys': String(this.maxKeys)
        });

        if (continuationToken) {
            params.set('continuation-token', continuationToken);
        }

        const responseXml = await firstValueFrom(
            this.http.get(`${this.bucketUrl}?${params.toString()}`, { responseType: 'text' })
        );

        const parser = new DOMParser();
        const xml = parser.parseFromString(responseXml, 'application/xml');

        const pageKeys = Array.from(xml.getElementsByTagName('Key'))
            .map((node) => node.textContent?.trim() || '')
            .filter((key) => key !== '' && !key.endsWith('/') && this.imagePattern.test(key));

        const isTruncated = (xml.getElementsByTagName('IsTruncated')[0]?.textContent || '').toLowerCase() === 'true';
        const nextToken = xml.getElementsByTagName('NextContinuationToken')[0]?.textContent?.trim() || null;

        return {
            pageKeys,
            nextToken: isTruncated ? nextToken : null
        };
    }

    private buildPublicUrl(key: string): string {
        const encodedKey = key
            .split('/')
            .map((segment) => encodeURIComponent(segment))
            .join('/');

        return `${this.bucketUrl}/${encodedKey}`;
    }
}
