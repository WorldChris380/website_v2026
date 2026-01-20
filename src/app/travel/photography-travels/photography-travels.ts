import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component({
    selector: 'app-photography-travels',
    standalone: true,
    imports: [RouterModule],
    templateUrl: './photography-travels.html',
    styleUrl: './photography-travels.scss'
})
export class PhotographyTravels {
    protected readonly title = 'Photography Travels';
}
