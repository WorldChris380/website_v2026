import { Injectable } from '@angular/core';
import { jsPDF } from 'jspdf';

type CertificateItem = {
    id: string;
    title: string;
    imageUrl?: string;
    originalImageUrl?: string;
    unitPrice: number;
    quantity: number;
    currency: string;
};

type CertificateOrder = {
    ownerName?: string;
    orderId: string;
    captureId: string;
    purchasedAt: string;
};

type CertificateLanguage = 'de' | 'en';

@Injectable({ providedIn: 'root' })
export class CertificateService {
    async downloadCertificate(order: CertificateOrder, item: CertificateItem, language: CertificateLanguage = 'de'): Promise<void> {
        const lang: CertificateLanguage = language === 'en' ? 'en' : 'de';
        const t = {
            heading: lang === 'de' ? 'ZERTIFIKAT LIZENZIERTER NUTZUNG' : 'CERTIFICATE OF LICENSED USE',
            subheading: lang === 'de' ? 'Fine Art Aviation- und Reisefotografie' : 'Fine Art Aviation and Travel Photography',
            imagePreviewMissing: lang === 'de' ? 'Bildvorschau nicht verfuegbar' : 'Image preview not available',
            certificateId: lang === 'de' ? 'Zertifikats-ID' : 'Certificate ID',
            licenseHolder: lang === 'de' ? 'Lizenznehmer' : 'License holder',
            imageTitle: lang === 'de' ? 'Bildtitel' : 'Image title',
            imageId: lang === 'de' ? 'Bild-ID' : 'Image ID',
            quantity: lang === 'de' ? 'Menge' : 'Quantity',
            unitPrice: lang === 'de' ? 'Preis pro Einheit' : 'Unit price',
            lineTotal: lang === 'de' ? 'Gesamtpreis Position' : 'Line total',
            orderDate: lang === 'de' ? 'Bestelldatum' : 'Order date',
            orderId: lang === 'de' ? 'Bestell-ID' : 'Order ID',
            captureId: 'Capture ID',
            footerLine1: lang === 'de'
                ? 'Diese Urkunde bestaetigt ausschliesslich den Erwerb einer Nutzungslizenz.'
                : 'This document certifies the purchase of a usage license only.',
            footerLine2: lang === 'de'
                ? 'Ein Eigentumsuebergang am Bildwerk ist hiermit nicht verbunden.'
                : 'No transfer of ownership of the image itself is implied.',
            fallbackHolder: lang === 'de' ? 'Lizenznehmer' : 'License holder',
        };
        const purchasedAt = new Date(order.purchasedAt);
        const dateLabel = isNaN(purchasedAt.getTime()) ? order.purchasedAt : purchasedAt.toLocaleString('de-DE');
        const imageCandidates = [
            item.originalImageUrl,
            item.imageUrl
        ]
            .filter((value): value is string => !!value)
            .map((value) => this.toAbsoluteImageUrl(value));
        const proxiedCandidates = imageCandidates.map((value) => this.toProxyImageUrl(value));
        const certificateId = `${order.captureId}-${item.id}`;

        const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
        doc.setFillColor(247, 250, 252);
        doc.rect(0, 0, 297, 210, 'F');

        doc.setFillColor(18, 36, 74);
        doc.rect(0, 0, 297, 36, 'F');
        doc.setFillColor(37, 99, 235);
        doc.rect(0, 32, 297, 4, 'F');

        doc.setDrawColor(191, 219, 254);
        doc.setLineWidth(0.8);
        doc.roundedRect(10, 16, 277, 184, 3, 3, 'S');
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(12, 18, 273, 180, 2.5, 2.5, 'F');

        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.text('CHRISTIAN BOEHME SHOP', 18, 13);

        doc.setTextColor(30, 58, 138);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(24);
        doc.text(t.heading, 148.5, 33, { align: 'center' });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(11);
        doc.setTextColor(71, 85, 105);
        doc.text(t.subheading, 148.5, 40, { align: 'center' });

        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(16, 48, 118, 92, 2, 2, 'S');

        const imageData = await this.toDataUrlWithFallback([...imageCandidates, ...proxiedCandidates]);
        if (imageData) {
            doc.addImage(imageData, this.detectImageFormat(imageData), 18, 50, 114, 88);
        } else {
            doc.setFillColor(248, 250, 252);
            doc.roundedRect(18, 50, 114, 88, 2, 2, 'F');
            doc.setDrawColor(203, 213, 225);
            doc.roundedRect(18, 50, 114, 88, 2, 2, 'S');
            doc.setTextColor(100, 116, 139);
            doc.setFontSize(11);
            doc.text(t.imagePreviewMissing, 75, 95, { align: 'center' });
        }

        doc.setFillColor(248, 250, 252);
        doc.roundedRect(140, 48, 139, 132, 2, 2, 'F');
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(140, 48, 139, 132, 2, 2, 'S');

        doc.setTextColor(15, 23, 42);
        doc.setFontSize(10.5);
        const lines: Array<[string, string]> = [
            [t.certificateId, certificateId],
            [t.licenseHolder, (order.ownerName || t.fallbackHolder).trim()],
            [t.imageTitle, item.title],
            [t.imageId, item.id],
            [t.quantity, String(item.quantity)],
            [t.unitPrice, `${item.unitPrice.toFixed(2)} ${item.currency}`],
            [t.lineTotal, `${(item.unitPrice * item.quantity).toFixed(2)} ${item.currency}`],
            [t.orderDate, dateLabel],
            [t.orderId, order.orderId],
            [t.captureId, order.captureId],
        ];

        let y = 58;
        for (const [label, value] of lines) {
            doc.setFont('helvetica', 'bold');
            doc.text(`${label}:`, 146, y);
            doc.setFont('helvetica', 'normal');
            const wrapped = doc.splitTextToSize(value, 82);
            doc.text(wrapped, 195, y);
            y += Math.max(6.6, wrapped.length * 4.9);
        }

        doc.setDrawColor(37, 99, 235);
        doc.setLineWidth(0.5);
        doc.line(16, 186, 281, 186);

        doc.setFont('helvetica', 'italic');
        doc.setFontSize(9.5);
        doc.setTextColor(51, 65, 85);
        doc.text(t.footerLine1, 16, 192);
        doc.text(t.footerLine2, 16, 197);
        doc.setTextColor(100, 116, 139);
        doc.setFont('helvetica', 'normal');
        doc.text('christian-boehme.com', 281, 197, { align: 'right' });

        doc.save(`certificate-${this.slug(item.title)}-${item.id}.pdf`);
    }

    downloadOriginalPhoto(item: { id: string; title: string; originalImageUrl?: string; imageUrl?: string }): void {
        const imageUrl = this.toAbsoluteImageUrl(item.originalImageUrl || item.imageUrl || '');
        if (!imageUrl) return;
        const anchor = document.createElement('a');
        anchor.href = imageUrl;
        anchor.target = '_blank';
        anchor.rel = 'noopener';
        anchor.download = `${this.slug(item.title)}-${item.id}.jpg`;
        anchor.click();
    }

    private toAbsoluteImageUrl(value: string): string {
        if (!value) return '';
        const raw = value.trim();
        if (!raw) return '';

        try {
            if (/^https?:\/\//i.test(raw)) {
                return encodeURI(raw);
            }

            return encodeURI(`${window.location.origin}${raw.startsWith('/') ? '' : '/'}${raw}`);
        } catch {
            return raw;
        }
    }

    private toProxyImageUrl(absoluteUrl: string): string {
        if (!absoluteUrl) return '';
        return `${window.location.origin}/api/image-proxy.php?url=${encodeURIComponent(absoluteUrl)}`;
    }

    private slug(value: string): string {
        const slug = value
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 42);
        return slug || 'image';
    }

    private detectImageFormat(dataUrl: string): 'JPEG' | 'PNG' {
        return dataUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG';
    }

    private async toDataUrlWithFallback(urls: string[]): Promise<string | null> {
        const uniqueUrls = Array.from(new Set(urls.filter(Boolean)));
        for (const url of uniqueUrls) {
            const image = await this.toDataUrl(url);
            if (image) {
                return image;
            }
        }
        return null;
    }

    private async toDataUrl(url: string): Promise<string | null> {
        try {
            const response = await fetch(url, { mode: 'cors', credentials: 'omit' });
            if (response.ok) {
                const blob = await response.blob();
                const dataUrl = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(String(reader.result || ''));
                    reader.onerror = () => reject(new Error('Failed to read image data.'));
                    reader.readAsDataURL(blob);
                });
                if (dataUrl.startsWith('data:image/')) {
                    return dataUrl;
                }
            }
        } catch {
            // Continue with image fallback.
        }

        try {
            return await new Promise<string | null>((resolve) => {
                const img = new Image();
                img.crossOrigin = 'anonymous';
                img.referrerPolicy = 'no-referrer';
                img.onload = () => {
                    try {
                        const canvas = document.createElement('canvas');
                        canvas.width = img.naturalWidth || img.width;
                        canvas.height = img.naturalHeight || img.height;
                        const ctx = canvas.getContext('2d');
                        if (!ctx) {
                            resolve(null);
                            return;
                        }
                        ctx.drawImage(img, 0, 0);
                        resolve(canvas.toDataURL('image/jpeg', 0.92));
                    } catch {
                        resolve(null);
                    }
                };
                img.onerror = () => resolve(null);
                img.src = url;
            });
        } catch {
            return null;
        }
    }
}
