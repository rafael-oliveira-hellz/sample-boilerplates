import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MappingWorkbenchComponent } from './mapping-workbench.component';

describe('MappingWorkbenchComponent', () => {
  let component: MappingWorkbenchComponent;
  let fixture: ComponentFixture<MappingWorkbenchComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MappingWorkbenchComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(MappingWorkbenchComponent);
    component = fixture.componentInstance;
    component.bindingModes = [
      { id: 'alias', label: 'Alias' },
      { id: 'concat', label: 'Concat' },
      { id: 'defaultLiteral', label: 'Default fixo' }
    ];
    component.reviewCounts = { empty: 2, rule: 1, error: 3 };
    component.ruleCount = 1;
    component.sourceOptions = [
      {
        id: 'src-1',
        scope: 'source',
        key: 'numeroApolice',
        label: 'numeroApolice',
        path: '$.dadosApolice.numeroApolice',
        aliasPath: 'dadosApolice.numeroApolice',
        displayPath: 'dadosApolice.numeroApolice',
        kind: 'field',
        type: 'integer',
        parentId: 'root',
        children: [],
        expanded: true,
        manual: false,
        itemModel: false
      },
      {
        id: 'src-2',
        scope: 'source',
        key: 'codigoSucursal',
        label: 'codigoSucursal',
        path: '$.dadosApolice.codigoSucursal',
        aliasPath: 'dadosApolice.codigoSucursal',
        displayPath: 'dadosApolice.codigoSucursal',
        kind: 'field',
        type: 'integer',
        parentId: 'root',
        children: [],
        expanded: true,
        manual: false,
        itemModel: false
      }
    ];
    component.mappedTargets = [
      {
        id: 'map-1',
        targetNodeId: 'target-1',
        targetPath: 'data.proposta.id',
        targetLabel: 'id',
        targetType: 'string',
        mode: 'alias',
        sourcePaths: ['$.dadosApolice.numeroApolice'],
        summary: '$.dadosApolice.numeroApolice'
      }
    ];
    component.selectedTargetNode = {
      id: 'target-1',
      scope: 'target',
      key: 'id',
      label: 'id',
      path: '$.data.proposta.id',
      aliasPath: 'data.proposta.id',
      displayPath: 'data.proposta.id',
      kind: 'field',
      type: 'string',
      parentId: 'root',
      children: [],
      expanded: true,
      manual: false,
      itemModel: false,
      binding: {
        mode: 'alias',
        sourcePaths: ['$.dadosApolice.numeroApolice'],
        separator: '',
        formatters: [],
        defaultValue: '',
        defaultSourcePath: '',
        advancedExpression: ''
      }
    };
    fixture.detectChanges();
  });

  it('renders selected mapping details', () => {
    const element = fixture.nativeElement as HTMLElement;

    expect(element.textContent).toContain('data.proposta.id');
    expect(element.textContent).toContain('dadosApolice.numeroApolice');
    expect(element.textContent).toContain('gera eval/script 1');
    expect(component.trackMapping(0, component.mappedTargets[0])).toBe('map-1');
    expect(component.toNumber('7')).toBe(7);
    expect(component.selectedSourceLabels()).toEqual(['dadosApolice.numeroApolice']);
  });

  it('retorna hints coerentes por modo e conta mapeamentos por tipo', () => {
    expect(component.suggestionHint()).toContain('preencher rapidamente');
    expect(component.mappingsByMode('alias')).toBe(1);
    expect(component.mappingsByMode('concat')).toBe(0);

    component.selectedTargetNode = {
      ...component.selectedTargetNode!,
      binding: {
        mode: 'concat',
        sourcePaths: [],
        separator: '',
        formatters: [],
        defaultValue: '',
        defaultSourcePath: '',
        advancedExpression: ''
      }
    };
    expect(component.suggestionHint()).toContain('concat atual');

    component.selectedTargetNode = {
      ...component.selectedTargetNode!,
      binding: {
        mode: 'defaultSource',
        sourcePaths: [],
        separator: '',
        formatters: [],
        defaultValue: '',
        defaultSourcePath: '$.dadosApolice.numeroApolice',
        advancedExpression: ''
      }
    };
    expect(component.suggestionHint()).toContain('default');
  });

  it('shows visual rule guidance without exposing a regra binding mode', () => {
    component.selectedTargetHasVisualRule = true;
    component.selectedTargetRuleCount = 2;
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('regra(s) visual(is)');
    expect(element.textContent).toContain('eval');
    expect(element.querySelector('[data-testid="binding-mode-rule"]')).toBeFalsy();
  });

  it('emits actions from the template', () => {
    spyOn(component.selectTarget, 'emit');
    spyOn(component.setBindingMode, 'emit');
    spyOn(component.clearBinding, 'emit');
    spyOn(component.applySuggestedMapping, 'emit');
    spyOn(component.applySuggestedMappingsBatch, 'emit');

    component.assistantsExpanded = true;
    fixture.detectChanges();

    const quickActionButtons = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('.quick-actions button')
    ) as HTMLButtonElement[];
    quickActionButtons[0]?.click();
    quickActionButtons[1]?.click();
    (fixture.nativeElement as HTMLElement).querySelector('.mapping-item')?.dispatchEvent(new Event('click'));
    fixture.detectChanges();
    (fixture.nativeElement as HTMLElement).querySelector('[data-testid="binding-mode-alias"]')?.dispatchEvent(new Event('click'));
    fixture.detectChanges();
    (fixture.nativeElement as HTMLElement).querySelector('.full')?.dispatchEvent(new Event('click'));

    expect(component.applySuggestedMapping.emit).toHaveBeenCalled();
    expect(component.applySuggestedMappingsBatch.emit).toHaveBeenCalled();
    expect(component.selectTarget.emit).toHaveBeenCalledWith('target-1');
    expect(component.setBindingMode.emit).toHaveBeenCalledWith('alias');
    expect(component.clearBinding.emit).toHaveBeenCalled();
  });

  it('renders review cards as informative summaries without navigation buttons', () => {
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Resumo rápido do estado atual.');
    expect(element.textContent).not.toContain('Anterior');
    expect(element.textContent).not.toContain('Próximo');
  });

  it('emits smart suggestion, concat replacement and reorder actions', () => {
    component.assistantsExpanded = true;
    component.selectedTargetNode = {
      ...component.selectedTargetNode!,
      key: 'numeroApolice',
      label: 'numeroApolice',
      displayPath: 'data.proposta.numeroApolice',
      binding: {
        mode: 'concat',
        sourcePaths: ['$.dadosApolice.numeroApolice', '$.dadosApolice.codigoSucursal'],
        separator: '-',
        formatters: [
          { id: 'fmt-1', pad: 'left', length: 5, char: '0' },
          { id: 'fmt-2', pad: 'left', length: 3, char: '0' }
        ],
        defaultValue: '',
        defaultSourcePath: '',
        advancedExpression: ''
      }
    };
    fixture.detectChanges();

    spyOn(component.addConcatSource, 'emit');
    spyOn(component.replaceConcatSource, 'emit');
    spyOn(component.reorderConcatSource, 'emit');

    expect(component.suggestedSources()[0]?.displayPath).toBe('dadosApolice.numeroApolice');

    const suggestionButton = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('.suggestion-btn')
    )[0] as HTMLButtonElement;
    suggestionButton.click();

    const segmentSelect = (fixture.nativeElement as HTMLElement).querySelector('.segment-row select') as HTMLSelectElement;
    segmentSelect.value = '$.dadosApolice.codigoSucursal';
    segmentSelect.dispatchEvent(new Event('change'));

    component.startConcatDrag(0);
    component.dropConcatAt(1);

    expect(component.addConcatSource.emit).toHaveBeenCalledWith('$.dadosApolice.numeroApolice');
    expect(component.replaceConcatSource.emit).toHaveBeenCalledWith({
      index: 0,
      path: '$.dadosApolice.codigoSucursal'
    });
    expect(component.reorderConcatSource.emit).toHaveBeenCalledWith({ fromIndex: 0, toIndex: 1 });
  });

  it('shows clearer visual feedback while reordering concat segments', () => {
    component.selectedTargetNode = {
      ...component.selectedTargetNode!,
      binding: {
        mode: 'concat',
        sourcePaths: ['$.dadosApolice.numeroApolice', '$.dadosApolice.codigoSucursal'],
        separator: '',
        formatters: [],
        defaultValue: '',
        defaultSourcePath: '',
        advancedExpression: ''
      }
    };
    fixture.detectChanges();

    component.startConcatDrag(0);
    component.previewConcatDrop(1);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('.segment-card.drag-source')).toBeTruthy();
    expect(element.querySelector('.segment-card.drop-preview')).toBeTruthy();
    expect(element.querySelector('.segment-slot.active')).toBeTruthy();
    expect(element.textContent).toContain('Solte para mover a Entrada 1 para a posicao 2');
  });

  it('trata drag de concat sem estado ativo e limpa preview corretamente', () => {
    expect(component.isConcatDropPreview(0)).toBeFalse();
    expect(component.concatDropPreviewLabel()).toBe('');

    component.previewConcatDrop(2);
    expect(component.hoveredConcatDropIndex).toBeNull();

    component.clearConcatDropPreview();
    expect(component.hoveredConcatDropIndex).toBeNull();

    component.startConcatDrag(1);
    expect(component.concatDropPreviewLabel()).toBe('Movendo Entrada 2');

    component.clearConcatDropPreview(0);
    expect(component.hoveredConcatDropIndex).toBe(1);

    component.clearConcatDrag();
    expect(component.draggingConcatIndex).toBeNull();
    expect(component.hoveredConcatDropIndex).toBeNull();
  });

  it('shows optional concat formatting only when configured', () => {
    component.selectedTargetNode = {
      ...component.selectedTargetNode!,
      binding: {
        mode: 'concat',
        sourcePaths: ['$.dadosApolice.numeroApolice'],
        separator: '',
        formatters: [],
        defaultValue: '',
        defaultSourcePath: '',
        advancedExpression: ''
      }
    };
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Configurar formatacao');
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('Sem formatacao');
  });

  it('emits concat segment hover events from the inspector', () => {
    spyOn(component.hoverConcatSegment, 'emit');
    component.selectedTargetNode = {
      ...component.selectedTargetNode!,
      binding: {
        mode: 'concat',
        sourcePaths: ['$.dadosApolice.numeroApolice', '$.dadosApolice.codigoSucursal'],
        separator: '',
        formatters: [],
        defaultValue: '',
        defaultSourcePath: '',
        advancedExpression: ''
      }
    };
    fixture.detectChanges();

    const segment = (fixture.nativeElement as HTMLElement).querySelector('.segment-card') as HTMLElement;
    segment.dispatchEvent(new Event('mouseenter'));
    segment.dispatchEvent(new Event('mouseleave'));

    expect(component.hoverConcatSegment.emit).toHaveBeenCalledWith(0);
    expect(component.hoverConcatSegment.emit).toHaveBeenCalledWith(null);
  });

  it('allows manual source mapping without depending on suggestions', () => {
    spyOn(component.setAliasSource, 'emit');
    component.assistantsExpanded = true;
    component.manualSourceQuery = 'codigo';
    fixture.detectChanges();

    expect(component.filteredManualSources().map((item) => item.displayPath)).toContain('dadosApolice.codigoSucursal');

    component.draftManualSourcePath = 'dadosApolice.codigoSucursal';
    component.applyManualSource('alias');

    expect(component.setAliasSource.emit).toHaveBeenCalledWith('$.dadosApolice.codigoSucursal');
  });

  it('normaliza caminhos manuais para concat, default source e fallback', () => {
    spyOn(component.addConcatSource, 'emit');
    spyOn(component.setDefaultSource, 'emit');
    spyOn(component.addAliasFallback, 'emit');

    component.draftManualSourcePath = '$.dadosApolice.numeroApolice';
    component.applyManualSource('concat');
    component.draftManualSourcePath = '.dadosApolice.codigoSucursal';
    component.applyManualSource('defaultSource');
    component.draftManualSourcePath = 'dadosApolice.codigoSucursal';
    component.applyManualSource('fallback');
    component.draftManualSourcePath = '   ';
    component.applyManualSource('alias');

    expect(component.addConcatSource.emit).toHaveBeenCalledWith('$.dadosApolice.numeroApolice');
    expect(component.setDefaultSource.emit).toHaveBeenCalledWith('$.dadosApolice.codigoSucursal');
    expect(component.addAliasFallback.emit).toHaveBeenCalledWith('$.dadosApolice.codigoSucursal');
  });

  it('filtra fontes manuais e usa lista inicial quando a busca esta vazia', () => {
    component.manualSourceQuery = '';
    expect(component.filteredManualSources(1).length).toBe(1);

    component.manualSourceQuery = 'integer';
    expect(component.filteredManualSources().length).toBe(2);
  });

  it('supports drag and drop from manual source cards into link lanes', () => {
    spyOn(component.addConcatSource, 'emit');
    component.assistantsExpanded = true;
    fixture.detectChanges();

    component.startWorkbenchDrag('$.dadosApolice.codigoSucursal');
    component.activateLane('concat');
    component.dropOnLane('concat');

    expect(component.addConcatSource.emit).toHaveBeenCalledWith('$.dadosApolice.codigoSucursal');
    expect(component.currentDragPath()).toBe('');
    expect(component.hoveredLinkLane).toBeNull();
  });

  it('nao ativa lane nem faz drop sem path arrastado e descreve cada lane', () => {
    spyOn(component.setAliasSource, 'emit');
    component.activateLane('alias');
    component.dropOnLane('alias');

    expect(component.hoveredLinkLane).toBeNull();
    expect(component.setAliasSource.emit).not.toHaveBeenCalled();
    expect(component.laneDescription('alias')).toContain('alias principal');
    expect(component.laneDescription('concat')).toContain('concat');
    expect(component.laneDescription('defaultSource')).toContain('default dinamico');
    expect(component.laneDescription('fallback')).toContain('fallback');
  });

  it('renders the visual link overlay while dragging from the workbench', () => {
    component.assistantsExpanded = true;
    component.startWorkbenchDrag('$.dadosApolice.codigoSucursal');
    expect(component.showLinkOverlay()).toBeTrue();
  });

  it('resolve o caminho atual priorizando drag externo e limpa lane seletivamente', () => {
    component.draggedSourcePath = '$.externo.campo';
    component.startWorkbenchDrag('$.interno.campo');
    component.hoveredLinkLane = 'alias';

    expect(component.currentDragPath()).toBe('$.externo.campo');

    component.clearLane('concat');
    expect(component.hoveredLinkLane).toBe('alias');

    component.clearLane('alias');
    expect(component.hoveredLinkLane).toBeNull();
  });

  it('calcula overlay vazio quando nao ha frame ou ancora disponivel', () => {
    expect(component.linkOverlayViewBox()).toBe('0 0 1 1');
    expect(component.linkOverlayPath()).toBe('');
    expect(component.linkOverlayEndX()).toBe(0);
    expect(component.linkOverlayEndY()).toBe(0);
  });

  it('calcula overlay com frame e pointer durante o drag', () => {
    const frame = document.createElement('div');
    Object.defineProperty(frame, 'clientWidth', { value: 320 });
    Object.defineProperty(frame, 'clientHeight', { value: 180 });
    frame.getBoundingClientRect = () =>
      ({ left: 10, top: 20, width: 320, height: 180, right: 330, bottom: 200 } as DOMRect);

    const sourceAnchor = document.createElement('div');
    sourceAnchor.setAttribute('data-link-source-anchor', '');
    sourceAnchor.getBoundingClientRect = () =>
      ({ left: 20, top: 40, right: 60, height: 20 } as DOMRect);
    frame.appendChild(sourceAnchor);

    (component as unknown as { linkBuilderFrame: { nativeElement: HTMLElement } }).linkBuilderFrame = {
      nativeElement: frame
    };

    component.startWorkbenchDrag('$.dadosApolice.codigoSucursal');
    component.trackLinkPointer({ clientX: 120, clientY: 130 } as DragEvent);

    expect(component.linkOverlayViewBox()).toBe('0 0 320 180');
    expect(component.linkOverlayPath()).toContain('M');
    expect(component.linkOverlayEndX()).toBeGreaterThan(0);
    expect(component.linkOverlayEndY()).toBeGreaterThan(0);
  });

  it('usa a lane hover como destino preferencial do overlay', () => {
    const frame = document.createElement('div');
    Object.defineProperty(frame, 'clientWidth', { value: 300 });
    Object.defineProperty(frame, 'clientHeight', { value: 200 });
    frame.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 300, height: 200, right: 300, bottom: 200 } as DOMRect);

    const sourceAnchor = document.createElement('div');
    sourceAnchor.setAttribute('data-link-source-anchor', '');
    sourceAnchor.getBoundingClientRect = () =>
      ({ left: 10, top: 20, right: 30, height: 20 } as DOMRect);
    frame.appendChild(sourceAnchor);

    const lane = document.createElement('div');
    lane.setAttribute('data-link-lane', 'concat');
    lane.getBoundingClientRect = () =>
      ({ left: 200, top: 60, right: 240, height: 40 } as DOMRect);
    frame.appendChild(lane);

    (component as unknown as { linkBuilderFrame: { nativeElement: HTMLElement } }).linkBuilderFrame = {
      nativeElement: frame
    };

    component.startWorkbenchDrag('$.dadosApolice.codigoSucursal');
    component.activateLane('concat');

    expect(component.linkOverlayPath()).toContain('200');
  });

  it('renders dark code editor helpers for eval and script modes', () => {
    component.bindingModes = [
      { id: 'eval', label: 'Eval' },
      { id: 'script', label: 'Script' }
    ];
    component.selectedTargetNode = {
      ...component.selectedTargetNode!,
      binding: {
        mode: 'eval',
        sourcePaths: [],
        separator: '',
        formatters: [],
        defaultValue: '',
        defaultSourcePath: '',
        advancedExpression: '',
        evalExpression: 'return 1;'
      }
    };
    fixture.detectChanges();

    let element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Expressao eval');
    expect(element.textContent).toContain('Ternário JavaScript');
    expect(element.textContent).toContain('Ternário em Python');
    expect(element.textContent).toContain('Ternário Java');
    expect(element.textContent).toContain('Linguagem detectada: JavaScript / TypeScript');

    component.selectedTargetNode = {
      ...component.selectedTargetNode!,
      binding: {
        mode: 'script',
        sourcePaths: [],
        separator: '',
        formatters: [],
        defaultValue: '',
        defaultSourcePath: '',
        advancedExpression: '',
        script: {
          language: 'java',
          source: 'return "ok";',
          returnType: 'string'
        }
      }
    };
    fixture.detectChanges();

    element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Script do payload final');
    expect(element.textContent).toContain('Linguagem ativa: Java');
    expect(element.textContent).toContain('Ternário Java');
    expect(element.textContent).toContain('Ternário JavaScript');
    expect(element.textContent).toContain('Loop Java');
    const returnTypeSelect = element.querySelector('[data-testid="script-return-type-select"]') as HTMLSelectElement | null;
    expect(returnTypeSelect).toBeTruthy();
    expect(Array.from(returnTypeSelect?.options ?? []).some((option) => option.textContent?.trim() == 'string')).toBeTrue();
    expect(Array.from(returnTypeSelect?.options ?? []).some((option) => option.textContent?.trim() == 'object')).toBeTrue();
    expect(Array.from(returnTypeSelect?.options ?? []).some((option) => option.textContent?.trim() == 'date')).toBeTrue();
  });

  it('detects python and java syntaxes in eval editor automatically', () => {
    component.selectedTargetNode = {
      ...component.selectedTargetNode!,
      binding: {
        mode: 'eval',
        sourcePaths: [],
        separator: '',
        formatters: [],
        defaultValue: '',
        defaultSourcePath: '',
        advancedExpression: '',
        evalExpression: '"Porto" if dadosApolice.codigoMarca == 1001 else "Nao identificado"'
      }
    };

    expect(component.evalEditorLanguage(component.selectedTargetNode)).toBe('python');
    expect(component.evalEditorFileName(component.selectedTargetNode)).toBe('eval-expression.py');

    component.selectedTargetNode = {
      ...component.selectedTargetNode!,
      binding: {
        mode: 'eval',
        sourcePaths: [],
        separator: '',
        formatters: [],
        defaultValue: '',
        defaultSourcePath: '',
        advancedExpression: '',
        evalExpression: 'BigDecimal total = BigDecimal.ZERO; return total;'
      }
    };

    expect(component.evalEditorLanguage(component.selectedTargetNode)).toBe('java');
    expect(component.evalEditorFileName(component.selectedTargetNode)).toBe('eval-expression.java');

    component.selectedTargetNode = {
      ...component.selectedTargetNode!,
      binding: {
        mode: 'eval',
        sourcePaths: [],
        separator: '',
        formatters: [],
        defaultValue: '',
        defaultSourcePath: '',
        advancedExpression: '',
        evalExpression:
          'String resultado = (dadosApolice.getCodigoMarca() == 1001)\n  ? "Porto"\n  : "Não identificado";\n\nreturn resultado;'
      }
    };

    expect(component.evalEditorLanguage(component.selectedTargetNode)).toBe('java');
    expect(component.evalEditorLanguageLabel(component.selectedTargetNode)).toBe('Java');

    component.selectedTargetNode = {
      ...component.selectedTargetNode!,
      binding: {
        mode: 'eval',
        sourcePaths: [],
        separator: '',
        formatters: [],
        defaultValue: '',
        defaultSourcePath: '',
        advancedExpression: '',
        evalExpression:
          'resultado = "Porto" if dadosApolice.codigoMarca == 1001 else "Nao identificado"\\nreturn resultado'
      }
    };

    expect(component.evalEditorLanguage(component.selectedTargetNode)).toBe('python');
  });

  it('exposes script editor helpers based on the selected script language', () => {
    component.selectedTargetNode = {
      ...component.selectedTargetNode!,
      binding: {
        mode: 'script',
        sourcePaths: [],
        separator: '',
        formatters: [],
        defaultValue: '',
        defaultSourcePath: '',
        advancedExpression: '',
        script: {
          language: 'javascript',
          source: 'return true;',
          returnType: 'boolean'
        }
      }
    };

    expect(component.scriptEditorLanguage(component.selectedTargetNode)).toBe('javascript');
    expect(component.scriptEditorLanguageLabel(component.selectedTargetNode)).toBe('JavaScript');
    expect(component.scriptEditorFileName(component.selectedTargetNode)).toBe('transform-script.js');
  });

  it('exposes real-time detection badges and python support for eval and script', () => {
    component.selectedTargetNode = {
      ...component.selectedTargetNode!,
      binding: {
        mode: 'eval',
        sourcePaths: [],
        separator: '',
        formatters: [],
        defaultValue: '',
        defaultSourcePath: '',
        advancedExpression: '',
        evalExpression: 'resultado = "Porto" if dadosApolice.codigoMarca == 1001 else "Nao identificado"\nreturn resultado'
      }
    };
    fixture.detectChanges();

    let element = fixture.nativeElement as HTMLElement;
    expect(component.evalDetectionBadge(component.selectedTargetNode)).toBe('Script detectado');
    expect(element.textContent).toContain('Script detectado');

    component.selectedTargetNode = {
      ...component.selectedTargetNode!,
      binding: {
        mode: 'script',
        sourcePaths: [],
        separator: '',
        formatters: [],
        defaultValue: '',
        defaultSourcePath: '',
        advancedExpression: '',
        script: {
          language: 'python',
          source: 'resultado = "Porto"\nreturn resultado',
          returnType: 'string'
        }
      }
    };
    fixture.detectChanges();

    element = fixture.nativeElement as HTMLElement;
    expect(component.scriptEditorLanguage(component.selectedTargetNode)).toBe('python');
    expect(component.scriptEditorLanguageLabel(component.selectedTargetNode)).toBe('Python');
    expect(component.scriptEditorFileName(component.selectedTargetNode)).toBe('transform-script.py');
    expect(component.scriptDetectionBadge(component.selectedTargetNode)).toBe('Script detectado');
    expect(Array.from(element.querySelectorAll('select option')).some((option) => option.textContent?.trim() == 'Python')).toBeTrue();
  });
});
