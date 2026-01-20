import { Routes } from '@angular/router';
import { PhotographyTravels } from './travel/photography-travels/photography-travels';
import { AviationSpotterHotels } from './travel/aviation-spotter-hotels/aviation-spotter-hotels';
import { Gallery } from './gallery/gallery';
import { HomeAtf } from './homepage/home-atf/home-atf';
import { MyVisitedCountries } from './photography/my-visited-countries/my-visited-countries';
import { Career } from './career-preview/career/career';
import { Legal } from './legal/legal';

export const routes: Routes = [
    { path: '', component: HomeAtf },
    { path: 'gallery', component: Gallery },
    { path: 'photography-travels', component: PhotographyTravels },
    { path: 'aviation-spotter-hotels', component: AviationSpotterHotels },
    { path: 'my-visited-countries', component: MyVisitedCountries },
    { path: 'career', component: Career },
    { path: 'legal', component: Legal }
];
