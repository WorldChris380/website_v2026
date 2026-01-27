import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService } from './toast.service';

@Component({
    selector: 'app-toast-container',
    standalone: true,
    imports: [CommonModule],
    template: `
    <div class="toast-container">
      @for (toast of toastService.toasts(); track toast.id) {
        <div class="toast toast-{{ toast.type }}" 
             [class.toast-exit]="toast.duration === 0"
             (click)="toastService.remove(toast.id)">
          <span class="toast-icon">{{ getIcon(toast.type) }}</span>
          <span class="toast-message">{{ toast.message }}</span>
          <button class="toast-close" (click)="toastService.remove(toast.id)" aria-label="Close notification">
            ✕
          </button>
        </div>
      }
    </div>
  `,
    styles: [`
    .toast-container {
      position: fixed;
      top: 80px;
      right: 20px;
      z-index: 10000;
      display: flex;
      flex-direction: column;
      gap: 12px;
      pointer-events: none;
    }

    .toast {
      min-width: 300px;
      max-width: 500px;
      padding: 16px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      display: flex;
      align-items: center;
      gap: 12px;
      pointer-events: auto;
      animation: slideIn 0.3s ease-out;
      cursor: pointer;
      transition: transform 0.2s, opacity 0.2s;
    }

    .toast:hover {
      transform: translateX(-4px);
    }

    .toast-exit {
      animation: slideOut 0.3s ease-in forwards;
    }

    .toast-success {
      background: #d2ee82;
      color: #2d5016;
      border-left: 4px solid #5e784d;
    }

    .toast-error {
      background: #f28c8c;
      color: #8b0000;
      border-left: 4px solid #c73636;
    }

    .toast-info {
      background: #89BCD9;
      color: #0a3d5c;
      border-left: 4px solid #5a8ca8;
    }

    .toast-warning {
      background: #fbc093;
      color: #8b4513;
      border-left: 4px solid #d49056;
    }

    .toast-icon {
      font-size: 20px;
      flex-shrink: 0;
    }

    .toast-message {
      flex: 1;
      font-weight: 500;
      line-height: 1.4;
    }

    .toast-close {
      background: none;
      border: none;
      font-size: 18px;
      cursor: pointer;
      opacity: 0.7;
      transition: opacity 0.2s;
      padding: 0;
      width: 24px;
      height: 24px;
      flex-shrink: 0;
      color: inherit;
    }

    .toast-close:hover {
      opacity: 1;
    }

    @keyframes slideIn {
      from {
        transform: translateX(400px);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }

    @keyframes slideOut {
      from {
        transform: translateX(0);
        opacity: 1;
      }
      to {
        transform: translateX(400px);
        opacity: 0;
      }
    }

    @media (max-width: 768px) {
      .toast-container {
        top: 60px;
        right: 10px;
        left: 10px;
      }

      .toast {
        min-width: unset;
        max-width: unset;
      }
    }

    /* Dark mode support */
    :host-context(body.dark-mode) .toast-success {
      background: #5e784d;
      color: #d2ee82;
    }

    :host-context(body.dark-mode) .toast-error {
      background: #8b0000;
      color: #f28c8c;
    }

    :host-context(body.dark-mode) .toast-info {
      background: #0a3d5c;
      color: #89BCD9;
    }

    :host-context(body.dark-mode) .toast-warning {
      background: #8b4513;
      color: #fbc093;
    }
  `]
})
export class ToastContainerComponent {
    toastService = inject(ToastService);

    getIcon(type: string): string {
        switch (type) {
            case 'success': return '✓';
            case 'error': return '✕';
            case 'warning': return '⚠';
            case 'info': return 'ℹ';
            default: return '';
        }
    }
}
