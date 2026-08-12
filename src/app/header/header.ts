import { Component, ElementRef, HostListener, ViewChild, OnInit, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';

import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { DarkModeService } from '../dark-mode.service';
import { LanguageService, Language } from '../language.service';
import { ShopService } from '../shop/shop.service';
import { ShopAuthService } from '../shop/shop-auth.service';
import { filter } from 'rxjs/operators';
type MenuHeading = 'aviation' | 'blog' | 'travel' | 'shop' | 'career' | 'photography';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './header.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './header.scss',
})

export class Header implements OnInit {
  darkmode: boolean = false;
  currentLanguage: Language = 'en';
  burgerMenuOpen: boolean = false;
  burgerMenuClosing: boolean = false;
  openDesktopDropdownMenu: MenuHeading | null = null;
  openDesktopSubDropdownMenu: string | null = null;
  openMobileDropdownMenu: MenuHeading | null = null;
  openMobileSubDropdownMenu: string | null = null;
  isLoading: boolean = false;
  megamenuOpen: boolean = false;
  megamenuPanelWidth: number | null = null;
  private megamenuCloseTimeout: ReturnType<typeof setTimeout> | null = null;

  @ViewChild('desktopMegaNav') desktopMegaNavRef?: ElementRef<HTMLElement>;
  currentPageTitleShort: string = '';
  currentPageSection: MenuHeading = 'career';

  get cartQuantity(): number {
    return this.shopService.totalQuantity();
  }

  get isShopAuthenticated(): boolean {
    return this.shopAuthService.isAuthenticated();
  }

  constructor(
    private darkModeService: DarkModeService,
    private languageService: LanguageService,
    private shopService: ShopService,
    private shopAuthService: ShopAuthService,
    private cdr: ChangeDetectorRef,
    private router: Router,
  ) { }

  ngOnInit() {
    // Subscribe to Dark Mode changes
    this.darkmode = this.darkModeService.isDarkMode();
    this.darkModeService.darkmode$.subscribe((isDark) => {
      this.darkmode = isDark;
      this.cdr.markForCheck();
    });

    // Subscribe to Language changes
    this.currentLanguage = this.languageService.getCurrentLanguage();
    this.languageService.language$.subscribe((lang) => {
      this.currentLanguage = lang;
      this.updateCurrentPageTitle();
      this.cdr.markForCheck();
    });

    this.updateCurrentPageTitle();
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => {
        this.updateCurrentPageTitle();
        this.cdr.markForCheck();
      });

    // Track page loading state
    this.isLoading = true;
    window.addEventListener('load', () => {
      this.isLoading = false;
      this.cdr.markForCheck();
    });
  }

  setDesktopDropdown(menuItem: MenuHeading | null) {
    this.openDesktopDropdownMenu = menuItem;
  }

  setDesktopSubDropdown(submenuItem: string | null) {
    this.openDesktopSubDropdownMenu = submenuItem;
  }

  setMegamenuOpen(open: boolean) {
    this.cancelMegamenuClose();

    if (open) {
      this.megamenuOpen = true;
      this.updateMegamenuPanelWidth();
      return;
    }

    // Delay closing so the cursor can cross the gap between the nav link
    // and the panel below it without the menu vanishing first.
    this.megamenuCloseTimeout = setTimeout(() => {
      this.megamenuOpen = false;
      this.openDesktopDropdownMenu = null;
      this.megamenuCloseTimeout = null;
      this.cdr.markForCheck();
    }, 250);
  }

  private cancelMegamenuClose(): void {
    if (this.megamenuCloseTimeout) {
      clearTimeout(this.megamenuCloseTimeout);
      this.megamenuCloseTimeout = null;
    }
  }

  private updateMegamenuPanelWidth(): void {
    const nav = this.desktopMegaNavRef?.nativeElement;
    if (nav) {
      this.megamenuPanelWidth = nav.offsetWidth;
    }
  }

  handleMegamenuClick(event: Event): void {
    const target = event.target as HTMLElement | null;
    if (!target) {
      return;
    }

    if (target.closest('a, button')) {
      this.megamenuOpen = false;
      this.openDesktopDropdownMenu = null;
    }
  }

  toggleMegamenu() {
    this.megamenuOpen = !this.megamenuOpen;
  }

  toggleBurgerMenu() {
    if (!this.burgerMenuOpen) {
      this.burgerMenuOpen = true;
      return;
    }
    this.burgerMenuClosing = true;
    setTimeout(() => {
      this.burgerMenuOpen = false;
      this.burgerMenuClosing = false;
    }, 100);
  }

  // Close burger menu on window resize
  @HostListener('window:resize', ['$event'])
  onResize(event: Event) {
    const width = (event.target as Window).innerWidth;
    this.burgerMenuOpen = false;
    if (this.megamenuOpen) {
      this.updateMegamenuPanelWidth();
    }
  }

  //Toggle mobile Dropdown menus
  toggleMobileDropdownMenu(menuItem: MenuHeading) {
    if (this.openMobileDropdownMenu === menuItem) {
      this.openMobileDropdownMenu = null;
    } else {
      this.openMobileDropdownMenu = menuItem;
    }
  }

  //Toggle mobile Submenu
  toggleMobileSubDropdownMenu(submenuItem: string) {
    if (this.openMobileSubDropdownMenu === submenuItem) {
      this.openMobileSubDropdownMenu = null;
    } else {
      this.openMobileSubDropdownMenu = submenuItem;
    }
  }

  goBackToMainMobileMenuFunc() {
    this.openMobileDropdownMenu = null;
  }

  closeMenuAfterNavigation() {
    this.burgerMenuClosing = true;
    setTimeout(() => {
      this.burgerMenuOpen = false;
      this.burgerMenuClosing = false;
      this.openMobileDropdownMenu = null;
    }, 300);
  }

  // Dark mode implementation
  toggleDarkMode() {
    this.darkModeService.toggleDarkMode();
  }

  // Language implementation
  toggleLanguage() {
    this.languageService.toggleLanguage();
  }

  getTranslation(key: string): string {
    return this.languageService.getTranslation(key);
  }

  darkmodePNG(name: string) {
    return this.darkModeService.darkmodePNG(name);
  }

  darkmodeSVG(name: string) {
    return this.darkModeService.darkmodeSVG(name);
  }

  handleShopAccountAction(): void {
    if (this.isShopAuthenticated) {
      this.shopAuthService.logout();
      this.megamenuOpen = false;
      this.router.navigate(['/shop/account']);
      return;
    }

    this.megamenuOpen = false;
    this.router.navigate(['/shop/account']);
  }

  handleShopAccountActionMobile(): void {
    if (this.isShopAuthenticated) {
      this.shopAuthService.logout();
    }

    this.closeMenuAfterNavigation();
    this.router.navigate(['/shop/account']);
  }

  private updateCurrentPageTitle(): void {
    const path = this.router.url.split('?')[0].split('#')[0].replace(/^\//, '');
    const key = path || 'home';

    const byPath: Record<string, string> = {
      home: '',
      'travel-budget-calculator': 'Travel Budget Calculator',
      'travel-faqs': this.currentLanguage === 'de' ? 'Travel FAQs' : 'Travel FAQs',
      'aviation-spotter-hotels': this.currentLanguage === 'de' ? 'Spotter Hotels' : 'Spotter Hotels',
      'photography': this.currentLanguage === 'de' ? 'Fotografie' : 'Photography',
      'gallery': this.currentLanguage === 'de' ? 'Fotografie' : 'Photography',
      'shop': 'Shop',
      'shop/cart': this.currentLanguage === 'de' ? 'Warenkorb' : 'Cart',
      'shop/account': this.currentLanguage === 'de' ? 'Konto' : 'Account',
      'air-germany': 'Air Germany',
      'airlinesim-ceo-tools': 'AirlineSim Tools',
      'my-visited-countries': this.currentLanguage === 'de' ? 'Länderkarte' : 'Countries Map',
      'about-my-photography': this.currentLanguage === 'de' ? 'Meine Fotografie' : 'My Photography',
      'career': this.currentLanguage === 'de' ? 'Karriere' : 'Career',
      'legal': this.currentLanguage === 'de' ? 'Rechtliches' : 'Legal',
      'admin': 'Admin',
    };

    const fallback = key
      .split('/')
      .pop()
      ?.split('-')
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ') ?? '';

    const rawTitle = byPath[key] ?? fallback;
    this.currentPageTitleShort = rawTitle.length > 24 ? `${rawTitle.slice(0, 24)}...` : rawTitle;

    const sectionByPath: Record<string, MenuHeading> = {
      home: 'career',
      'travel-budget-calculator': 'travel',
      'travel-faqs': 'travel',
      'aviation-spotter-hotels': 'aviation',
      'aviation-spotter-hotels/twa-hotel-jfk': 'aviation',
      'air-germany': 'aviation',
      'airlinesim-ceo-tools': 'aviation',
      'photography': 'photography',
      'gallery': 'photography',
      'about-my-photography': 'photography',
      'my-visited-countries': 'travel',
      'shop': 'shop',
      'shop/cart': 'shop',
      'shop/account': 'shop',
      'career': 'career',
      'legal': 'career',
      'admin': 'career',
    };

    this.currentPageSection = sectionByPath[key] ?? 'career';
  }
}
