import { TestBed } from '@angular/core/testing';
import { MappingEditorService } from './mapping-editor.service';
import { SchemaNodeDraft, TargetBindingMode } from '../../../core/models';

describe('MappingEditorService', () => {
  let service: MappingEditorService;
  let tree: SchemaNodeDraft[];

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(MappingEditorService);
    tree = [
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
            children: [
              {
                id: 'root.data.estado',
                scope: 'target',
                key: 'estado',
                label: 'estado',
                path: '$.data.estado',
                aliasPath: 'data.estado',
                displayPath: 'data.estado',
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
  });

  it('finds, updates and toggles nodes', () => {
    expect(service.findNode(tree, 'root.data.estado')?.label).toBe('estado');

    const updated = service.updateNode(tree, 'root.data.estado', (node) => {
      node.label = 'uf';
    });
    const toggled = service.toggleExpanded(updated, 'root.data');

    expect(service.findNode(updated, 'root.data.estado')?.label).toBe('uf');
    expect(service.findNode(toggled, 'root.data')?.expanded).toBeFalse();
  });

  it('returns null or cloned tree safely when node ids do not exist', () => {
    expect(service.findNode(tree, 'missing')).toBeNull();

    const updated = service.updateNode(tree, 'missing', (node) => {
      node.label = 'x';
    });

    expect(updated).not.toBe(tree);
    expect(service.findNode(updated, 'root.data.estado')?.label).toBe('estado');
  });

  it('renames and removes nodes safely', () => {
    const renamed = service.renameNode(tree, 'root.data.estado', 'estadoCivil');
    const removed = service.removeNode(renamed, 'root.data.estado');

    expect(service.findNode(renamed, 'root.data.estado')?.displayPath).toBe('data.estadoCivil');
    expect(service.findNode(removed, 'root.data.estado')).toBeNull();
    expect(service.renameNode(tree, 'root', 'x')).toBe(tree);
  });

  it('updates node field type and keeps script return type aligned', () => {
    const withScript = service.updateBinding(tree, 'root.data.estado', (binding) => {
      binding.mode = 'script';
      binding.script = {
        language: 'java',
        source: 'return "x";',
        returnType: 'string'
      };
    });

    const updated = service.updateNodeType(withScript, 'root.data.estado', 'uuid');

    expect(service.findNode(updated, 'root.data.estado')?.type).toBe('uuid');
    expect(service.findNode(updated, 'root.data.estado')?.binding?.script?.returnType).toBe('uuid');
  });

  it('ignores invalid type or nullable updates for unsupported nodes', () => {
    expect(service.updateNodeType(tree, 'root.data', 'integer')).toBe(tree);
    expect(service.updateNodeType(tree, 'root.data.estado', '   ')).toBe(tree);
    expect(service.updateNodeNullable(tree, 'root', true)).toBe(tree);

    const updated = service.updateNodeNullable(tree, 'root.data.estado', true);
    expect(service.findNode(updated, 'root.data.estado')?.nullable).toBeTrue();
  });

  it('adds fields and arrays under the selected container', () => {
    const addedField = service.addNode(tree, 'target', 'root.data', 'field');
    const addedArray = service.addNode(addedField.tree, 'target', 'root.data', 'array');
    const createdArray = service.findNode(addedArray.tree, addedArray.createdNodeId);

    expect(service.findNode(addedField.tree, addedField.createdNodeId)?.displayPath).toContain('novoCampo');
    expect(createdArray?.kind).toBe('array');
    expect(createdArray?.children[0].itemModel).toBeTrue();
  });

  it('adds source nodes without target binding and inserts under field parent or array item model', () => {
    const sourceTree: SchemaNodeDraft[] = [
      {
        ...tree[0],
        scope: 'source',
        children: [
          {
            ...tree[0].children[0],
            scope: 'source',
            children: [
              {
                ...tree[0].children[0].children[0],
                scope: 'source',
                binding: undefined
              },
              {
                id: 'root.data.itens',
                scope: 'source',
                key: 'itens',
                label: 'itens',
                path: '$.data.itens',
                aliasPath: 'data.itens',
                displayPath: 'data.itens',
                kind: 'array',
                type: 'array',
                parentId: 'root.data',
                children: [
                  {
                    id: 'root.data.itens.item',
                    scope: 'source',
                    key: 'item',
                    label: '[item]',
                    path: '$.data.itens[0]',
                    aliasPath: 'data.itens',
                    displayPath: 'data.itens[item]',
                    kind: 'object',
                    type: 'object',
                    parentId: 'root.data.itens',
                    children: [],
                    expanded: true,
                    manual: false,
                    itemModel: true
                  }
                ],
                expanded: true,
                manual: false,
                itemModel: false
              }
            ]
          }
        ]
      }
    ];

    const fromField = service.addNode(sourceTree, 'source', 'root.data.estado', 'field');
    const createdFromField = service.findNode(fromField.tree, fromField.createdNodeId)!;
    expect(createdFromField.parentId).toBe('root.data');
    expect(createdFromField.binding).toBeUndefined();

    const fromArray = service.addNode(sourceTree, 'source', 'root.data.itens', 'field');
    const createdFromArray = service.findNode(fromArray.tree, fromArray.createdNodeId)!;
    expect(createdFromArray.parentId).toBe('root.data.itens.item');
  });

  it('binds source drops semantically and lists mapped targets', () => {
    let updated = service.bindSourceDrop(tree, 'root.data.estado', '$.dadosApolice.uf');
    updated = service.bindSourceDrop(updated.tree, 'root.data.estado', '$.dadosApolice.sigla');

    const target = service.findNode(updated.tree, 'root.data.estado');
    const mapped = service.listMappedTargets(updated.tree);

    expect(target?.binding?.mode).toBe('concat');
    expect(target?.binding?.sourcePaths).toEqual(['$.dadosApolice.uf', '$.dadosApolice.sigla']);
    expect(mapped[0].summary).toContain('$.dadosApolice.uf');
  });

  it('bindSourceDrop handles missing targets, duplicate aliases and default overwrite modes', () => {
    const missing = service.bindSourceDrop(tree, 'missing', '$.dadosApolice.uf');
    expect(missing.tree).toBe(tree);

    let updated = service.setBindingMode(tree, 'root.data.estado', 'defaultLiteral');
    updated = service.updateBinding(updated, 'root.data.estado', (binding) => {
      binding.defaultValue = 'Porto';
    });
    updated = service.bindSourceDrop(updated, 'root.data.estado', '$.dadosApolice.uf').tree;
    expect(service.findNode(updated, 'root.data.estado')?.binding?.mode).toBe('alias');
    expect(service.findNode(updated, 'root.data.estado')?.binding?.sourcePaths).toEqual(['$.dadosApolice.uf']);

    updated = service.bindSourceDrop(updated, 'root.data.estado', '$.dadosApolice.uf').tree;
    expect(service.findNode(updated, 'root.data.estado')?.binding?.mode).toBe('alias');
    expect(service.findNode(updated, 'root.data.estado')?.binding?.sourcePaths).toEqual(['$.dadosApolice.uf']);

    updated = service.bindSourceDrop(updated, 'root.data.estado', '$.dadosApolice.sigla').tree;
    updated = service.bindSourceDrop(updated, 'root.data.estado', '$.dadosApolice.sigla').tree;
    expect(service.findNode(updated, 'root.data.estado')?.binding?.sourcePaths).toEqual([
      '$.dadosApolice.uf',
      '$.dadosApolice.sigla'
    ]);
  });

  it('creates a child field when dropping over a container and updates binding details', () => {
    let updated = service.bindSourceDrop(tree, 'root.data', '$.dadosCondutor.nome');
    const created = service.listMappedTargets(updated.tree).find((item) => item.targetPath.endsWith('nome'));

    expect(created).toBeTruthy();
    expect(updated.targetNodeId).toBe(created!.targetNodeId);

    let updatedTree = service.setBindingMode(updated.tree, created!.targetNodeId, 'defaultLiteral');
    updatedTree = service.updateBinding(updatedTree, created!.targetNodeId, (binding) => {
      binding.defaultValue = 'Porto';
    });

    expect(service.findNode(updatedTree, created!.targetNodeId)?.binding?.defaultValue).toBe('Porto');
  });

  it('relativizes dropped source paths inside target arrays configured with map_from', () => {
    const arrayTree: SchemaNodeDraft[] = [
      {
        ...tree[0],
        children: [
          {
            ...tree[0].children[0],
            children: [
              {
                id: 'root.data.itens',
                scope: 'target',
                key: 'itens',
                label: 'itens',
                path: '$.data.itens',
                aliasPath: 'data.itens',
                displayPath: 'data.itens',
                kind: 'array',
                type: 'array',
                parentId: 'root.data',
                mapFrom: {
                  sourcePaths: ['$.descontos'],
                  aliasStrategy: 'fallback'
                },
                children: [
                  {
                    id: 'root.data.itens.item',
                    scope: 'target',
                    key: 'item',
                    label: '[item]',
                    path: '$.data.itens[0]',
                    aliasPath: 'data.itens',
                    displayPath: 'data.itens[item]',
                    kind: 'object',
                    type: 'object',
                    parentId: 'root.data.itens',
                    children: [
                      {
                        id: 'root.data.itens.item.codigo',
                        scope: 'target',
                        key: 'codigo',
                        label: 'codigo',
                        path: '$.data.itens[0].codigo',
                        aliasPath: 'data.itens.codigo',
                        displayPath: 'data.itens[item].codigo',
                        kind: 'field',
                        type: 'string',
                        parentId: 'root.data.itens.item',
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
                      }
                    ],
                    expanded: true,
                    manual: false,
                    itemModel: true
                  }
                ],
                expanded: true,
                manual: false,
                itemModel: false
              }
            ]
          }
        ]
      }
    ];

    const updated = service.bindSourceDrop(arrayTree, 'root.data.itens.item.codigo', '$.descontos[0].codigoDesconto').tree;

    expect(service.findNode(updated, 'root.data.itens.item.codigo')?.binding?.sourcePaths).toEqual(['$.codigoDesconto']);
  });

  it('relativizes drops against the deepest map_from ancestor in multi-level nested arrays', () => {
    const deepArrayTree: SchemaNodeDraft[] = [
      {
        ...tree[0],
        children: [
          {
            ...tree[0].children[0],
            children: [
              {
                id: 'root.data.pacotes',
                scope: 'target',
                key: 'pacotes',
                label: 'pacotes',
                path: '$.data.pacotes',
                aliasPath: 'data.pacotes',
                displayPath: 'data.pacotes',
                kind: 'array',
                type: 'array',
                parentId: 'root.data',
                mapFrom: {
                  sourcePaths: ['$.apolice.pacotes'],
                  aliasStrategy: 'fallback'
                },
                children: [
                  {
                    id: 'root.data.pacotes.item',
                    scope: 'target',
                    key: 'item',
                    label: '[item]',
                    path: '$.data.pacotes[0]',
                    aliasPath: 'data.pacotes',
                    displayPath: 'data.pacotes[item]',
                    kind: 'object',
                    type: 'object',
                    parentId: 'root.data.pacotes',
                    children: [
                      {
                        id: 'root.data.pacotes.item.itens',
                        scope: 'target',
                        key: 'itens',
                        label: 'itens',
                        path: '$.data.pacotes[0].itens',
                        aliasPath: 'data.pacotes.itens',
                        displayPath: 'data.pacotes[item].itens',
                        kind: 'array',
                        type: 'array',
                        parentId: 'root.data.pacotes.item',
                        mapFrom: {
                          sourcePaths: ['$.itens'],
                          aliasStrategy: 'fallback'
                        },
                        children: [
                          {
                            id: 'root.data.pacotes.item.itens.item',
                            scope: 'target',
                            key: 'item',
                            label: '[item]',
                            path: '$.data.pacotes[0].itens[0]',
                            aliasPath: 'data.pacotes.itens',
                            displayPath: 'data.pacotes[item].itens[item]',
                            kind: 'object',
                            type: 'object',
                            parentId: 'root.data.pacotes.item.itens',
                            children: [
                              {
                                id: 'root.data.pacotes.item.itens.item.coberturas',
                                scope: 'target',
                                key: 'coberturas',
                                label: 'coberturas',
                                path: '$.data.pacotes[0].itens[0].coberturas',
                                aliasPath: 'data.pacotes.itens.coberturas',
                                displayPath: 'data.pacotes[item].itens[item].coberturas',
                                kind: 'array',
                                type: 'array',
                                parentId: 'root.data.pacotes.item.itens.item',
                                mapFrom: {
                                  sourcePaths: ['$.coberturas'],
                                  aliasStrategy: 'fallback'
                                },
                                children: [
                                  {
                                    id: 'root.data.pacotes.item.itens.item.coberturas.item',
                                    scope: 'target',
                                    key: 'item',
                                    label: '[item]',
                                    path: '$.data.pacotes[0].itens[0].coberturas[0]',
                                    aliasPath: 'data.pacotes.itens.coberturas',
                                    displayPath: 'data.pacotes[item].itens[item].coberturas[item]',
                                    kind: 'object',
                                    type: 'object',
                                    parentId: 'root.data.pacotes.item.itens.item.coberturas',
                                    children: [
                                      {
                                        id: 'root.data.pacotes.item.itens.item.coberturas.item.codigo',
                                        scope: 'target',
                                        key: 'codigo',
                                        label: 'codigo',
                                        path: '$.data.pacotes[0].itens[0].coberturas[0].codigo',
                                        aliasPath: 'data.pacotes.itens.coberturas.codigo',
                                        displayPath: 'data.pacotes[item].itens[item].coberturas[item].codigo',
                                        kind: 'field',
                                        type: 'string',
                                        parentId: 'root.data.pacotes.item.itens.item.coberturas.item',
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
                                      }
                                    ],
                                    expanded: true,
                                    manual: false,
                                    itemModel: true
                                  }
                                ],
                                expanded: true,
                                manual: false,
                                itemModel: false
                              }
                            ],
                            expanded: true,
                            manual: false,
                            itemModel: true
                          }
                        ],
                        expanded: true,
                        manual: false,
                        itemModel: false
                      }
                    ],
                    expanded: true,
                    manual: false,
                    itemModel: true
                  }
                ],
                expanded: true,
                manual: false,
                itemModel: false
              }
            ]
          }
        ]
      }
    ];

    const updated = service.bindSourceDrop(
      deepArrayTree,
      'root.data.pacotes.item.itens.item.coberturas.item.codigo',
      '$.apolice.pacotes[0].itens[0].coberturas[0].codigoCobertura'
    ).tree;

    expect(
      service.findNode(updated, 'root.data.pacotes.item.itens.item.coberturas.item.codigo')?.binding?.sourcePaths
    ).toEqual(['$.codigoCobertura']);
  });

  it('relativizes object descendants inside a map_from context without repeating the full object hierarchy', () => {
    const objectInsideArrayTree: SchemaNodeDraft[] = [
      {
        ...tree[0],
        children: [
          {
            ...tree[0].children[0],
            children: [
              {
                id: 'root.data.pacotes',
                scope: 'target',
                key: 'pacotes',
                label: 'pacotes',
                path: '$.data.pacotes',
                aliasPath: 'data.pacotes',
                displayPath: 'data.pacotes',
                kind: 'array',
                type: 'array',
                parentId: 'root.data',
                mapFrom: {
                  sourcePaths: ['$.pacotes'],
                  aliasStrategy: 'fallback'
                },
                children: [
                  {
                    id: 'root.data.pacotes.item',
                    scope: 'target',
                    key: 'item',
                    label: '[item]',
                    path: '$.data.pacotes[0]',
                    aliasPath: 'data.pacotes',
                    displayPath: 'data.pacotes[item]',
                    kind: 'object',
                    type: 'object',
                    parentId: 'root.data.pacotes',
                    children: [
                      {
                        id: 'root.data.pacotes.item.endereco',
                        scope: 'target',
                        key: 'endereco',
                        label: 'endereco',
                        path: '$.data.pacotes[0].endereco',
                        aliasPath: 'data.pacotes.endereco',
                        displayPath: 'data.pacotes[item].endereco',
                        kind: 'object',
                        type: 'object',
                        parentId: 'root.data.pacotes.item',
                        children: [
                          {
                            id: 'root.data.pacotes.item.endereco.cep',
                            scope: 'target',
                            key: 'cep',
                            label: 'cep',
                            path: '$.data.pacotes[0].endereco.cep',
                            aliasPath: 'data.pacotes.endereco.cep',
                            displayPath: 'data.pacotes[item].endereco.cep',
                            kind: 'field',
                            type: 'string',
                            parentId: 'root.data.pacotes.item.endereco',
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
                          }
                        ],
                        expanded: true,
                        manual: false,
                        itemModel: false
                      }
                    ],
                    expanded: true,
                    manual: false,
                    itemModel: true
                  }
                ],
                expanded: true,
                manual: false,
                itemModel: false
              }
            ]
          }
        ]
      }
    ];

    const updated = service.bindSourceDrop(
      objectInsideArrayTree,
      'root.data.pacotes.item.endereco.cep',
      '$.pacotes[0].endereco.cep'
    ).tree;

    expect(service.findNode(updated, 'root.data.pacotes.item.endereco.cep')?.binding?.sourcePaths).toEqual(['$.cep']);
  });

  it('resets mode-specific state when changing binding mode and describes all modes', () => {
    let updated = service.setBindingMode(tree, 'root.data.estado', 'alias');
    expect(service.findNode(updated, 'root.data.estado')?.binding?.sourcePaths).toEqual(['']);

    updated = service.setBindingMode(updated, 'root.data.estado', 'concat');
    expect(service.findNode(updated, 'root.data.estado')?.binding?.sourcePaths).toEqual(['']);

    updated = service.updateBinding(updated, 'root.data.estado', (binding) => {
      binding.defaultValue = 'valor';
      binding.defaultSourcePath = '$.origem.valor';
      binding.evalExpression = 'return 1;';
      binding.script = {
        language: 'javascript',
        source: 'return 1;',
        returnType: 'string'
      };
      binding.separator = '-';
    });

    updated = service.setBindingMode(updated, 'root.data.estado', 'defaultLiteral');
    let binding = service.findNode(updated, 'root.data.estado')?.binding!;
    expect(binding.defaultSourcePath).toBe('');
    expect(binding.evalExpression).toBe('');
    expect(binding.script?.source).toBe('');

    updated = service.setBindingMode(updated, 'root.data.estado', 'unmapped');
    binding = service.findNode(updated, 'root.data.estado')?.binding!;
    expect(binding.mode).toBe('unmapped');
    expect(binding.sourcePaths).toEqual([]);

    const describedTree = service.updateBinding(updated, 'root.data.estado', (targetBinding) => {
      targetBinding.mode = 'rule';
    });
    const summary = service.listMappedTargets(describedTree)[0].summary;
    expect(summary).toContain('eval/script visual');
  });

  it('keeps default literal when switching to defaultSource and falls back safely when parent/container ids are missing', () => {
    let updated = service.updateBinding(tree, 'root.data.estado', (binding) => {
      binding.mode = 'defaultLiteral';
      binding.defaultValue = 'Porto';
      binding.sourcePaths = ['$.dadosApolice.uf', '$.dadosApolice.sigla'];
    });

    updated = service.setBindingMode(updated, 'root.data.estado', 'defaultSource');
    let binding = service.findNode(updated, 'root.data.estado')?.binding!;
    expect(binding.defaultValue).toBe('Porto');

    const orphanTree = service.updateNode(updated, 'root.data.estado', (node) => {
      node.parentId = 'missing-parent';
    });
    expect(service.renameNode(orphanTree, 'root.data.estado', 'uf')).not.toBe(orphanTree);
    expect(service.findNode(service.renameNode(orphanTree, 'root.data.estado', 'uf'), 'root.data.estado')?.label).toBe('uf');

    const inserted = service.addNode(updated, 'target', 'missing-node', 'field');
    expect(service.findNode(inserted.tree, inserted.createdNodeId)?.parentId).toBe('root');
  });

  it('describes default, eval and script bindings with readable summaries', () => {
    const scenarios: Array<{ mode: TargetBindingMode; configure: (tree: SchemaNodeDraft[]) => SchemaNodeDraft[]; expected: string }> = [
      {
        mode: 'defaultLiteral',
        configure: (nodes) =>
          service.updateBinding(nodes, 'root.data.estado', (binding) => {
            binding.mode = 'defaultLiteral';
            binding.defaultValue = 'APOLICE';
          }),
        expected: 'Default fixo'
      },
      {
        mode: 'defaultSource',
        configure: (nodes) =>
          service.updateBinding(nodes, 'root.data.estado', (binding) => {
            binding.mode = 'defaultSource';
            binding.defaultSourcePath = '$.dadosApolice.uf';
          }),
        expected: 'Default da origem'
      },
      {
        mode: 'eval',
        configure: (nodes) =>
          service.updateBinding(nodes, 'root.data.estado', (binding) => {
            binding.mode = 'eval';
            binding.evalExpression = '1 + 1';
          }),
        expected: 'Eval'
      },
      {
        mode: 'script',
        configure: (nodes) =>
          service.updateBinding(nodes, 'root.data.estado', (binding) => {
            binding.mode = 'script';
            binding.script = {
              language: 'java',
              source: 'return 1;',
              returnType: 'string'
            };
          }),
        expected: 'Script'
      }
    ];

    scenarios.forEach(({ configure, expected }) => {
      const updated = configure(tree);
      expect(service.listMappedTargets(updated)[0].summary).toContain(expected);
    });
  });
});



