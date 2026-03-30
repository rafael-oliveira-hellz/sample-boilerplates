import { ComponentFixture, TestBed } from '@angular/core/testing';
import { JsonTreeViewerComponent } from './json-tree-viewer.component';

describe('JsonTreeViewerComponent', () => {
  let component: JsonTreeViewerComponent;
  let fixture: ComponentFixture<JsonTreeViewerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [JsonTreeViewerComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(JsonTreeViewerComponent);
    component = fixture.componentInstance;
    component.content = JSON.stringify({
      contrato: {
        numero: '123',
        ativo: true
      },
      itens: [1, 2]
    });
    fixture.detectChanges();
  });

  it('monta arvore json e rastreia nodos pelo path', () => {
    const tree = component.tree();

    expect(tree?.type).toBe('object');
    expect(component.trackNode(0, tree!)).toBe('$');
  });

  it('alterna o estado de collapse de um nodo', () => {
    component.toggleNode('$.contrato');
    expect(component.isCollapsed('$.contrato')).toBeTrue();

    component.toggleNode('$.contrato');
    expect(component.isCollapsed('$.contrato')).toBeFalse();
  });

  it('collapseAll e expandAll respeitam ausencia de arvore', () => {
    component.content = '';

    expect(() => component.collapseAll()).not.toThrow();
    expect(() => component.expandAll()).not.toThrow();
  });

  it('collapseAll recolhe todos os nodos com filhos e expandAll reabre', () => {
    component.collapseAll();

    expect(component.isCollapsed('$')).toBeTrue();
    expect(component.isCollapsed('$.contrato')).toBeTrue();
    expect(component.isCollapsed('$.itens')).toBeTrue();

    component.expandAll();

    expect(component.isCollapsed('$')).toBeFalse();
    expect(component.isCollapsed('$.contrato')).toBeFalse();
    expect(component.isCollapsed('$.itens')).toBeFalse();
  });

  it('copia o conteudo quando clipboard esta disponivel', async () => {
    const writeText = jasmine.createSpy().and.resolveTo();
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true
    });

    component.copyContent();
    await Promise.resolve();

    expect(writeText).toHaveBeenCalledWith(component.content);
  });

  it('ignora copia quando nao ha conteudo ou clipboard', () => {
    component.content = '';
    Object.defineProperty(navigator, 'clipboard', {
      value: undefined,
      configurable: true
    });

    expect(() => component.copyContent()).not.toThrow();
  });

  it('exporta o conteudo quando permitido', () => {
    component.allowExport = true;
    const createObjectUrlSpy = spyOn(URL, 'createObjectURL').and.returnValue('blob:test');
    const revokeSpy = spyOn(URL, 'revokeObjectURL');
    const clickSpy = spyOn(HTMLAnchorElement.prototype, 'click');

    component.exportContent();

    expect(createObjectUrlSpy).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    expect(revokeSpy).toHaveBeenCalledWith('blob:test');
  });

  it('nao exporta quando exportacao nao e permitida', () => {
    component.allowExport = false;
    const createObjectUrlSpy = spyOn(URL, 'createObjectURL');

    component.exportContent();

    expect(createObjectUrlSpy).not.toHaveBeenCalled();
  });

  it('retorna labels de tipo coerentes para object, array e valores simples', () => {
    const tree = component.tree()!;
    const objectNode = tree.children![0];
    const arrayNode = tree.children![1];
    const leafNode = objectNode.children![0];

    expect(component.valueTypeLabel(objectNode)).toBe('{2}');
    expect(component.valueTypeLabel(arrayNode)).toBe('[2]');
    expect(component.valueTypeLabel(leafNode)).toBe('string');
  });

  it('renderiza empty state e fallback bruto para json invalido', () => {
    component.content = '';
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Nenhum JSON disponivel.');

    component.content = '{ invalido';
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('pre')?.textContent).toContain('{ invalido');
  });

  it('exibe selo para eval declarativo e script detectado no preview', () => {
    component.content = JSON.stringify({
      marcaDescricao: {
        type: 'string',
        eval: {
          alias: "dadosApolice.codigoMarca == 1001 ? 'Porto' : null"
        }
      },
      totalCalculado: {
        type: 'string',
        eval: {
          alias: 'resultado = "Porto" if dadosApolice.codigoMarca == 1001 else "Nao identificado"\nreturn resultado',
          eval_type: 'script'
        }
      }
    });
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Expressão declarativa');
    expect(element.textContent).toContain('Script detectado');
  });
});
