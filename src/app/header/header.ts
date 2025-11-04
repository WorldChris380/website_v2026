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
  @ViewChild('photographyDropdownList', { static: true }) photographyDropdownList!: ElementRef<HTMLDivElement>;
  @ViewChild('careerDropdownList', { static: true }) careerDropdownList!: ElementRef<HTMLDivElement>;
  @ViewChild('blogDropdownList', { static: true }) blogDropdownList!: ElementRef<HTMLDivElement>;
  @ViewChild('adobeStockLogoDropDownMenu', { static: true }) adobeStockLogoDropDownMenu!: ElementRef<HTMLImageElement>;
  @ViewChild('openInNewTabIcon', { static: true }) openInNewTabIcon!: ElementRef<HTMLImageElement>;
  @ViewChild('githubLogoDropDownMenu', { static: true }) githubLogoDropDownMenu!: ElementRef<HTMLImageElement>;
  @ViewChild('linkedInLogoDropDownMenu', { static: true }) linkedInLogoDropDownMenu!: ElementRef<HTMLImageElement>;

  ngOnInit() {
    // Set theme to local storage value
    if (typeof window !== 'undefined' && window.localStorage) {
      const theme = localStorage.getItem('data-theme');
      if (theme === 'dark') {
        this.turnOnDarkMode();
        document.body.classList.add('dark-mode');
      } else {
        this.turnOnLightMode();
        document.body.classList.remove('dark-mode');
      }
    }
  }

  openDropdownMenu(menuItem: string) {
    let dropdown: HTMLElement;

    if (menuItem === 'photography') {
      dropdown = this.photographyDropdownList.nativeElement;
    } else if (menuItem === 'career') {
      dropdown = this.careerDropdownList.nativeElement;
    } else if (menuItem === 'blog') {
      dropdown = this.blogDropdownList.nativeElement;
    } else {
      return;
    }

    dropdown.classList.add('open');
  }

  closeDropdownMenu(menuItem: string) {
    let dropdown: HTMLElement;

    if (menuItem === 'photography') {
      dropdown = this.photographyDropdownList.nativeElement;
    } else if (menuItem === 'career') {
      dropdown = this.careerDropdownList.nativeElement;
    } else if (menuItem === 'blog') {
      dropdown = this.blogDropdownList.nativeElement;
    } else {
      return;
    }

    dropdown.classList.remove('open');
  }

  toggleBurgerMenu() {
    const isOpen = this.burgerMenuContent.nativeElement.style.display === 'flex';
    if (isOpen === true) {
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

  // Close burger menu on window resize
  @HostListener('window:resize', ['$event'])
  onResize(event: Event) {
    const width = (event.target as Window).innerWidth;
    this.closeBurgerMenu()
  }

  // Dark mode implementation
  toggleDarkMode() {
    if (this.lightIcon.nativeElement.style.display === 'flex') {
      this.turnOnLightMode();
      document.body.classList.remove('dark-mode');

      localStorage.setItem("data-theme", "light");
    } else {
      this.turnOnDarkMode();
      document.body.classList.add('dark-mode');

      localStorage.setItem("data-theme", "dark");
    }
  }
  turnOnDarkMode() {
    this.moonIcon.nativeElement.style.display = 'none';
    this.lightIcon.nativeElement.style.display = 'flex';
    this.moonIconBurger.nativeElement.style.display = 'none';
    this.lightIconBurger.nativeElement.style.display = 'flex';
    this.adobeStockLogoDropDownMenu.nativeElement.src = "/assets/img/logos/adobe-stock-logo-white.png";
    this.openInNewTabIcon.nativeElement.src = "/assets/img/icons/open-in-new-tab-icon-white.png";
    this.githubLogoDropDownMenu.nativeElement.src = "/assets/img/logos/GitHub-logo-white.png";
    this.linkedInLogoDropDownMenu.nativeElement.src = "/assets/img/logos/linkedIn-logo-white.png";
  }

  turnOnLightMode() {
    this.moonIcon.nativeElement.style.display = 'flex';
    this.lightIcon.nativeElement.style.display = 'none';
    this.moonIconBurger.nativeElement.style.display = 'flex';
    this.lightIconBurger.nativeElement.style.display = 'none';
    this.adobeStockLogoDropDownMenu.nativeElement.src = "/assets/img/logos/adobe-stock-logo-black.png";
    this.openInNewTabIcon.nativeElement.src = "/assets/img/icons/open-in-new-tab-icon-black.png";
    this.githubLogoDropDownMenu.nativeElement.src = "/assets/img/logos/GitHub-logo-black.png";
    this.linkedInLogoDropDownMenu.nativeElement.src = "/assets/img/logos/linkedIn-logo-black.png";
  }
}
