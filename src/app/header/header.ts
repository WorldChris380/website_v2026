import { Component, ElementRef, HostListener, ViewChild, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { DarkModeService } from '../dark-mode.service';
import { LanguageService, Language } from '../language.service';
import { ShopService } from '../shop/shop.service';
type MenuHeading = 'aviation' | 'blog' | 'travel' | 'shop' | 'career' | 'photography';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './header.html',
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

  get cartQuantity(): number {
    return this.shopService.totalQuantity();
  }

  constructor(
    private darkModeService: DarkModeService,
    private languageService: LanguageService,
    private shopService: ShopService,
    private cdr: ChangeDetectorRef
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
}
