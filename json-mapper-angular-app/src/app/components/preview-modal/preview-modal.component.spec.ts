import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PreviewModalComponent } from './preview-modal.component';

describe('PreviewModalComponent', () => {
  let fixture: ComponentFixture<PreviewModalComponent>;
  let component: PreviewModalComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PreviewModalComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(PreviewModalComponent);
    component = fixture.componentInstance;
    component.title = 'Painel de conferência';
    component.copy = 'Confira o resultado final, revise alertas e exporte o JSON em um painel limpo e focado.';
    component.closeLabel = 'Fechar preview';
    component.generatedSchema = '{}';
    component.previewJson = '{}';
    component.persistedDocument = '{}';
    fixture.detectChanges();
  });

  it('should render an icon close button with accessible labels', () => {
    const button = fixture.nativeElement.querySelector('[data-testid="preview-modal-close"]') as HTMLButtonElement;

    expect(button).toBeTruthy();
    expect(button.textContent?.trim()).toBe('×');
    expect(button.getAttribute('aria-label')).toBe('Fechar preview');
    expect(button.getAttribute('title')).toBe('Fechar preview');
  });

  it('should emit close when backdrop or close button is clicked', () => {
    spyOn(component.close, 'emit');

    (fixture.nativeElement.querySelector('[data-testid="preview-modal-close"]') as HTMLButtonElement).click();
    expect(component.close.emit).toHaveBeenCalledTimes(1);

    (fixture.nativeElement.querySelector('[data-testid="preview-modal-backdrop"]') as HTMLDivElement).click();
    expect(component.close.emit).toHaveBeenCalledTimes(2);
  });
});
