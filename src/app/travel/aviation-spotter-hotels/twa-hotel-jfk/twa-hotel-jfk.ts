import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MetaService } from '../../../services/meta.service';

@Component({
    selector: 'app-twa-hotel-jfk',
    standalone: true,
    imports: [CommonModule, RouterModule],
    templateUrl: './twa-hotel-jfk.html',
    styleUrl: './twa-hotel-jfk.scss'
})
export class TwaHotelJfk implements OnInit {
    protected readonly title = 'TWA Hotel – JFK';

    constructor(private metaService: MetaService) { }

    ngOnInit(): void {
        this.metaService.updateSEO(
            {
                title: 'TWA Hotel – JFK Spotter Guide | Christian Böhme',
                description: 'All you need to know about plane spotting at the TWA Hotel, JFK: runway views, best rooms, shooting angles, and practical tips.',
                image: 'https://www.christian-boehme.com/assets/img/other/Dresden%20Skyline.jpg',
                url: 'https://www.christian-boehme.com/aviation-spotter-hotels/twa-hotel-jfk',
                type: 'article'
            },
            {
                "@context": "https://schema.org",
                "@type": "Article",
                "headline": "TWA Hotel – JFK Spotter Guide",
                "description": "Room recommendations, runway views, and tips for photographing aircraft from the TWA Hotel at JFK.",
                "author": {
                    "@type": "Person",
                    "name": "Christian Böhme"
                }
            }
        );
    }
}
