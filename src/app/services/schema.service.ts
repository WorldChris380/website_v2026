import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/**
 * Schema.org Service for SEO Structured Data
 * Generates JSON-LD markup for better search engine understanding
 */
@Injectable({
    providedIn: 'root'
})
export class SchemaService {
    private isBrowser: boolean;

    constructor(@Inject(PLATFORM_ID) platformId: Object) {
        this.isBrowser = isPlatformBrowser(platformId);
    }

    /**
     * Add JSON-LD script to document head
     */
    private addJsonLd(schema: any): void {
        if (!this.isBrowser) return;

        const scriptId = 'schema-' + schema['@type'];

        // Remove existing script if present
        const existing = document.getElementById(scriptId);
        if (existing) {
            existing.remove();
        }

        const script = document.createElement('script');
        script.id = scriptId;
        script.type = 'application/ld+json';
        script.text = JSON.stringify(schema);
        document.head.appendChild(script);
    }

    /**
     * Organization Schema - For homepage
     */
    setOrganizationSchema(): void {
        const schema = {
            '@context': 'https://schema.org',
            '@type': 'Organization',
            name: 'Christian Böhme Photography',
            url: 'https://christian-boehme.com',
            logo: 'https://christian-boehme.com/assets/img/icons-and-logos/logo.png',
            description: 'Aviation and Travel Photography by Christian Böhme - Professional photographer specializing in aviation spotting and travel photography worldwide.',
            sameAs: [
                'https://instagram.com/worldchris380',
                'https://github.com/WorldChris380'
            ],
            contactPoint: {
                '@type': 'ContactPoint',
                email: 'info@christian-boehme.com',
                contactType: 'Customer Service',
                availableLanguage: ['en', 'de']
            }
        };

        this.addJsonLd(schema);
    }

    /**
     * LocalBusiness Schema - For shop page
     */
    setLocalBusinessSchema(): void {
        const schema = {
            '@context': 'https://schema.org',
            '@type': 'LocalBusiness',
            name: 'Christian Böhme Photography Shop',
            image: 'https://christian-boehme.com/assets/img/icons-and-logos/logo.png',
            '@id': 'https://christian-boehme.com/shop',
            url: 'https://christian-boehme.com/shop',
            telephone: '',
            priceRange: '€€',
            address: {
                '@type': 'PostalAddress',
                addressCountry: 'DE'
            },
            email: 'info@christian-boehme.com',
            description: 'Purchase high-quality aviation and travel photography prints, wall calendars, and digital downloads.',
            paymentAccepted: 'PayPal, Credit Card',
            currenciesAccepted: 'EUR'
        };

        this.addJsonLd(schema);
    }

    /**
     * ImageObject Schema - For gallery images
     * @param imageUrl Full URL to the image
     * @param title Image title
     * @param description Image description
     * @param country Country where photo was taken
     */
    setImageObjectSchema(imageUrl: string, title: string, description: string, country: string): void {
        const schema = {
            '@context': 'https://schema.org',
            '@type': 'ImageObject',
            contentUrl: imageUrl,
            name: title,
            description: description,
            author: {
                '@type': 'Person',
                name: 'Christian Böhme'
            },
            copyrightNotice: '© Christian Böhme',
            locationCreated: {
                '@type': 'Place',
                name: country
            },
            license: 'https://christian-boehme.com/legal'
        };

        this.addJsonLd(schema);
    }

    /**
     * Person Schema - For CV/Career page
     */
    setPersonSchema(): void {
        const schema = {
            '@context': 'https://schema.org',
            '@type': 'Person',
            name: 'Christian Böhme',
            url: 'https://christian-boehme.com',
            image: 'https://christian-boehme.com/assets/img/icons-and-logos/profile.jpg',
            jobTitle: 'Photographer & Web Developer',
            email: 'info@christian-boehme.com',
            knowsAbout: ['Aviation Photography', 'Travel Photography', 'Web Development', 'Angular', 'TypeScript'],
            sameAs: [
                'https://instagram.com/worldchris380',
                'https://github.com/WorldChris380'
            ]
        };

        this.addJsonLd(schema);
    }

    /**
     * Product Schema - For shop products
     * @param name Product name
     * @param description Product description
     * @param price Price in EUR
     * @param imageUrl Product image URL
     */
    setProductSchema(name: string, description: string, price: number, imageUrl: string): void {
        const schema = {
            '@context': 'https://schema.org',
            '@type': 'Product',
            name: name,
            description: description,
            image: imageUrl,
            brand: {
                '@type': 'Brand',
                name: 'Christian Böhme Photography'
            },
            offers: {
                '@type': 'Offer',
                price: price.toFixed(2),
                priceCurrency: 'EUR',
                availability: 'https://schema.org/InStock',
                url: 'https://christian-boehme.com/shop'
            }
        };

        this.addJsonLd(schema);
    }

    /**
     * Remove all schema scripts from document
     */
    clearAllSchemas(): void {
        if (!this.isBrowser) return;

        const scripts = document.querySelectorAll('script[id^="schema-"]');
        scripts.forEach(script => script.remove());
    }
}
