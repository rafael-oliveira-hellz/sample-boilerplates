import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SchemaNodeDraft } from '@models/mapper.models';
import { TargetSchemaBuilderComponent } from './target-schema-builder.component';

describe('TargetSchemaBuilderComponent', () => {
  let component: TargetSchemaBuilderComponent;
  let fixture: ComponentFixture<TargetSchemaBuilderComponent>;
  let nodes: SchemaNodeDraft[];

  beforeEach(async () => {
    nodes = [
      {
        id: 'root',
        scope: 'target',
        key: 'root',
        label: 'Destino',
        path: '$',
        aliasPath: '',
        displayPath: 'destino',
        kind: 'root',
        type: 'object',
        parentId: null,
        children: [
          {
            id: 'root.data',
            scope: 'target',
            key: 'data',
            label: 'data',
            path: '$.data',
            aliasPath: 'data',
            displayPath: 'data',
            kind: 'object',
            type: 'object',
            parentId: 'root',
            children: [],
            expanded: true,
            manual: false,
            itemModel: false
          }
        ],
        expanded: true,
        manual: false,
        itemModel: false
      }
    ];

    await TestBed.configureTestingModule({
      imports: [TargetSchemaBuilderComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(TargetSchemaBuilderComponent);
    component = fixture.componentInstance;
    component.nodes = nodes;
    fixture.detectChanges();
  });

  it('renders builder mode helpers', () => {
    component.search = 'data';
    component.viewFilter = 'containers';

    expect(component.matches(nodes[0])).toBeTrue();
    expect(component.hasChildren(nodes[0])).toBeTrue();
    expect(component.trackNode(0, nodes[0])).toBe('root');
  });

  it('switches mode and emits select/drop events', () => {
    const event = { preventDefault: jasmine.createSpy('preventDefault') } as unknown as DragEvent;
    spyOn(component.selectNode, 'emit');
    spyOn(component.targetDrop, 'emit');

    component.toggleMode('json');
    component.onSelect(nodes[0].children[0]);
    component.allowDrop(event, nodes[0].children[0]);
    component.onDrop(event, 'root.data');

    expect(component.technicalMode).toBeTrue();
    expect(component.selectNode.emit).toHaveBeenCalledWith('root.data');
    expect(component.targetDrop.emit).toHaveBeenCalledWith('root.data');
  });

  it('switches to viewer mode when opening technical panel with existing json', () => {
    component.rawJsonText = '{"type":"object"}';

    component.toggleMode('json');

    expect(component.technicalMode).toBeTrue();
    expect(component.technicalPanelMode).toBe('viewer');
  });

  it('filters mapped and unmapped nodes and clears filters', () => {
    component.mappedTargetIds = new Set(['root.data']);
    component.emptyTargetIds = new Set();
    component.viewFilter = 'mapped';
    expect(component.matches(nodes[0].children[0])).toBeTrue();

    component.emptyTargetIds = new Set(['root.data']);
    component.viewFilter = 'unmapped';
    expect(component.matches(nodes[0].children[0])).toBeFalse();

    component.viewFilter = 'containers';
    expect(component.matches(nodes[0])).toBeTrue();

    component.clearFilters();
    expect(component.search).toBe('');
    expect(component.viewFilter).toBe('all');
  });

  it('supports leaves filter and recursive child matches', () => {
    const fieldNode: SchemaNodeDraft = {
      id: 'root.data.numero',
      scope: 'target',
      key: 'numero',
      label: 'numero',
      path: '$.data.numero',
      aliasPath: 'data.numero',
      displayPath: 'data.numero',
      kind: 'field',
      type: 'string',
      parentId: 'root.data',
      children: [],
      expanded: true,
      manual: false,
      itemModel: false
    };
    component.nodes = [
      {
        ...nodes[0],
        children: [{ ...nodes[0].children[0], children: [fieldNode] }]
      }
    ];

    component.viewFilter = 'leaves';
    expect(component.matches(fieldNode)).toBeTrue();
    expect(component.matches(component.nodes[0].children[0])).toBeTrue();
  });

  it('filters search matches and highlights text', () => {
    component.search = 'data';

    expect(component.searchMatches().map((node) => node.id)).toEqual(['root.data']);
    expect(component.highlightText('data.contrato')).toContain('<mark>data</mark>');
  });

  it('renders review badges for mapped, empty, rule and error states', () => {
    component.mappedTargetIds = new Set(['root.data']);
    component.emptyTargetIds = new Set(['root.data']);
    component.ruleTargetIds = new Set(['root.data']);
    component.errorTargetIds = new Set(['root.data']);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('mapeado');
    expect(element.textContent).toContain('vazio');
    expect(element.textContent).toContain('eval/script');
    expect(element.textContent).toContain('erro');
  });

  it('allows inline rename directly from the node card', () => {
    spyOn(component.renameNode, 'emit');
    spyOn(component.selectNode, 'emit');

    component.startInlineRename(nodes[0].children[0]);
    component.inlineRenameValue = 'contrato';
    component.commitInlineRename('root.data');

    expect(component.selectNode.emit).toHaveBeenCalledWith('root.data');
    expect(component.renameNode.emit).toHaveBeenCalledWith('contrato');
    expect(component.editingNodeId).toBe('');
  });

  it('does not start inline rename for item-model or root nodes and cancels blank rename', () => {
    const itemNode: SchemaNodeDraft = {
      ...nodes[0].children[0],
      id: 'root.itens.item',
      key: 'item',
      label: '[item]',
      itemModel: true
    };

    component.startInlineRename(nodes[0]);
    expect(component.editingNodeId).toBe('');

    component.startInlineRename(itemNode);
    expect(component.editingNodeId).toBe('');

    component.startInlineRename(nodes[0].children[0]);
    component.inlineRenameValue = '   ';
    component.commitInlineRename('root.data');
    expect(component.editingNodeId).toBe('');
  });

  it('shows drop intent feedback while hovering a dragged source over a node', () => {
    component.draggedSourcePath = '$.dadosApolice.numeroApolice';
    fixture.detectChanges();

    component.allowDrop({ preventDefault: jasmine.createSpy('preventDefault') } as unknown as DragEvent, nodes[0].children[0]);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(component.dropIntent(nodes[0].children[0])).toBe('new-child');
    expect(element.textContent).toContain('Drop para criar campo filho ligado');
  });

  it('handles drop hover clearing and no-drag scenarios', () => {
    spyOn(component.dropHoverChange, 'emit');

    component.allowDrop({ preventDefault: jasmine.createSpy('preventDefault') } as unknown as DragEvent, nodes[0].children[0]);
    expect(component.hoveredDropNodeId).toBe('');

    component.hoveredDropNodeId = 'root.data';
    component.clearDropHover('other');
    expect(component.hoveredDropNodeId).toBe('root.data');

    component.clearDropHover('root.data');
    expect(component.hoveredDropNodeId).toBe('');
    expect(component.dropHoverChange.emit).toHaveBeenCalledWith('');
  });

  it('emits node type changes from the shared type catalog', () => {
    const fieldNode: SchemaNodeDraft = {
      id: 'root.data.numero',
      scope: 'target',
      key: 'numero',
      label: 'numero',
      path: '$.data.numero',
      aliasPath: 'data.numero',
      displayPath: 'data.numero',
      kind: 'field',
      type: 'string',
      parentId: 'root.data',
      children: [],
      expanded: true,
      manual: false,
      itemModel: false,
      binding: {
        mode: 'unmapped',
        sourcePaths: [],
        separator: '',
        formatters: [],
        defaultValue: '',
        defaultSourcePath: '',
        advancedExpression: ''
      }
    };

    component.nodes = [
      {
        ...nodes[0],
        children: [{ ...nodes[0].children[0], children: [fieldNode] }]
      }
    ];
    component.selectedNodeId = 'root.data.numero';
    spyOn(component.updateNodeType, 'emit');

    component.updateSelectedNodeType('uuid');

    expect(component.updateNodeType.emit).toHaveBeenCalledWith('uuid');
  });

  it('emits nullable changes for the selected target node', () => {
    const fieldNode: SchemaNodeDraft = {
      id: 'root.data.numero',
      scope: 'target',
      key: 'numero',
      label: 'numero',
      path: '$.data.numero',
      aliasPath: 'data.numero',
      displayPath: 'data.numero',
      kind: 'field',
      type: 'string',
      parentId: 'root.data',
      children: [],
      expanded: true,
      manual: false,
      itemModel: false,
      binding: {
        mode: 'unmapped',
        sourcePaths: [],
        separator: '',
        formatters: [],
        defaultValue: '',
        defaultSourcePath: '',
        advancedExpression: ''
      }
    };

    component.nodes = [
      {
        ...nodes[0],
        children: [{ ...nodes[0].children[0], children: [fieldNode] }]
      }
    ];
    component.selectedNodeId = 'root.data.numero';
    spyOn(component.updateNodeNullable, 'emit');

    component.updateSelectedNodeNullable(true);

    expect(component.updateNodeNullable.emit).toHaveBeenCalledWith(true);
  });

  it('differentiates append, overwrite and noop drop effects on target fields', () => {
    const fieldNode: SchemaNodeDraft = {
      id: 'root.data.numero',
      scope: 'target',
      key: 'numero',
      label: 'numero',
      path: '$.data.numero',
      aliasPath: 'data.numero',
      displayPath: 'data.numero',
      kind: 'field',
      type: 'string',
      parentId: 'root.data',
      children: [],
      expanded: true,
      manual: false,
      itemModel: false,
      binding: {
        mode: 'alias',
        sourcePaths: ['$.dadosApolice.codigoSucursal'],
        separator: '',
        formatters: [],
        defaultValue: '',
        defaultSourcePath: '',
        advancedExpression: ''
      }
    };

    component.draggedSourcePath = '$.dadosApolice.numeroApolice';
    expect(component.dropEffect(fieldNode)).toBe('append');
    expect(component.dropIntentLabel(fieldNode)).toContain('complementar');

    fieldNode.binding = {
      ...fieldNode.binding!,
      mode: 'defaultLiteral',
      defaultValue: 'APOLICE'
    };
    expect(component.dropEffect(fieldNode)).toBe('overwrite');
    expect(component.dropIntentLabel(fieldNode)).toContain('substituir');

    fieldNode.binding = {
      ...fieldNode.binding!,
      mode: 'concat',
      sourcePaths: ['$.dadosApolice.numeroApolice']
    };
    expect(component.dropEffect(fieldNode)).toBe('noop');
    expect(component.dropIntentLabel(fieldNode)).toContain('ja participa');
  });

  it('covers remaining drop labels for alias, concat, array child and default branch', () => {
    const fieldNode: SchemaNodeDraft = {
      id: 'root.data.numero',
      scope: 'target',
      key: 'numero',
      label: 'numero',
      path: '$.data.numero',
      aliasPath: 'data.numero',
      displayPath: 'data.numero',
      kind: 'field',
      type: 'string',
      parentId: 'root.data',
      children: [],
      expanded: true,
      manual: false,
      itemModel: false,
      binding: {
        mode: 'unmapped',
        sourcePaths: [],
        separator: '',
        formatters: [],
        defaultValue: '',
        defaultSourcePath: '',
        advancedExpression: ''
      }
    };
    const arrayNode: SchemaNodeDraft = {
      ...nodes[0].children[0],
      id: 'root.itens',
      key: 'itens',
      kind: 'array',
      type: 'array'
    };

    component.draggedSourcePath = '$.dadosApolice.numeroApolice';
    expect(component.dropIntentLabel(fieldNode)).toContain('criar alias');

    fieldNode.binding = { ...fieldNode.binding!, mode: 'concat', sourcePaths: [] };
    expect(component.dropIntentLabel(fieldNode)).toContain('complementar');

    expect(component.dropIntentLabel(arrayNode)).toContain('item-modelo');

    component.draggedSourcePath = '';
    expect(component.dropEffect(fieldNode)).toBe('none');
    expect(component.dropIntent(fieldNode)).toBe('none');
    expect(component.dropIntentLabel(fieldNode)).toBe('');
  });

  it('emits hover from concat fan-in ports and highlights the active port', () => {
    const fieldNode: SchemaNodeDraft = {
      id: 'root.data.numero',
      scope: 'target',
      key: 'numero',
      label: 'numero',
      path: '$.data.numero',
      aliasPath: 'data.numero',
      displayPath: 'data.numero',
      kind: 'field',
      type: 'string',
      parentId: 'root.data',
      children: [],
      expanded: true,
      manual: false,
      itemModel: false,
      binding: {
        mode: 'concat',
        sourcePaths: ['$.dadosApolice.codigoSucursal', '$.dadosApolice.numeroApolice'],
        separator: '',
        formatters: [],
        defaultValue: '',
        defaultSourcePath: '',
        advancedExpression: ''
      }
    };

    component.nodes = [
      {
        ...nodes[0],
        children: [{ ...nodes[0].children[0], children: [fieldNode] }]
      }
    ];
    component.selectedNodeId = 'root.data.numero';
    component.highlightedConcatPortIndex = 1;
    spyOn(component.hoverConcatPort, 'emit');
    fixture.detectChanges();

    const port = (fixture.nativeElement as HTMLElement).querySelector('.fan-in-port') as HTMLElement;
    port.dispatchEvent(new Event('mouseenter'));
    port.dispatchEvent(new Event('mouseleave'));

    expect(component.hoverConcatPort.emit).toHaveBeenCalledWith(0);
    expect(component.hoverConcatPort.emit).toHaveBeenCalledWith(null);
    expect((fixture.nativeElement as HTMLElement).querySelector('.fan-in-port.highlighted')).toBeTruthy();
  });

  it('imports a file and applies the target schema automatically', () => {
    spyOn(component.importSchemaText, 'emit');

    component.handleImportedFile({
      content: '{"type":"object"}',
      summary: {
        name: 'destino.json',
        mimeType: 'application/json',
        extension: 'json',
        sizeLabel: '4.0 KB'
      }
    });

    expect(component.importSchemaText.emit).toHaveBeenCalledWith('{"type":"object"}');
    expect(component.importedFile?.name).toBe('destino.json');
  });

  it('clears imported target file info and resets the technical editor payload', () => {
    spyOn(component.rawJsonTextChange, 'emit');
    spyOn(component.importSchema, 'emit');
    component.importedFile = {
      name: 'destino.json',
      mimeType: 'application/json',
      extension: 'json',
      sizeLabel: '4.0 KB'
    };

    component.clearImportedFile();

    expect(component.importedFile).toBeNull();
    expect(component.rawJsonTextChange.emit).toHaveBeenCalledWith('');
    expect(component.importSchema.emit).toHaveBeenCalled();
  });
});
