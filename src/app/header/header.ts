import { Component, ElementRef, HostListener, ViewChild, OnInit } from '@angular/core';
type MenuHeading = 'photography' | 'blog' | 'travel' | 'career';

@Component({
  selector: 'app-header',
  standalone: true,
  templateUrl: './header.html',
  styleUrl: './header.scss',
})

export class Header {
  darkmode: boolean = false;
  burgerMenuOpen: boolean = false;
  burgerMenuClosing: boolean = false;
  openDesktop: MenuHeading | null = null;
  openMobile: MenuHeading | null = null;

  // ViewChild references
  @ViewChild('burgerMenuContent', { static: true }) burgerMenuContent!: ElementRef<HTMLDivElement>;
  @ViewChild('photographyDropdownList', { static: true }) photographyDropdownList!: ElementRef<HTMLDivElement>;
  @ViewChild('careerDropdownList', { static: true }) careerDropdownList!: ElementRef<HTMLDivElement>;
  @ViewChild('blogDropdownList', { static: true }) blogDropdownList!: ElementRef<HTMLDivElement>;
  @ViewChild('mobilePhotographyDropdown', { static: true }) mobilePhotographyDropdown!: ElementRef<HTMLDivElement>;
  @ViewChild('mobileBlogDropdown', { static: true }) mobileBlogDropdown!: ElementRef<HTMLDivElement>;
  @ViewChild('mobileCareerDropdown', { static: true }) mobileCareerDropdown!: ElementRef<HTMLDivElement>;
  @ViewChild('mobilePhotographyLink', { static: true }) mobilePhotographyLink!: ElementRef<HTMLAnchorElement>;
  @ViewChild('mobileBlogLink', { static: true }) mobileBlogLink!: ElementRef<HTMLAnchorElement>;
  @ViewChild('mobileCareerLink', { static: true }) mobileCareerLink!: ElementRef<HTMLAnchorElement>;
  @ViewChild('burgerMenuMainContent', { static: false }) burgerMenuMainContent!: ElementRef<HTMLDivElement>;
  @ViewChild('goBackToMainMobileMenu', { static: false }) goBackToMainMobileMenu!: ElementRef<HTMLAnchorElement>;

  ngOnInit() {
    let darkmodeLocalStorage = localStorage.getItem('darkmode');
    if (darkmodeLocalStorage === 'true') {
      this.darkmode = true;
    } else {
      this.darkmode = false;
    }
    document.body.classList.toggle('dark-mode', this.darkmode);
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
    if (!this.burgerMenuOpen) {
      this.burgerMenuOpen = true;
      return;
    }
    this.burgerMenuClosing = true;
    setTimeout(() => {
      this.burgerMenuOpen = false;
      this.burgerMenuClosing = false;
    }, 800);
  }

  // Close burger menu on window resize
  @HostListener('window:resize', ['$event'])
  onResize(event: Event) {
    const width = (event.target as Window).innerWidth;
    this.burgerMenuOpen = false;
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

  // Dark mode implementation and logo and icons change
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
