import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MyVisitedCountries } from './my-visited-countries';

describe('MyVisitedCountries', () => {
    let component: MyVisitedCountries;
    let fixture: ComponentFixture<MyVisitedCountries>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [MyVisitedCountries]
        })
            .compileComponents();

        fixture = TestBed.createComponent(MyVisitedCountries);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should have correct total countries count', () => {
        expect(component.totalCountries).toBe(42);
    });

    it('should have correct total continents count', () => {
        expect(component.totalContinents).toBe(5);
    });
});
