import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SchemaTechnicalImportedFile, SchemaTechnicalPanelComponent } from './schema-technical-panel.component';

describe('SchemaTechnicalPanelComponent', () => {
  let component: SchemaTechnicalPanelComponent;
  let fixture: ComponentFixture<SchemaTechnicalPanelComponent>;

  const importedFile: SchemaTechnicalImportedFile = {
    name: 'origem.json',
    mimeType: 'application/json',
    extension: 'json',
    sizeLabel: '1.0 KB'
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SchemaTechnicalPanelComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(SchemaTechnicalPanelComponent);
    component = fixture.componentInstance;
    component.importTitle = 'Importar';
    component.importCopy = 'Copie ou carregue.';
    component.importAction = 'Selecionar arquivo JSON';
    component.templateAction = 'Baixar template';
    component.templateHref = '/examples/schema.json';
    component.templateDownloadName = 'schema.json';
    component.editorTitle = 'Editor';
    component.editorCopy = 'Edite o JSON.';
    component.editorAction = 'Aplicar';
    component.editorFootnote = 'Use com cuidado.';
    component.noFile = 'Nenhum arquivo';
    component.clearFile = 'Limpar';
    component.viewerEmpty = 'Sem JSON';
    component.rawJsonText = '{"type":"object"}';
    component.fileName = 'schema.json';
    fixture.detectChanges();
  });

  it('abre o file picker quando solicitado', () => {
    const clickSpy = spyOn(HTMLInputElement.prototype, 'click');

    component.openFilePicker();

    expect(clickSpy).toHaveBeenCalled();
  });

  it('nao tenta baixar template quando href nao existe', async () => {
    component.templateHref = '';
    const fetchSpy = spyOn(window, 'fetch' as never);

    await component.downloadTemplate();

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('baixa template via fetch e blob quando a resposta e valida', async () => {
    const blob = new Blob(['{}'], { type: 'application/json' });
    spyOn(window, 'fetch').and.resolveTo(new Response(blob, { status: 200 }));
    const createObjectUrlSpy = spyOn(URL, 'createObjectURL').and.returnValue('blob:test');
    const revokeSpy = spyOn(URL, 'revokeObjectURL');
    const appendSpy = spyOn(document.body, 'appendChild').and.callThrough();
    const removeSpy = spyOn(HTMLAnchorElement.prototype, 'remove').and.callThrough();
    const clickSpy = spyOn(HTMLAnchorElement.prototype, 'click');

    await component.downloadTemplate();

    expect(createObjectUrlSpy).toHaveBeenCalled();
    expect(appendSpy).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    expect(removeSpy).toHaveBeenCalled();
    expect(revokeSpy).toHaveBeenCalledWith('blob:test');
  });

  it('faz fallback para window.open quando o download do template falha', async () => {
    spyOn(window, 'fetch').and.rejectWith(new Error('falhou'));
    const openSpy = spyOn(window, 'open');

    await component.downloadTemplate();

    expect(openSpy).toHaveBeenCalledWith('/examples/schema.json', '_blank', 'noopener,noreferrer');
  });

  it('emite arquivo importado e troca para viewer ao selecionar json', async () => {
    const emitSpy = spyOn(component.fileImported, 'emit');
    const modeSpy = spyOn(component.panelModeChange, 'emit');
    const file = new File(['{"type":"object"}'], 'payload_entrada.json', { type: 'application/json' });
    const input = document.createElement('input');
    Object.defineProperty(input, 'files', {
      value: [file]
    });
    input.value = 'fake-value';

    await component.onFileSelected({ target: input } as unknown as Event);

    expect(emitSpy).toHaveBeenCalledWith({
      content: '{"type":"object"}',
      summary: {
        name: 'payload_entrada.json',
        mimeType: 'application/json',
        extension: 'json',
        sizeLabel: '17 B'
      }
    });
    expect(modeSpy).toHaveBeenCalledWith('viewer');
    expect(input.value).toBe('');
  });

  it('ignora selecao quando nenhum arquivo foi informado', async () => {
    const emitSpy = spyOn(component.fileImported, 'emit');
    const input = document.createElement('input');
    Object.defineProperty(input, 'files', {
      value: []
    });

    await component.onFileSelected({ target: input } as unknown as Event);

    expect(emitSpy).not.toHaveBeenCalled();
  });

  it('permite alternar o modo do painel', () => {
    const emitSpy = spyOn(component.panelModeChange, 'emit');

    component.setPanelMode('editor');

    expect(emitSpy).toHaveBeenCalledWith('editor');
  });

  it('renderiza metadados do arquivo importado e botao de limpar', () => {
    component.importedFile = importedFile;
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('origem.json');
    expect(element.textContent).toContain('application/json');
    expect(element.textContent).toContain('.json');
    expect(element.textContent).toContain('Limpar');
  });

  it('renderiza o code editor quando o modo esta em editor e emite apply', () => {
    component.panelMode = 'editor';
    fixture.detectChanges();
    const applySpy = spyOn(component.applyText, 'emit');

    const button = Array.from(fixture.nativeElement.querySelectorAll('button'))
      .find((candidate) => (candidate as HTMLButtonElement).textContent?.includes('Aplicar')) as HTMLButtonElement;
    button.click();

    expect(fixture.nativeElement.querySelector('app-code-editor')).toBeTruthy();
    expect(applySpy).toHaveBeenCalled();
  });

  it('renderiza erro quando informado', () => {
    component.error = 'JSON invalido';
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('JSON invalido');
  });
});
