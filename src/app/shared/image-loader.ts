/**
 * Image Loader Utility
 * Provides WebP support with automatic fallback to original formats
 */

export interface ImageSource {
    webp?: string;
    original: string;
    alt: string;
}

export class ImageLoader {
    /**
     * Converts a standard image URL to WebP with fallback
     * @param url Original image URL (jpg, png, etc.)
     * @param alt Alt text for the image
     * @returns ImageSource object with webp and original URLs
     */
    static getImageSource(url: string, alt: string): ImageSource {
        // Check if already WebP
        if (url.endsWith('.webp')) {
            return { original: url, alt };
        }

        // Generate WebP URL by replacing extension
        const webpUrl = url.replace(/\.(jpg|jpeg|png)$/i, '.webp');

        return {
            webp: webpUrl,
            original: url,
            alt
        };
    }

    /**
     * Checks if browser supports WebP
     */
    static supportsWebP(): Promise<boolean> {
        return new Promise((resolve) => {
            const webP = new Image();
            webP.onload = webP.onerror = () => {
                resolve(webP.height === 2);
            };
            webP.src = 'data:image/webp;base64,UklGRjoAAABXRUJQVlA4IC4AAACyAgCdASoCAAIALmk0mk0iIiIiIgBoSygABc6WWgAA/veff/0PP8bA//LwYAAA';
        });
    }
}
