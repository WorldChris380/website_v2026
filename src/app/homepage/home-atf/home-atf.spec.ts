import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HomeAtf } from './home-atf';

describe('HomeAtf', () => {
  let component: HomeAtf;
  let fixture: ComponentFixture<HomeAtf>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HomeAtf]
    })
    .compileComponents();

    fixture = TestBed.createComponent(HomeAtf);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
