import { Component, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { MetaService } from '../../services/meta.service';

@Component({
    selector: 'app-photography-travels',
    standalone: true,
    imports: [RouterModule],
    templateUrl: './photography-travels.html',
    styleUrl: './photography-travels.scss'
})
export class PhotographyTravels implements OnInit {
    protected readonly title = 'Photography Travels';

    constructor(private metaService: MetaService) { }

    ngOnInit(): void {
        this.metaService.updateSEO(
            {
                title: 'Photography Travels - World Travel Stories | Christian Böhme',
                description: 'Explore travel stories and photography journeys from around the world. Detailed travel guides and photography tips from visited destinations.',
                image: 'https://www.christian-boehme.com/assets/img/other/Dresden%20Skyline.jpg',
                url: 'https://www.christian-boehme.com/photography-travels',
                type: 'website'
            },
            {
                "@context": "https://schema.org",
                "@type": "TravelAction",
                "name": "Photography Travels",
                "description": "Travel photography and stories from around the world"
            }
        );
    }
}
