import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SchemaNodeDraft } from '@models/mapper.models';
import { SourceSchemaTreeComponent } from './source-schema-tree.component';

describe('SourceSchemaTreeComponent', () => {
  let component: SourceSchemaTreeComponent;
  let fixture: ComponentFixture<SourceSchemaTreeComponent>;
  let nodes: SchemaNodeDraft[];

  beforeEach(async () => {
    nodes = [
      {
        id: 'root',
        scope: 'source',
        key: 'root',
        label: 'Origem',
        path: '$',
        aliasPath: '',
        displayPath: 'origem',
        kind: 'root',
        type: 'object',
        parentId: null,
        children: [
          {
            id: 'root.dados',
            scope: 'source',
            key: 'dados',
            label: 'dados',
            path: '$.dados',
            aliasPath: 'dados',
            displayPath: 'dados',
            kind: 'object',
            type: 'object',
            parentId: 'root',
            children: [
              {
                id: 'root.dados.nome',
                scope: 'source',
                key: 'nome',
                label: 'nome',
                path: '$.dados.nome',
                aliasPath: 'dados.nome',
                displayPath: 'dados.nome',
                kind: 'field',
                type: 'string',
                parentId: 'root.dados',
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
        ],
        expanded: true,
        manual: false,
        itemModel: false
      }
    ];

    await TestBed.configureTestingModule({
      imports: [SourceSchemaTreeComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(SourceSchemaTreeComponent);
    component = fixture.componentInstance;
    component.nodes = nodes;
    fixture.detectChanges();
  });

  it('renders builder mode and filters by search/type', () => {
    component.search = 'nome';
    component.typeFilter = 'string';
    component.usageFilter = 'leaves';

    expect(component.matches(nodes[0])).toBeTrue();
    expect(component.hasChildren(nodes[0])).toBeTrue();
    expect(component.trackNode(0, nodes[0])).toBe('root');
  });

  it('switches to technical mode and emits selection', () => {
    spyOn(component.selectNode, 'emit');

    component.toggleMode('json');
    component.onSelect(nodes[0].children[0].children[0]);

    expect(component.technicalMode).toBeTrue();
    expect(component.renameValue).toBe('nome');
    expect(component.selectNode.emit).toHaveBeenCalledWith('root.dados.nome');
  });

  it('emits drag only for leaf fields', () => {
    const dragEvent = {
      dataTransfer: {
        setData: jasmine.createSpy('setData')
      }
    } as unknown as DragEvent;
    spyOn(component.startDrag, 'emit');

    component.onDragStart(dragEvent, nodes[0].children[0].children[0]);
    component.onDragStart(dragEvent, nodes[0].children[0]);

    expect(component.startDrag.emit).toHaveBeenCalledOnceWith('$.dados.nome');
  });

  it('filters by usage state and clears filters', () => {
    component.usedPaths = new Set(['$.dados.nome']);
    component.usageFilter = 'used';
    expect(component.matches(nodes[0].children[0].children[0])).toBeTrue();

    component.usageFilter = 'unused';
    expect(component.matches(nodes[0].children[0].children[0])).toBeFalse();

    component.clearFilters();
    expect(component.search).toBe('');
    expect(component.typeFilter).toBe('all');
    expect(component.usageFilter).toBe('all');
  });

  it('filters search matches and highlights text', () => {
    component.search = 'nome';

    expect(component.searchMatches().map((node) => node.id)).toEqual(['root.dados.nome']);
    expect(component.highlightText('dados.nome')).toContain('<mark>nome</mark>');
  });

  it('allows inline rename directly from the node card', () => {
    spyOn(component.renameNode, 'emit');
    spyOn(component.selectNode, 'emit');

    component.startInlineRename(nodes[0].children[0].children[0]);
    component.inlineRenameValue = 'nomeCompleto';
    component.commitInlineRename('root.dados.nome');

    expect(component.selectNode.emit).toHaveBeenCalledWith('root.dados.nome');
    expect(component.renameNode.emit).toHaveBeenCalledWith('nomeCompleto');
    expect(component.editingNodeId).toBe('');
  });

  it('emits node type changes from the shared type catalog', () => {
    spyOn(component.updateNodeType, 'emit');
    component.selectedNodeId = 'root.dados.nome';

    component.updateSelectedNodeType('uuid');

    expect(component.updateNodeType.emit).toHaveBeenCalledWith('uuid');
  });

  it('emits nullable changes for the selected node', () => {
    spyOn(component.updateNodeNullable, 'emit');
    component.selectedNodeId = 'root.dados.nome';

    component.updateSelectedNodeNullable(true);

    expect(component.updateNodeNullable.emit).toHaveBeenCalledWith(true);
  });

  it('imports a file and applies the schema automatically', () => {
    spyOn(component.importSchemaText, 'emit');

    component.handleImportedFile({
      content: '{"type":"object"}',
      summary: {
        name: 'origem.json',
        mimeType: 'application/json',
        extension: 'json',
        sizeLabel: '2.0 KB'
      }
    });

    expect(component.importSchemaText.emit).toHaveBeenCalledWith('{"type":"object"}');
    expect(component.importedFile?.name).toBe('origem.json');
  });

  it('clears imported file info and resets the technical editor payload', () => {
    spyOn(component.rawJsonTextChange, 'emit');
    spyOn(component.importSchema, 'emit');
    component.importedFile = {
      name: 'origem.json',
      mimeType: 'application/json',
      extension: 'json',
      sizeLabel: '2.0 KB'
    };

    component.clearImportedFile();

    expect(component.importedFile).toBeNull();
    expect(component.rawJsonTextChange.emit).toHaveBeenCalledWith('');
    expect(component.importSchema.emit).toHaveBeenCalled();
  });
});
