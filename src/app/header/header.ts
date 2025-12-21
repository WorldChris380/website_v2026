import { Component, ElementRef, HostListener, ViewChild, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
type MenuHeading = 'photography' | 'blog' | 'travel' | 'career';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './header.html',
  styleUrl: './header.scss',
})

export class Header {
  darkmode: boolean = false;
  burgerMenuOpen: boolean = false;
  burgerMenuClosing: boolean = false;
  openDesktopDropdownMenu: MenuHeading | null = null;
  openMobileDropdownMenu: MenuHeading | null = null;

  ngOnInit() {
    let darkmodeLocalStorage = localStorage.getItem('darkmode');
    if (darkmodeLocalStorage === 'true') {
      this.darkmode = true;
    } else {
      this.darkmode = false;
    }
    document.body.classList.toggle('dark-mode', this.darkmode);
  }

  setDesktopDropdown(menuItem: MenuHeading | null) {
    this.openDesktopDropdownMenu = menuItem;
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

  // Dark mode implementation and logo and icons adjustments
  toggleDarkMode() {
    this.darkmode = !this.darkmode;
    document.body.classList.toggle('dark-mode', this.darkmode);
    localStorage.setItem("darkmode", this.darkmode ? "true" : "false");
  }

  darkmodePNG(name: string) {
    if (this.darkmode) {
      return `/assets/img/icons-and-logos/${name}-white.png`;
    } else {
      return `/assets/img/icons-and-logos/${name}-black.png`;
    }
  }
}
