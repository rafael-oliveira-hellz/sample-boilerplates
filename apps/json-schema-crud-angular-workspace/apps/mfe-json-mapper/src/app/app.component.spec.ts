import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { MapperFacadeService } from './core';
import { AppComponent } from './app.component';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [provideHttpClient()]
    }).compileComponents();
  });

  it('creates the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('injects the mapper facade', () => {
    const fixture = TestBed.createComponent(AppComponent);
    expect(fixture.componentInstance.facade).toBe(TestBed.inject(MapperFacadeService));
  });
});
