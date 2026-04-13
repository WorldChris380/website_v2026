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
        url: string;
        title: string;
        titleDE?: string;
        category: string;
        continent: string;
        country: string;
        fileName: string;
        fileNameDE?: string;
        path: string;
    }>;
}

@Injectable({ providedIn: 'root' })
export class ManifestService {
    private readonly bucketUrl = 'https://christian-boehme-gallery.s3.eu-central-3.ionoscloud.com';
    private readonly bucketApiUrl = '/api/ionos-gallery.php';
    private readonly maxKeys = 1000;
    private readonly imagePattern = /\.(jpg|jpeg|png|webp|avif)$/i;
    private readonly fallbackImageUrls = [
        'https://christian-boehme-gallery.s3.eu-central-3.ionoscloud.com/_CRB1724%C3%9C.JPG'
    ];
    private manifest$?: Promise<ImageManifest>;

    constructor(private http: HttpClient) {
        // Prefetch immediately
        this.loadManifest();
    }

    loadManifest(): Promise<ImageManifest> {
        if (!this.manifest$) {
            this.manifest$ = this.loadFromObjectStorage();
        }
        return this.manifest$;
    }

    private async loadFromObjectStorage(): Promise<ImageManifest> {
        const apiKeys = await this.fetchKeysFromBackend();
        if (apiKeys.length > 0) {
            return this.buildManifestFromKeys(apiKeys);
        }

        let keys: string[] = [];
        try {
            keys = await this.fetchAllImageKeys();
        } catch {
            keys = [];
        }

        if (keys.length > 0) {
            return this.buildManifestFromKeys(keys);
        }

        const images = this.fallbackImageUrls.map((url) => {
            const key = decodeURIComponent(url.replace(`${this.bucketUrl}/`, ''));
            return this.buildImageEntry(url, key);
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

    private buildManifestFromKeys(keys: string[]): ImageManifest {
        const images = keys.map((key) => this.buildImageEntry(this.buildPublicUrl(key), key));
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

    private buildImageEntry(url: string, key: string) {
        const parts = key.split('/').filter(Boolean);
        const extMatch = key.match(/\.[^./]+$/);
        const extension = extMatch ? extMatch[0] : '';
        const fileName = parts[parts.length - 1] || key;
        const title = fileName.replace(/\.[^/.]+$/, '');

        return {
            url,
            title,
            category: parts[0] || 'Unknown',
            continent: parts[1] || 'Unknown',
            country: parts[2] || 'Unknown',
            fileName,
            fileNameDE: title + extension,
            path: key
        };
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
