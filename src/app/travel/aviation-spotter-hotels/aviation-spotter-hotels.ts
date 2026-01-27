import { Component, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { MetaService } from '../../services/meta.service';

@Component({
    selector: 'app-aviation-spotter-hotels',
    standalone: true,
    imports: [RouterModule],
    templateUrl: './aviation-spotter-hotels.html',
    styleUrl: './aviation-spotter-hotels.scss'
})
export class AviationSpotterHotels implements OnInit {
    protected readonly title = 'Aviation Spotter Hotels';

    constructor(private metaService: MetaService) { }

    ngOnInit(): void {
        this.metaService.updateSEO(
            {
                title: 'Aviation Spotter Hotels - Best Hotels for Plane Spotting | Christian Böhme',
                description: 'Discover the best hotels for aviation photography and plane spotting around the world. Expert hotel recommendations with optimal views of airports and runways, including the iconic TWA Hotel at JFK.',
                image: 'https://www.christian-boehme.com/assets/img/other/Qantas%20A380%20Dresden%20Autumn.jpg',
                url: 'https://www.christian-boehme.com/aviation-spotter-hotels',
                type: 'website'
            },
            {
                "@context": "https://schema.org",
                "@type": "Article",
                "headline": "Aviation Spotter Hotels",
                "description": "Guide to the best hotels for aviation photography and plane spotting worldwide",
                "author": {
                    "@type": "Person",
                    "name": "Christian Böhme",
                    "url": "https://www.christian-boehme.com"
                },
                "datePublished": "2025-01-15",
                "dateModified": "2026-01-27",
                "publisher": {
                    "@type": "Person",
                    "name": "Christian Böhme"
                },
                "mainEntityOfPage": {
                    "@type": "WebPage",
                    "@id": "https://www.christian-boehme.com/aviation-spotter-hotels"
                }
            }
        );
    }
}
