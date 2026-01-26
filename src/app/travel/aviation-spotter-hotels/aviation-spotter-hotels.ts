import { Component, OnInit } from '@angular/core';
import { MetaService } from '../../services/meta.service';

@Component({
    selector: 'app-aviation-spotter-hotels',
    standalone: true,
    imports: [],
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
                description: 'Discover the best hotels for aviation photography and plane spotting around the world. Hotel recommendations with optimal views of airports and runways.',
                image: 'https://www.christian-boehme.com/assets/img/other/Dresden%20Skyline.jpg',
                url: 'https://www.christian-boehme.com/aviation-spotter-hotels',
                type: 'website'
            },
            {
                "@context": "https://schema.org",
                "@type": "Article",
                "headline": "Aviation Spotter Hotels",
                "description": "Guide to the best hotels for aviation photography and plane spotting",
                "author": {
                    "@type": "Person",
                    "name": "Christian Böhme"
                }
            }
        );
    }
}
