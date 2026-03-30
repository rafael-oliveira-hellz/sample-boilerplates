import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CodeEditorComponent } from './code-editor.component';
import { SimpleChange } from '@angular/core';

describe('CodeEditorComponent', () => {
  let component: CodeEditorComponent;
  let fixture: ComponentFixture<CodeEditorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CodeEditorComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(CodeEditorComponent);
    component = fixture.componentInstance;
    component.fileName = 'eval-expression.ts';
    component.value = 'return 1;';
    component.placeholder = 'codigo';
    fixture.detectChanges();
  });

  it('renders fallback editor in test environment', () => {
    component.useFallback = true;
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('eval-expression.ts');
    expect(element.querySelector('.code-textarea')).toBeTruthy();
  });

  it('emits value changes from fallback editor', () => {
    component.useFallback = true;
    fixture.detectChanges();
    spyOn(component.valueChange, 'emit');

    const textarea = fixture.nativeElement.querySelector('.code-textarea') as HTMLTextAreaElement;
    textarea.value = 'return 2;';
    textarea.dispatchEvent(new Event('input'));

    expect(component.valueChange.emit).toHaveBeenCalledWith('return 2;');
    expect(component.lineNumbers).toEqual([1]);
  });

  it('expande a numeracao de linhas com conteudo multiline', () => {
    component.value = 'linha 1\nlinha 2\nlinha 3';

    expect(component.lineNumbers).toEqual([1, 2, 3]);
  });

  it('mantem fallback quando executa fora de browser com karma', () => {
    component.ngOnInit();

    expect(component.useFallback).toBeTrue();
  });

  it('sincroniza valor no editor quando recebe ngOnChanges', () => {
    component.useFallback = false;
    const setValue = jasmine.createSpy('setValue');
    (component as unknown as { editor: { getValue: () => string; setValue: (value: string) => void; dispose: () => void } }).editor = {
      getValue: () => 'valor antigo',
      setValue,
      dispose: () => undefined
    };
    component.value = 'valor novo';

    component.ngOnChanges({
      value: new SimpleChange('valor antigo', 'valor novo', false)
    });

    expect(setValue).toHaveBeenCalledWith('valor novo');
  });

  it('nao sobrescreve valor do editor quando ja esta sincronizado', () => {
    component.useFallback = false;
    const setValue = jasmine.createSpy('setValue');
    (component as unknown as { editor: { getValue: () => string; setValue: (value: string) => void; dispose: () => void } }).editor = {
      getValue: () => 'return 1;',
      setValue,
      dispose: () => undefined
    };

    component.ngOnChanges({
      value: new SimpleChange('return 1;', 'return 1;', false)
    });

    expect(setValue).not.toHaveBeenCalled();
  });

  it('processa mudanca de linguagem sem quebrar o fluxo do componente', async () => {
    component.useFallback = false;
    (component as unknown as { editorModel: { dispose: () => void } }).editorModel = {
      dispose: () => undefined
    };

    component.ngOnChanges({
      language: new SimpleChange('javascript', 'java', false)
    });

    await Promise.resolve();
    await Promise.resolve();

    expect(component.useFallback).toBeFalse();
  });

  it('usa fallback quando o carregamento do Monaco falha no afterViewInit', async () => {
    component.useFallback = false;
    spyOn(window.console, 'warn');

    await component.ngAfterViewInit();

    expect(component.useFallback).toBeTrue();
  });

  it('descarta editor e model no destroy', () => {
    const editorDispose = jasmine.createSpy('editorDispose');
    const modelDispose = jasmine.createSpy('modelDispose');
    (component as unknown as { editor: { dispose: () => void }; editorModel: { dispose: () => void } }).editor = {
      dispose: editorDispose
    };
    (component as unknown as { editorModel: { dispose: () => void } }).editorModel = {
      dispose: modelDispose
    };

    component.ngOnDestroy();

    expect(editorDispose).toHaveBeenCalled();
    expect(modelDispose).toHaveBeenCalled();
  });
});
