import { Component, ElementRef, HostListener, ViewChild, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { DarkModeService } from '../dark-mode.service';
import { LanguageService, Language } from '../language.service';
type MenuHeading = 'aviation' | 'blog' | 'travel' | 'career';

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

  constructor(
    private darkModeService: DarkModeService,
    private languageService: LanguageService,
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

  goBackToMainMobileMenuFunc() {
    this.openMobileDropdownMenu = null;
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
