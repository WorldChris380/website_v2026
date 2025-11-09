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
  @ViewChild('moonIconBurger', { static: false }) moonIconBurger!: ElementRef<HTMLSpanElement>;
  @ViewChild('lightIconBurger', { static: false }) lightIconBurger!: ElementRef<HTMLSpanElement>;
  @ViewChild('photographyDropdownList', { static: true }) photographyDropdownList!: ElementRef<HTMLDivElement>;
  @ViewChild('careerDropdownList', { static: true }) careerDropdownList!: ElementRef<HTMLDivElement>;
  @ViewChild('blogDropdownList', { static: true }) blogDropdownList!: ElementRef<HTMLDivElement>;
  @ViewChild('adobeStockLogoDropDownMenu', { static: true }) adobeStockLogoDropDownMenu!: ElementRef<HTMLImageElement>;
  @ViewChild('openInNewTabIcon', { static: true }) openInNewTabIcon!: ElementRef<HTMLImageElement>;
  @ViewChild('githubLogoDropDownMenu', { static: true }) githubLogoDropDownMenu!: ElementRef<HTMLImageElement>;
  @ViewChild('linkedInLogoDropDownMenu', { static: true }) linkedInLogoDropDownMenu!: ElementRef<HTMLImageElement>;
  @ViewChild('mobilePhotographyDropdown', { static: true }) mobilePhotographyDropdown!: ElementRef<HTMLDivElement>;
  @ViewChild('mobileBlogDropdown', { static: true }) mobileBlogDropdown!: ElementRef<HTMLDivElement>;
  @ViewChild('mobileCareerDropdown', { static: true }) mobileCareerDropdown!: ElementRef<HTMLDivElement>;
  @ViewChild('mobilePhotographyLink', { static: true }) mobilePhotographyLink!: ElementRef<HTMLAnchorElement>;
  @ViewChild('mobileBlogLink', { static: true }) mobileBlogLink!: ElementRef<HTMLAnchorElement>;
  @ViewChild('mobileCareerLink', { static: true }) mobileCareerLink!: ElementRef<HTMLAnchorElement>;
  @ViewChild('adobeStockLogoMobileDropDownMenu', { static: false }) adobeStockLogoMobileDropDownMenu!: ElementRef<HTMLImageElement>;
  @ViewChild('openInNewTabIconMobileDropdown', { static: false }) openInNewTabIconMobileDropdown!: ElementRef<HTMLImageElement>;
  @ViewChild('githubLogoMobileDropDownMenu', { static: false }) githubLogoMobileDropDownMenu!: ElementRef<HTMLImageElement>
  @ViewChild('linkedInLogoMobileDropDownMenu', { static: false }) linkedInLogoMobileDropDownMenu!: ElementRef<HTMLImageElement>;
  @ViewChild('burgerMenuMainContent', { static: false }) burgerMenuMainContent!: ElementRef<HTMLDivElement>;
  @ViewChild('goBackToMainMobileMenu', { static: false }) goBackToMainMobileMenu!: ElementRef<HTMLAnchorElement>;

  ngAfterViewInit() {
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
    const isOpen = this.burgerMenuOpenIcon.nativeElement.style.display === 'none';
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
    this.burgerMenuContent.nativeElement.style.top = '41px';
    this.burgerMenuContent.nativeElement.style.overflow = 'visible';
    this.burgerMenuContent.nativeElement.style.setProperty('width', '100vw', 'important');
    this.burgerMenuContent.nativeElement.classList.add('open')
    this.burgerMenuContent.nativeElement.classList.remove('close');
    this.burgerMenuContent.nativeElement.style.paddingTop = '8px';
  }

  closeBurgerMenu() {
    this.burgerMenuCloseIcon.nativeElement.style.display = 'none';
    this.burgerMenuOpenIcon.nativeElement.style.display = 'flex';
    this.burgerMenuContent.nativeElement.style.overflow = 'hidden';
    this.burgerMenuContent.nativeElement.classList.remove('open')
    this.burgerMenuContent.nativeElement.classList.add('close');
    setTimeout(() => {
      this.burgerMenuContent.nativeElement.style.paddingTop = '0px';
    }, 800);
  }

  // Close burger menu on window resize
  @HostListener('window:resize', ['$event'])
  onResize(event: Event) {
    const width = (event.target as Window).innerWidth;
    this.closeBurgerMenu()
  }

  //Toggle mobile Dropdown menus
  toggleMobileDropdownMenu(menuItem: string) {

    if (menuItem === 'photography') {
      if (this.mobilePhotographyDropdown.nativeElement.style.display === 'flex') {
        this.burgerMenuMainContent.nativeElement.style.display = 'flex';
        this.mobilePhotographyDropdown.nativeElement.style.display = 'none';
        this.mobileBlogLink.nativeElement.style.display = 'flex';
        this.mobileCareerLink.nativeElement.style.display = 'flex';
        this.mobilePhotographyLink.nativeElement.style.fontWeight = 'normal';
        this.goBackToMainMobileMenu.nativeElement.style.display = 'none';
        return;
      }
      this.goBackToMainMobileMenu.nativeElement.style.display = 'flex';
      this.mobilePhotographyDropdown.nativeElement.style.display = 'flex';
      this.mobilePhotographyDropdown.nativeElement.style.flexDirection = 'column';
      this.mobilePhotographyLink.nativeElement.style.fontWeight = 'bold';
      this.mobileBlogLink.nativeElement.style.display = 'none';
      this.mobileCareerLink.nativeElement.style.display = 'none';
    } else if (menuItem === 'blog') {
      if (this.mobileBlogDropdown.nativeElement.style.display === 'flex') {
        this.mobileBlogDropdown.nativeElement.style.display = 'none';
        this.mobilePhotographyLink.nativeElement.style.display = 'flex';
        this.mobileCareerLink.nativeElement.style.display = 'flex';
        this.mobileBlogLink.nativeElement.style.fontWeight = 'normal';
        return;
      }
      this.goBackToMainMobileMenu.nativeElement.style.display = 'flex';
      this.mobileBlogDropdown.nativeElement.style.display = 'flex';
      this.mobileBlogDropdown.nativeElement.style.flexDirection = 'column';
      this.mobilePhotographyLink.nativeElement.style.display = 'none';
      this.mobileCareerLink.nativeElement.style.display = 'none';
      this.mobileBlogLink.nativeElement.style.fontWeight = 'bold';
    } else if (menuItem === 'career') {
      if (this.mobileCareerDropdown.nativeElement.style.display === 'flex') {
        this.mobileCareerDropdown.nativeElement.style.display = 'none';
        this.mobilePhotographyLink.nativeElement.style.display = 'flex';
        this.mobileBlogLink.nativeElement.style.display = 'flex';
        this.mobileCareerLink.nativeElement.style.fontWeight = 'normal';
        return;
      } this.goBackToMainMobileMenu.nativeElement.style.display = 'flex';
      this.mobileCareerDropdown.nativeElement.style.display = 'flex';
      this.mobileCareerDropdown.nativeElement.style.flexDirection = 'column';
      this.mobilePhotographyLink.nativeElement.style.display = 'none';
      this.mobileBlogLink.nativeElement.style.display = 'none';
      this.mobileCareerLink.nativeElement.style.fontWeight = 'bold';
    } return;
  }

  goBackToMainMobileMenuFunc() {
    this.mobileCareerDropdown.nativeElement.style.display = 'none';
    this.mobileBlogDropdown.nativeElement.style.display = 'none';
    this.mobilePhotographyDropdown.nativeElement.style.display = 'none';
    this.mobilePhotographyLink.nativeElement.style.display = 'flex';
    this.mobileBlogLink.nativeElement.style.display = 'flex';
    this.mobileCareerLink.nativeElement.style.display = 'flex';
    this.mobilePhotographyLink.nativeElement.style.fontWeight = 'normal';
    this.mobileBlogLink.nativeElement.style.fontWeight = 'normal';
    this.mobileCareerLink.nativeElement.style.fontWeight = 'normal';
    this.goBackToMainMobileMenu.nativeElement.style.display = 'none';
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
    this.adobeStockLogoMobileDropDownMenu.nativeElement.src = "/assets/img/logos/adobe-stock-logo-white.png";
    this.openInNewTabIconMobileDropdown.nativeElement.src = "/assets/img/icons/open-in-new-tab-icon-white.png";
    this.openInNewTabIcon.nativeElement.src = "/assets/img/icons/open-in-new-tab-icon-white.png";
    this.githubLogoDropDownMenu.nativeElement.src = "/assets/img/logos/GitHub-logo-white.png";
    this.githubLogoMobileDropDownMenu.nativeElement.src = "/assets/img/logos/GitHub-logo-white.png";
    this.linkedInLogoDropDownMenu.nativeElement.src = "/assets/img/logos/linkedIn-logo-white.png";
    this.linkedInLogoMobileDropDownMenu.nativeElement.src = "/assets/img/logos/linkedIn-logo-white.png";
  }

  turnOnLightMode() {
    this.moonIcon.nativeElement.style.display = 'flex';
    this.lightIcon.nativeElement.style.display = 'none';
    this.moonIconBurger.nativeElement.style.display = 'flex';
    this.lightIconBurger.nativeElement.style.display = 'none';
    this.adobeStockLogoDropDownMenu.nativeElement.src = "/assets/img/logos/adobe-stock-logo-black.png";
    this.adobeStockLogoMobileDropDownMenu.nativeElement.src = "/assets/img/logos/adobe-stock-logo-black.png";
    this.openInNewTabIconMobileDropdown.nativeElement.src = "/assets/img/icons/open-in-new-tab-icon-black.png";
    this.openInNewTabIcon.nativeElement.src = "/assets/img/icons/open-in-new-tab-icon-black.png";
    this.githubLogoDropDownMenu.nativeElement.src = "/assets/img/logos/GitHub-logo-black.png";
    this.githubLogoMobileDropDownMenu.nativeElement.src = "/assets/img/logos/GitHub-logo-black.png";
    this.linkedInLogoDropDownMenu.nativeElement.src = "/assets/img/logos/linkedIn-logo-black.png";
    this.linkedInLogoMobileDropDownMenu.nativeElement.src = "/assets/img/logos/linkedIn-logo-black.png";
  }
}
