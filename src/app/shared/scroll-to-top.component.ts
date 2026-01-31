import { Component, HostListener, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-scroll-to-top',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (isVisible()) {
      <button 
        class="scroll-to-top" 
        (click)="scrollToTop()"
        aria-label="Scroll to top"
        title="Back to top">
        ↑
      </button>
    }
  `,
  styles: [`
    .scroll-to-top {
      position: fixed;
      bottom: 40px;
      right: 40px;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: #89BCD9;
      color: white;
      border: none;
      font-size: 28px;
      font-weight: bold;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
      z-index: 1000;
      transition: background-color 0.3s ease,
        transform 0.3s ease,
        box-shadow 0.3s ease;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .scroll-to-top:hover {
      background: #5a8ca8;
      transform: translateY(-4px);
      box-shadow: 0 6px 16px rgba(0, 0, 0, 0.3);
    }

    .scroll-to-top:active {
      transform: translateY(-2px);
    }

    @media (max-width: 768px) {
      .scroll-to-top {
        bottom: 20px;
        right: 20px;
        width: 48px;
        height: 48px;
        font-size: 24px;
      }
    }

    /* Dark mode */
    :host-context(body.dark-mode) .scroll-to-top {
      background: #d2ee82;
      color: #2d5016;
    }

    :host-context(body.dark-mode) .scroll-to-top:hover {
      background: #5e784d;
      color: #d2ee82;
    }
  `]
})
export class ScrollToTopComponent {
  isVisible = signal(false);

  @HostListener('window:scroll')
  onWindowScroll(): void {
    // Show button when scrolled down 300px
    this.isVisible.set(window.pageYOffset > 300);
  }

  scrollToTop(): void {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  }
}
