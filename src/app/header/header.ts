import { Component, ViewChild, ElementRef, HostListener, OnInit } from '@angular/core';
@Component({
  selector: 'app-header',
  standalone: true,
  templateUrl: './header.html',
  styleUrl: './header.scss',
})
export class Header {
  @ViewChild('burgerMenuOpenIcon', { static: true }) burgerMenuOpenIcon!: ElementRef<HTMLButtonElement>;
  @ViewChild('burgerMenuCloseIcon', { static: true }) burgerMenuCloseIcon!: ElementRef<HTMLButtonElement>;
  @ViewChild('burgerMenuContent', { static: true }) burgerMenuContent!: ElementRef<HTMLDivElement>;
  @ViewChild('moonIcon', { static: true }) moonIcon!: ElementRef<HTMLSpanElement>;
  @ViewChild('lightIcon', { static: true }) lightIcon!: ElementRef<HTMLSpanElement>;
  @ViewChild('moonIconBurger', { static: true }) moonIconBurger!: ElementRef<HTMLSpanElement>;
  @ViewChild('lightIconBurger', { static: true }) lightIconBurger!: ElementRef<HTMLSpanElement>;

  ngOnInit() {
    // Set theme to local storage value
    if (typeof window !== 'undefined' && window.localStorage) {
      const theme = localStorage.getItem('data-theme');
      if (theme === 'dark') {
        this.turnOnLightMode();
        document.body.classList.add('dark-mode');
      } else {
        this.turnOnDarkMode();
        document.body.classList.remove('dark-mode');
      }
    }
  }

  toggleDropdown(menu: string) {
    const dropdown = document.getElementById(`dropdown-${menu}`);
    if (dropdown) {
      // Überprüfe, ob das Dropdown bereits geöffnet ist
      const isOpen = dropdown.style.maxHeight && dropdown.style.maxHeight !== '0px';

      if (isOpen) {
        // Dropdown schließen
        dropdown.style.maxHeight = '0';
        dropdown.style.opacity = '0';
      } else {
        // Dropdown öffnen
        dropdown.style.maxHeight = '500px';
        dropdown.style.opacity = '1';
      }
    }
  }

  toggleBurgerMenu() {
    if (this.burgerMenuOpenIcon.nativeElement.style.display == 'none') {
      this.closeBurgerMenu();
    }
    else {
      this.openBurgerMenu();
    }
  }

  openBurgerMenu() {
    this.burgerMenuOpenIcon.nativeElement.style.display = 'none';
    this.burgerMenuCloseIcon.nativeElement.style.display = 'flex';
    this.burgerMenuContent.nativeElement.style.display = 'flex';
  }

  closeBurgerMenu() {
    this.burgerMenuCloseIcon.nativeElement.style.display = 'none';
    this.burgerMenuOpenIcon.nativeElement.style.display = 'flex';
    this.burgerMenuContent.nativeElement.style.display = 'none';
  }

  //Close burger menu on window resize
  @HostListener('window:resize', ['$event'])
  onResize(event: Event) {
    const width = (event.target as Window).innerWidth;
    this.closeBurgerMenu()
  }

  toggleDarkMode() {
    if (this.moonIcon.nativeElement.style.display !== 'none') {
      this.turnOnLightMode();
      document.body.classList.add('dark-mode');
      localStorage.setItem("data-theme", "dark");
    } else {
      this.turnOnDarkMode();
      document.body.classList.remove('dark-mode');
      localStorage.setItem("data-theme", "light");
    }
  }

  turnOnLightMode() {
    this.moonIcon.nativeElement.style.display = 'none';
    this.lightIcon.nativeElement.style.display = 'flex';
    this.moonIconBurger.nativeElement.style.display = 'none';
    this.lightIconBurger.nativeElement.style.display = 'flex';
  }

  turnOnDarkMode() {
    this.moonIcon.nativeElement.style.display = 'flex';
    this.lightIcon.nativeElement.style.display = 'none';
    this.moonIconBurger.nativeElement.style.display = 'flex';
    this.lightIconBurger.nativeElement.style.display = 'none';
  }
}