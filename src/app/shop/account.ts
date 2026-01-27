import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MetaService } from '../services/meta.service';

@Component({
    selector: 'app-account',
    standalone: true,
    imports: [CommonModule, RouterModule],
    templateUrl: './account.html',
    styleUrl: './account.scss'
})
export class Account implements OnInit {
    constructor(private metaService: MetaService) { }

    ngOnInit() {
        this.metaService.updateSEO({
            title: 'My Account | Christian Böhme Shop',
            description: 'Manage your photo shop purchases, downloads, and billing information. Access your order history and print-ready files.',
            url: 'https://www.christian-boehme.com/shop/account',
            type: 'website'
        });
    }
}
