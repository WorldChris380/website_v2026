import { Component, ViewChild, ElementRef, HostListener } from '@angular/core';
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
    if (typeof window !== 'undefined' && window.localStorage) {
      const theme = localStorage.getItem('data-theme');
      if (theme === 'dark') {
        this.moonIcon.nativeElement.style.display = 'none';
        this.lightIcon.nativeElement.style.display = 'flex';
        document.body.classList.add('dark-mode');
      } else {
        this.moonIcon.nativeElement.style.display = 'flex';
        this.lightIcon.nativeElement.style.display = 'none';
        document.body.classList.remove('dark-mode');
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
      this.moonIcon.nativeElement.style.display = 'none';
      this.lightIcon.nativeElement.style.display = 'flex';
      this.moonIconBurger.nativeElement.style.display = 'none';
      this.lightIconBurger.nativeElement.style.display = 'flex';
      document.body.classList.add('dark-mode');
      localStorage.setItem("data-theme", "dark");
    } else {
      this.moonIcon.nativeElement.style.display = 'flex';
      this.lightIcon.nativeElement.style.display = 'none';
      this.moonIconBurger.nativeElement.style.display = 'flex';
      this.lightIconBurger.nativeElement.style.display = 'none';
      document.body.classList.remove('dark-mode');
      localStorage.setItem("data-theme", "light");
    }
  }
}