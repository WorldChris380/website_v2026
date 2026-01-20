import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, shareReplay } from 'rxjs';

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
        category: string;
        continent: string;
        country: string;
        fileName: string;
        path: string;
    }>;
}

@Injectable({ providedIn: 'root' })
export class ManifestService {
    private manifest$?: Promise<ImageManifest>;

    constructor(private http: HttpClient) {
        // Prefetch immediately
        this.loadManifest();
    }

    loadManifest(): Promise<ImageManifest> {
        if (!this.manifest$) {
            this.manifest$ = firstValueFrom(
                this.http.get<ImageManifest>('assets/img/photography/images-manifest.json').pipe(shareReplay(1))
            );
        }
        return this.manifest$;
    }
}
