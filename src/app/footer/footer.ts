import { Component, OnInit, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';

import { RouterModule } from '@angular/router';
import { DarkModeService } from '../dark-mode.service';
import { LanguageService, Language } from '../language.service';

@Component({
  selector: 'app-footer',
  imports: [RouterModule],
  templateUrl: './footer.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './footer.scss',
})
export class Footer implements OnInit {
  darkmode: boolean = false;
  currentLanguage: Language = 'en';

  constructor(
    private darkModeService: DarkModeService,
    private languageService: LanguageService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.darkmode = this.darkModeService.isDarkMode();
    this.darkModeService.darkmode$.subscribe((isDark) => {
      this.darkmode = isDark;
      this.cdr.markForCheck();
    });

    this.currentLanguage = this.languageService.getCurrentLanguage();
    this.languageService.language$.subscribe((lang) => {
      this.currentLanguage = lang;
      this.cdr.markForCheck();
    });
  }

  getTranslation(key: string): string {
    return this.languageService.getTranslation(key);
  }

  toggleDarkMode() {
    this.darkModeService.toggleDarkMode();
  }

  darkmodePNG(name: string) {
    return this.darkModeService.darkmodePNG(name);
  }
}
