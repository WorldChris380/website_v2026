import { Routes } from '@angular/router';
import { AviationSpotterHotels } from './travel/aviation-spotter-hotels/aviation-spotter-hotels';
import { Gallery } from './gallery/gallery';
import { HomeAtf } from './homepage/home-atf/home-atf';
import { MyVisitedCountries } from './photography/my-visited-countries/my-visited-countries';
import { AboutMyPhotography } from './photography/about-my-photography/about-my-photography';
import { Career } from './career/career/career';
import { Legal } from './legal/legal';
import { AirlineSim } from './aviation/airlineSim/airlineSim';
import { AirGermany } from './aviation/airlineSim/airGermany/airGermany';
import { TwaHotelJfk } from './travel/aviation-spotter-hotels/twa-hotel-jfk/twa-hotel-jfk';
import { ShopHome } from './shop/shop-home';
import { Account } from './shop/account';
import { ShopCartPage } from './shop/shop-cart-page';
import { AdminHome } from './admin/home/admin-home';
import { TravelBudgetCalculatorComponent } from './travel-budget-planner/calculator/calculator';
import { TravelFaqs } from './travel/travel-faqs/travel-faqs';
import { TravelBudgetSummaryComponent } from './travel-budget-planner/summary/travel-budget-summary';

export const routes: Routes = [
    { path: '', component: HomeAtf },
    { path: 'gallery', component: Gallery },
    { path: 'aviation-spotter-hotels', component: AviationSpotterHotels },
    { path: 'aviation-spotter-hotels/twa-hotel-jfk', component: TwaHotelJfk },
    { path: 'shop', component: ShopHome },
    { path: 'shop/cart', component: ShopCartPage },
    { path: 'shop/account', component: Account },
    { path: 'airlinesim-ceo-tools', component: AirlineSim },
    { path: 'air-germany', component: AirGermany },
    { path: 'my-visited-countries', component: MyVisitedCountries },
    { path: 'about-my-photography', component: AboutMyPhotography },
    { path: 'career', component: Career },
    { path: 'legal', component: Legal },
    { path: 'admin', component: AdminHome },
    { path: 'travel-budget-calculator', component: TravelBudgetCalculatorComponent },
    { path: 'travel-budget-summary', component: TravelBudgetSummaryComponent },
    { path: 'travel-faqs', component: TravelFaqs },
    { path: 'travel-budget-planner', redirectTo: 'travel-budget-calculator', pathMatch: 'full' },
    { path: 'search-by-budget', redirectTo: 'travel-budget-calculator', pathMatch: 'full' }
];
