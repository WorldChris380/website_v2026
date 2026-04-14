import { Routes } from '@angular/router';

export const routes: Routes = [
    { path: '', loadComponent: () => import('./homepage/home-atf/home-atf').then(m => m.HomeAtf) },
    { path: 'gallery', loadComponent: () => import('./gallery/gallery').then(m => m.Gallery) },
    { path: 'aviation-spotter-hotels', loadComponent: () => import('./travel/aviation-spotter-hotels/aviation-spotter-hotels').then(m => m.AviationSpotterHotels) },
    { path: 'aviation-spotter-hotels/twa-hotel-jfk', loadComponent: () => import('./travel/aviation-spotter-hotels/twa-hotel-jfk/twa-hotel-jfk').then(m => m.TwaHotelJfk) },
    { path: 'shop', redirectTo: 'shop/cart', pathMatch: 'full' },
    { path: 'shop/cart', loadComponent: () => import('./shop/shop-cart-page').then(m => m.ShopCartPage) },
    { path: 'shop/success', loadComponent: () => import('./shop/shop-success').then(m => m.ShopSuccess) },
    { path: 'shop/account', loadComponent: () => import('./shop/account').then(m => m.Account) },
    { path: 'airlinesim-ceo-tools', loadComponent: () => import('./aviation/airlineSim/airlineSim').then(m => m.AirlineSim) },
    { path: 'air-germany', loadComponent: () => import('./aviation/airlineSim/airGermany/airGermany').then(m => m.AirGermany) },
    { path: 'my-visited-countries', loadComponent: () => import('./photography/my-visited-countries/my-visited-countries').then(m => m.MyVisitedCountries) },
    { path: 'about-my-photography', loadComponent: () => import('./photography/about-my-photography/about-my-photography').then(m => m.AboutMyPhotography) },
    { path: 'career', loadComponent: () => import('./career/career/career').then(m => m.Career) },
    { path: 'legal', loadComponent: () => import('./legal/legal').then(m => m.Legal) },
    { path: 'admin', loadComponent: () => import('./admin/home/admin-home').then(m => m.AdminHome) },
    { path: 'travel-budget-calculator', loadComponent: () => import('./travel-budget-planner/calculator/calculator').then(m => m.TravelBudgetCalculatorComponent) },
    { path: 'travel-budget-summary', loadComponent: () => import('./travel-budget-planner/summary/travel-budget-summary').then(m => m.TravelBudgetSummaryComponent) },
    { path: 'travel-faqs', loadComponent: () => import('./travel/travel-faqs/travel-faqs').then(m => m.TravelFaqs) },
    { path: 'travel-budget-planner', redirectTo: 'travel-budget-calculator', pathMatch: 'full' },
    { path: 'search-by-budget', redirectTo: 'travel-budget-calculator', pathMatch: 'full' }
];
