import { Injectable, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { DOCUMENT } from '@angular/common';

export interface MetaConfig {
    title: string;
    description: string;
    image?: string;
    type?: string;
    url?: string;
}

@Injectable({ providedIn: 'root' })
export class MetaService {
    private meta = inject(Meta);
    private title = inject(Title);
    private document = inject(DOCUMENT);

    /**
     * Updates all meta tags for a page
     */
    updateMetaTags(config: MetaConfig): void {
        // Title
        this.title.setTitle(config.title);

        // Description
        this.meta.updateTag({ name: 'description', content: config.description });

        // Open Graph
        this.meta.updateTag({ property: 'og:title', content: config.title });
        this.meta.updateTag({ property: 'og:description', content: config.description });
        this.meta.updateTag({ property: 'og:type', content: config.type || 'website' });

        if (config.url) {
            this.meta.updateTag({ property: 'og:url', content: config.url });
        }

        if (config.image) {
            this.meta.updateTag({ property: 'og:image', content: config.image });
        }

        // Twitter Card
        this.meta.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
        this.meta.updateTag({ name: 'twitter:title', content: config.title });
        this.meta.updateTag({ name: 'twitter:description', content: config.description });

        if (config.image) {
            this.meta.updateTag({ name: 'twitter:image', content: config.image });
        }
    }

    /**
     * Sets canonical URL for the page
     */
    setCanonicalUrl(url: string): void {
        const head = this.document.getElementsByTagName('head')[0];
        let link: HTMLLinkElement | null = this.document.querySelector('link[rel="canonical"]');

        if (link) {
            link.setAttribute('href', url);
        } else {
            link = this.document.createElement('link');
            link.setAttribute('rel', 'canonical');
            link.setAttribute('href', url);
            head.appendChild(link);
        }
    }

    /**
     * Sets structured data (JSON-LD) for the page
     */
    setStructuredData(data: any): void {
        let script = this.document.getElementById('structured-data') as HTMLScriptElement;

        if (script) {
            script.textContent = JSON.stringify(data);
        } else {
            script = this.document.createElement('script');
            script.id = 'structured-data';
            script.type = 'application/ld+json';
            script.textContent = JSON.stringify(data);
            this.document.head.appendChild(script);
        }
    }

    /**
     * Removes structured data from the page
     */
    removeStructuredData(): void {
        const script = this.document.getElementById('structured-data');
        if (script) {
            script.remove();
        }
    }

    /**
     * Updates all SEO elements at once
     */
    updateSEO(config: MetaConfig, structuredData?: any): void {
        this.updateMetaTags(config);
        if (config.url) {
            this.setCanonicalUrl(config.url);
        }
        if (structuredData) {
            this.setStructuredData(structuredData);
        }
    }
}
