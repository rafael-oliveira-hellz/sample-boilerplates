import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PreviewTabsComponent } from './preview-tabs.component';

describe('PreviewTabsComponent', () => {
  let component: PreviewTabsComponent;
  let fixture: ComponentFixture<PreviewTabsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PreviewTabsComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(PreviewTabsComponent);
    component = fixture.componentInstance;
    component.generatedSchema = '{"type":"object"}';
    component.previewJson = '{"data":{}}';
    component.persistedDocument = '{"schema_origem":{"type":"object"},"schema_destino":{"type":"object"}}';
    component.validationErrors = ['erro 1'];
    fixture.detectChanges();
  });

  it('shows each tab content', () => {
    const element = fixture.nativeElement as HTMLElement;

    expect(element.textContent).toContain('root');
    expect(element.textContent).toContain('{1}');
    expect(element.textContent).toContain('schema_origem');

    component.activeTab = 'errors';
    fixture.detectChanges();
    expect(element.textContent).toContain('erro 1');
  });

  it('collapses and expands object nodes in the json viewer', () => {
    const element = fixture.nativeElement as HTMLElement;
    const toggle = element.querySelector('.json-toggle') as HTMLButtonElement;

    toggle.click();
    fixture.detectChanges();

    expect(element.textContent).toContain('{2 chave(s)}');

    toggle.click();
    fixture.detectChanges();

    expect(element.textContent).toContain('type');
  });
});
