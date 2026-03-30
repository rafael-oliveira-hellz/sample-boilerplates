import { TestBed } from '@angular/core/testing';
import { SchemaNodeDraft } from '@models/mapper.models';
import { SchemaGeneratorService } from './schema-generator.service';
import { SchemaImportService } from './schema-import.service';

describe('SchemaGeneratorService', () => {
  let service: SchemaGeneratorService;
  let schemaImport: SchemaImportService;
  let targetTree: SchemaNodeDraft[];

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SchemaGeneratorService);
    schemaImport = TestBed.inject(SchemaImportService);
    targetTree = [
      {
        id: 'target-root',
        scope: 'target',
        key: 'root',
        label: 'Destino',
        path: '$',
        aliasPath: '',
        displayPath: 'destino',
        kind: 'root',
        type: 'object',
        parentId: null,
        expanded: true,
        manual: false,
        itemModel: false,
        children: [
          {
            id: 'target-root.data',
            scope: 'target',
            key: 'data',
            label: 'data',
            path: '$.data',
            aliasPath: 'data',
            displayPath: 'data',
            kind: 'object',
            type: 'object',
            parentId: 'target-root',
            expanded: true,
            manual: false,
            itemModel: false,
            children: [
              {
                id: 'target-root.data.estado',
                scope: 'target',
                key: 'estado',
                label: 'estado',
                path: '$.data.estado',
                aliasPath: 'data.estado',
                displayPath: 'data.estado',
                kind: 'field',
                type: 'string',
                parentId: 'target-root.data',
                expanded: true,
                manual: false,
                itemModel: false,
                children: [],
                binding: {
                  mode: 'alias',
                  sourcePaths: ['$.dadosApolice.estado'],
                  separator: '',
                  formatters: [],
                  defaultValue: '',
                  defaultSourcePath: '',
                  advancedExpression: ''
                }
              },
              {
                id: 'target-root.data.cep',
                scope: 'target',
                key: 'cep',
                label: 'cep',
                path: '$.data.cep',
                aliasPath: 'data.cep',
                displayPath: 'data.cep',
                kind: 'field',
                type: 'string',
                parentId: 'target-root.data',
                expanded: true,
                manual: false,
                itemModel: false,
                children: [],
                binding: {
                  mode: 'concat',
                  sourcePaths: ['$.dadosApolice.cep', '$.dadosApolice.complemento'],
                  separator: '-',
                  formatters: [
                    { id: '1', pad: 'left', length: 5, char: '0' },
                    { id: '2', pad: 'left', length: 3, char: '0' }
                  ],
                  defaultValue: '',
                  defaultSourcePath: '',
                  advancedExpression: ''
                }
              },
              {
                id: 'target-root.data.tip',
                scope: 'target',
                key: 'tip',
                label: 'tip',
                path: '$.data.tip',
                aliasPath: 'data.tip',
                displayPath: 'data.tip',
                kind: 'field',
                type: 'string',
                parentId: 'target-root.data',
                expanded: true,
                manual: false,
                itemModel: false,
                children: [],
                binding: {
                  mode: 'defaultLiteral',
                  sourcePaths: [],
                  separator: '',
                  formatters: [],
                  defaultValue: 'APOLICE',
                  defaultSourcePath: '',
                  advancedExpression: ''
                }
              },
              {
                id: 'target-root.data.estadoCalculado',
                scope: 'target',
                key: 'estadoCalculado',
                label: 'estadoCalculado',
                path: '$.data.estadoCalculado',
                aliasPath: 'data.estadoCalculado',
                displayPath: 'data.estadoCalculado',
                kind: 'field',
                type: 'string',
                parentId: 'target-root.data',
                expanded: true,
                manual: false,
                itemModel: false,
                children: [],
                binding: {
                  mode: 'eval',
                  sourcePaths: [],
                  aliasStrategy: 'fallback',
                  separator: '',
                  formatters: [],
                  defaultValue: '',
                  defaultSourcePath: '',
                  advancedExpression: '',
                  evalExpression: "dadosApolice.estado == 'SP' ? 'SAOPAULO' : 'OUTRO'",
                  script: {
                    language: 'java',
                    source: '',
                    returnType: 'string'
                  }
                }
              },
              {
                id: 'target-root.data.itens',
                scope: 'target',
                key: 'itens',
                label: 'itens',
                path: '$.data.itens',
                aliasPath: 'data.itens',
                displayPath: 'data.itens',
                kind: 'array',
                type: 'array',
                parentId: 'target-root.data',
                expanded: true,
                manual: false,
                itemModel: false,
                mapFrom: {
                  sourcePaths: ['$.dadosApolice.itens'],
                  aliasStrategy: 'fallback'
                },
                children: [
                  {
                    id: 'target-root.data.itens.item',
                    scope: 'target',
                    key: 'item',
                    label: '[item]',
                    path: '$.data.itens[0]',
                    aliasPath: 'data.itens',
                    displayPath: 'data.itens[item]',
                    kind: 'object',
                    type: 'object',
                    parentId: 'target-root.data.itens',
                    expanded: true,
                    manual: false,
                    itemModel: true,
                    children: [
                      {
                        id: 'target-root.data.itens.item.valor',
                        scope: 'target',
                        key: 'valorCobertura',
                        label: 'valorCobertura',
                        path: '$.data.itens[0].valorCobertura',
                        aliasPath: 'data.itens.valorCobertura',
                        displayPath: 'data.itens[item].valorCobertura',
                        kind: 'field',
                        type: 'number',
                        parentId: 'target-root.data.itens.item',
                        expanded: true,
                        manual: false,
                        itemModel: false,
                        children: [],
                        binding: {
                          mode: 'alias',
                          sourcePaths: ['$.valor'],
                          aliasStrategy: 'fallback',
                          separator: '',
                          formatters: [],
                          defaultValue: '',
                          defaultSourcePath: '',
                          advancedExpression: '',
                          evalExpression: '',
                          script: {
                            language: 'java',
                            source: '',
                            returnType: 'number'
                          }
                        }
                      }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      }
    ];
  });

  it('generates declarative target schema with alias, concat and defaults', () => {
    const schema = service.generateTargetSchema(targetTree);
    const rootProperties = schema['properties'] as Record<string, unknown>;
    const data = ((rootProperties['data'] as Record<string, unknown>)['properties']) as Record<
      string,
      unknown
    >;

    expect((data['estado'] as Record<string, unknown>)['alias']).toEqual(['dadosApolice.estado']);
    expect(((data['cep'] as Record<string, unknown>)['concat'] as Record<string, unknown>)['separator']).toBe('-');
    expect((data['tip'] as Record<string, unknown>)['default']).toBe('APOLICE');
    expect(((data['estadoCalculado'] as Record<string, unknown>)['eval'] as Record<string, unknown>)['alias']).toContain('estado');
    expect(((data['itens'] as Record<string, unknown>)['map_from'] as Record<string, unknown>)['alias']).toEqual(['dadosApolice.itens']);
  });

  it('adds eval_type script when eval contains code or explicit evalType', () => {
    const evalNode = targetTree[0].children[0].children.find((node) => node.displayPath == 'data.estadoCalculado')!;
    evalNode.binding = {
      ...evalNode.binding!,
      mode: 'eval',
      evalExpression: 'var total = 0; for (const item of dadosApolice.itens) { total += item.valor; } return total;',
      evalType: 'script'
    };

    const schema = service.generateTargetSchema(targetTree);
    const rootProperties = schema['properties'] as Record<string, unknown>;
    const data = ((rootProperties['data'] as Record<string, unknown>)['properties']) as Record<string, unknown>;
    const evalBlock = (data['estadoCalculado'] as Record<string, unknown>)['eval'] as Record<string, unknown>;

    expect(evalBlock['eval_type']).toBe('script');
  });

  it('adds eval_type script for python-style code blocks in eval', () => {
    const evalNode = targetTree[0].children[0].children.find((node) => node.displayPath == 'data.estadoCalculado')!;
    evalNode.binding = {
      ...evalNode.binding!,
      mode: 'eval',
      evalExpression: 'resultado = "Porto" if dadosApolice.codigoMarca == 1001 else "Nao identificado"\nreturn resultado',
      evalType: undefined
    };

    const schema = service.generateTargetSchema(targetTree);
    const rootProperties = schema['properties'] as Record<string, unknown>;
    const data = ((rootProperties['data'] as Record<string, unknown>)['properties']) as Record<string, unknown>;
    const evalBlock = (data['estadoCalculado'] as Record<string, unknown>)['eval'] as Record<string, unknown>;

    expect(evalBlock['eval_type']).toBe('script');
  });

  it('adds eval_type script for python-style code blocks when the newline is escaped', () => {
    const evalNode = targetTree[0].children[0].children.find((node) => node.displayPath == 'data.estadoCalculado')!;
    evalNode.binding = {
      ...evalNode.binding!,
      mode: 'eval',
      evalExpression: 'resultado = "Porto" if dadosApolice.codigoMarca == 1001 else "Nao identificado"\\nreturn resultado',
      evalType: undefined
    };

    const schema = service.generateTargetSchema(targetTree);
    const rootProperties = schema['properties'] as Record<string, unknown>;
    const data = ((rootProperties['data'] as Record<string, unknown>)['properties']) as Record<string, unknown>;
    const evalBlock = (data['estadoCalculado'] as Record<string, unknown>)['eval'] as Record<string, unknown>;

    expect(evalBlock['eval_type']).toBe('script');
  });

  it('does not add eval_type script for declarative ternary expressions', () => {
    const evalNode = targetTree[0].children[0].children.find((node) => node.displayPath == 'data.estadoCalculado')!;
    evalNode.binding = {
      ...evalNode.binding!,
      mode: 'eval',
      evalExpression: "dadosApolice.codigoMarca == 1001 ? 'Porto' : null",
      evalType: undefined
    };

    const schema = service.generateTargetSchema(targetTree);
    const rootProperties = schema['properties'] as Record<string, unknown>;
    const data = ((rootProperties['data'] as Record<string, unknown>)['properties']) as Record<string, unknown>;
    const evalBlock = (data['estadoCalculado'] as Record<string, unknown>)['eval'] as Record<string, unknown>;

    expect(evalBlock['eval_type']).toBeUndefined();
  });

  it('does not add eval_type script for single-line python ternary expressions', () => {
    const evalNode = targetTree[0].children[0].children.find((node) => node.displayPath == 'data.estadoCalculado')!;
    evalNode.binding = {
      ...evalNode.binding!,
      mode: 'eval',
      evalExpression: '"Porto" if dadosApolice.codigoMarca == 1001 else "Nao identificado"',
      evalType: undefined
    };

    const schema = service.generateTargetSchema(targetTree);
    const rootProperties = schema['properties'] as Record<string, unknown>;
    const data = ((rootProperties['data'] as Record<string, unknown>)['properties']) as Record<string, unknown>;
    const evalBlock = (data['estadoCalculado'] as Record<string, unknown>)['eval'] as Record<string, unknown>;

    expect(evalBlock['eval_type']).toBeUndefined();
  });

  it('generates source schema from visual tree', () => {
    const schema = service.generateSourceSchema(targetTree, 'x');

    expect(schema['$schema']).toBe('x');
    expect(schema['type']).toBe('object');
  });

  it('emits nullable true when the node is marked as nullable', () => {
    const estadoNode = targetTree[0].children[0].children[0];
    estadoNode.nullable = true;

    const targetSchema = service.generateTargetSchema(targetTree);
    const sourceSchema = service.generateSourceSchema(targetTree, 'x');
    const targetData = ((targetSchema['properties'] as Record<string, unknown>)['data'] as Record<string, unknown>)['properties'] as Record<string, unknown>;
    const sourceData = ((sourceSchema['properties'] as Record<string, unknown>)['data'] as Record<string, unknown>)['properties'] as Record<string, unknown>;

    expect((targetData['estado'] as Record<string, unknown>)['nullable']).toBeTrue();
    expect((sourceData['estado'] as Record<string, unknown>)['nullable']).toBeTrue();
  });

  it('collects validation errors for unmapped, alias, concat, defaultSource, eval, script and map_from', () => {
    const brokenTree = structuredClone(targetTree) as SchemaNodeDraft[];
    const dataNode = brokenTree[0].children[0];

    dataNode.children[0].binding = {
      ...dataNode.children[0].binding!,
      mode: 'unmapped'
    };
    dataNode.children[1].binding = {
      ...dataNode.children[1].binding!,
      mode: 'concat',
      sourcePaths: []
    };
    dataNode.children[2].binding = {
      ...dataNode.children[2].binding!,
      mode: 'defaultSource',
      defaultSourcePath: ''
    };
    dataNode.children[3].binding = {
      ...dataNode.children[3].binding!,
      mode: 'eval',
      evalExpression: '   '
    };
    dataNode.children.push({
      id: 'target-root.data.scriptBroken',
      scope: 'target',
      key: 'scriptBroken',
      label: 'scriptBroken',
      path: '$.data.scriptBroken',
      aliasPath: 'data.scriptBroken',
      displayPath: 'data.scriptBroken',
      kind: 'field',
      type: 'string',
      parentId: 'target-root.data',
      expanded: true,
      manual: false,
      itemModel: false,
      children: [],
      binding: {
        mode: 'script',
        sourcePaths: [],
        aliasStrategy: 'fallback',
        separator: '',
        formatters: [],
        defaultValue: '',
        defaultSourcePath: '',
        advancedExpression: '',
        evalExpression: '',
        script: {
          language: 'java',
          source: '   ',
          returnType: 'string'
        }
      }
    });
    const itens = dataNode.children.find((node) => node.key === 'itens')!;
    itens.mapFrom = {
      sourcePaths: [],
      aliasStrategy: 'fallback'
    };

    const errors = service.collectValidationErrors(brokenTree);

    expect(errors.some((item) => item.includes('ainda nao foi configurado'))).toBeTrue();
    expect(errors.some((item) => item.includes('concat'))).toBeTrue();
    expect(errors.some((item) => item.includes('default dinamico'))).toBeTrue();
    expect(errors.some((item) => item.includes('expressao eval'))).toBeTrue();
    expect(errors.some((item) => item.includes('script configurado'))).toBeTrue();
    expect(errors.some((item) => item.includes('map_from'))).toBeTrue();
  });

  it('builds preview payload applying bindings and rules', () => {
    const preview = service.buildPreviewPayload(
      JSON.stringify({
        dadosApolice: {
          estado: 'SP',
          cep: 123,
          complemento: 45,
          itens: [{ valor: 10 }]
        }
      }),
      targetTree,
      [],
      'http://json-schema.org/draft-04/schema#'
    );

    expect(preview).toContain('"estado": "SP"');
    expect(preview).toContain('"cep": "00123-045"');
    expect(preview).toContain('"tip": "APOLICE"');
    expect(preview).toContain('"estadoCalculado": "SAOPAULO"');
    expect(preview).toContain('"valorCobertura": 10');
  });

  it('covers literal parsing, formatter padding and expression fallbacks', () => {
    const generator = service as unknown as {
      parseLiteralByType: (type: string, value: string) => unknown;
      applyFormatter: (value: unknown, formatter?: { pad: 'left' | 'right'; length: number; char: string }) => string;
      evaluateBindingExpression: (
        expression: string,
        sourceRoot: Record<string, unknown>,
        currentSource: Record<string, unknown>,
        targetRoot: Record<string, unknown>,
        targetPath: string
      ) => unknown;
      parseRuleLiteral: (value: string) => unknown;
      toExpressionLiteral: (value: string) => string;
    };

    expect(generator.parseLiteralByType('integer', '')).toBeNull();
    expect(generator.parseLiteralByType('boolean', 'false')).toBeFalse();
    expect(generator.applyFormatter('7', { pad: 'right', length: 3, char: 'x' })).toBe('7xx');
    expect(generator.applyFormatter('7')).toBe('7');
    expect(generator.evaluateBindingExpression('   ', {}, {}, {}, '$.data.x')).toBeUndefined();
    expect(generator.evaluateBindingExpression('return ???', {}, {}, {}, '$.data.x')).toContain('[eval]');
    expect(generator.parseRuleLiteral('null')).toBeNull();
    expect(generator.parseRuleLiteral('  15 ')).toBe(15);
    expect(generator.toExpressionLiteral('abc')).toBe('"abc"');
    expect(generator.toExpressionLiteral('true')).toBe('true');
  });

  it('handles defaultSource, rule, advanced expressions and empty script fallbacks in preview payload', () => {
    targetTree[0].children[0].children.push(
      {
        id: 'target-root.data.idMediacao',
        scope: 'target',
        key: 'idMediacao',
        label: 'idMediacao',
        path: '$.data.idMediacao',
        aliasPath: 'data.idMediacao',
        displayPath: 'data.idMediacao',
        kind: 'field',
        type: 'string',
        parentId: 'target-root.data',
        expanded: true,
        manual: false,
        itemModel: false,
        children: [],
        binding: {
          mode: 'defaultSource',
          sourcePaths: [],
          aliasStrategy: 'fallback',
          separator: '',
          formatters: [],
          defaultValue: 'legacy',
          defaultSourcePath: '$.dadosApolice.idMediacao',
          advancedExpression: '',
          evalExpression: '',
          script: {
            language: 'java',
            source: '',
            returnType: 'string'
          }
        }
      },
      {
        id: 'target-root.data.modoRegra',
        scope: 'target',
        key: 'modoRegra',
        label: 'modoRegra',
        path: '$.data.modoRegra',
        aliasPath: 'data.modoRegra',
        displayPath: 'data.modoRegra',
        kind: 'field',
        type: 'string',
        parentId: 'target-root.data',
        expanded: true,
        manual: false,
        itemModel: false,
        children: [],
        binding: {
          mode: 'rule',
          sourcePaths: [],
          aliasStrategy: 'fallback',
          separator: '',
          formatters: [],
          defaultValue: '',
          defaultSourcePath: '',
          advancedExpression: '',
          evalExpression: '',
          script: {
            language: 'java',
            source: '',
            returnType: 'string'
          }
        }
      },
      {
        id: 'target-root.data.avancado',
        scope: 'target',
        key: 'avancado',
        label: 'avancado',
        path: '$.data.avancado',
        aliasPath: 'data.avancado',
        displayPath: 'data.avancado',
        kind: 'field',
        type: 'string',
        parentId: 'target-root.data',
        expanded: true,
        manual: false,
        itemModel: false,
        children: [],
        binding: {
          mode: 'unmapped',
          sourcePaths: [],
          aliasStrategy: 'fallback',
          separator: '',
          formatters: [],
          defaultValue: '',
          defaultSourcePath: '',
          advancedExpression: "dadosApolice.estado + '-ok'",
          evalExpression: '',
          script: {
            language: 'java',
            source: '',
            returnType: 'string'
          }
        }
      },
      {
        id: 'target-root.data.scriptVazio',
        scope: 'target',
        key: 'scriptVazio',
        label: 'scriptVazio',
        path: '$.data.scriptVazio',
        aliasPath: 'data.scriptVazio',
        displayPath: 'data.scriptVazio',
        kind: 'field',
        type: 'string',
        parentId: 'target-root.data',
        expanded: true,
        manual: false,
        itemModel: false,
        children: [],
        binding: {
          mode: 'script',
          sourcePaths: [],
          aliasStrategy: 'fallback',
          separator: '',
          formatters: [],
          defaultValue: '',
          defaultSourcePath: '',
          advancedExpression: '',
          evalExpression: '',
          script: {
            language: 'javascript',
            source: '',
            returnType: 'string'
          }
        }
      }
    );

    const preview = service.buildPreviewPayload(
      JSON.stringify({
        dadosApolice: {
          estado: 'SP',
          idMediacao: 'MED-01',
          itens: [{ valor: 10 }]
        }
      }),
      targetTree,
      [
        {
          id: 'rule-1',
          name: 'Regra de campo',
          matchMode: 'all',
          conditions: [],
          actions: [
            {
              id: 'action-1',
              scope: 'target',
              fieldPath: '$.data.modoRegra',
              type: 'setLiteral',
              value: 'POR_REGRA',
              sourceScope: 'source',
              sourceFieldPath: '$.dadosApolice.estado',
              expression: ''
            }
          ]
        }
      ],
      'http://json-schema.org/draft-04/schema#'
    );

    expect(preview).toContain('"idMediacao": "MED-01"');
    expect(preview).toContain('"modoRegra": "POR_REGRA"');
    expect(preview).toContain('"avancado": "SP-ok"');
    expect(preview).toContain('"scriptVazio": "[script:javascript] empty"');
  });

  it('generates schema defaults for script fallback, nullable arrays and source arrays without item model', () => {
    const scriptNode = targetTree[0].children[0].children.find((node) => node.displayPath == 'data.estadoCalculado')!;
    scriptNode.binding = {
      mode: 'script',
      sourcePaths: [],
      aliasStrategy: 'fallback',
      separator: '',
      formatters: [],
      defaultValue: '',
      defaultSourcePath: '',
      advancedExpression: '',
      evalExpression: '',
      script: undefined as unknown as NonNullable<typeof scriptNode.binding>['script']
    };
    const arrayNode = targetTree[0].children[0].children.find((node) => node.displayPath == 'data.itens')!;
    arrayNode.nullable = true;
    arrayNode.children = [];

    const targetSchema = service.generateTargetSchema(targetTree);
    const sourceSchema = service.generateSourceSchema(
      [
        {
          ...targetTree[0],
          scope: 'source',
          children: [
            {
              id: 'source-root.lista',
              scope: 'source',
              key: 'lista',
              label: 'lista',
              path: '$.lista',
              aliasPath: 'lista',
              displayPath: 'lista',
              kind: 'array',
              type: 'array',
              nullable: true,
              parentId: 'source-root',
              children: [],
              expanded: true,
              manual: false,
              itemModel: false
            }
          ]
        }
      ],
      'custom'
    );

    const data = ((targetSchema['properties'] as Record<string, unknown>)['data'] as Record<string, unknown>)['properties'] as Record<string, unknown>;
    const evalBlock = (data['estadoCalculado'] as Record<string, unknown>)['eval'] as Record<string, unknown>;
    expect(evalBlock['eval_type']).toBe('script');
    expect(evalBlock['alias']).toBe('');
    expect((data['itens'] as Record<string, unknown>)['nullable']).toBeTrue();
    expect((((sourceSchema['properties'] as Record<string, unknown>)['lista'] as Record<string, unknown>)['items'] as Record<string, unknown>)['type']).toBe('object');
  });

  it('returns fallback eval marker when expression evaluation fails', () => {
    const brokenEvalNode = targetTree[0].children[0].children.find((node) => node.displayPath == 'data.estadoCalculado')!;
    brokenEvalNode.binding!.evalExpression = 'if (';

    const preview = service.buildPreviewPayload(
      JSON.stringify({
        dadosApolice: {
          estado: 'SP',
          itens: [{ valor: 10 }]
        }
      }),
      targetTree,
      [],
      'http://json-schema.org/draft-04/schema#'
    );

    expect(preview).toContain('"estadoCalculado": "[eval] if ("');
  });

  it('returns script placeholder during preview generation', () => {
    targetTree[0].children[0].children.push({
      id: 'target-root.data.totalScript',
      scope: 'target',
      key: 'totalScript',
      label: 'totalScript',
      path: '$.data.totalScript',
      aliasPath: 'data.totalScript',
      displayPath: 'data.totalScript',
      kind: 'field',
      type: 'string',
      parentId: 'target-root.data',
      expanded: true,
      manual: false,
      itemModel: false,
      children: [],
      binding: {
        mode: 'script',
        sourcePaths: [],
        aliasStrategy: 'fallback',
        separator: '',
        formatters: [],
        defaultValue: '',
        defaultSourcePath: '',
        advancedExpression: '',
        evalExpression: '',
        script: {
          language: 'java',
          source: 'return "ok";',
          returnType: 'string'
        }
      }
    });

    const preview = service.buildPreviewPayload(
      JSON.stringify({ dadosApolice: {} }),
      targetTree,
      [],
      'http://json-schema.org/draft-04/schema#'
    );

    expect(preview).toContain('"totalScript": "[script:java] configured"');
  });

  it('collects validation errors for incomplete bindings', () => {
    targetTree[0].children[0].children.push({
      id: 'target-root.data.idMediacao',
      scope: 'target',
      key: 'idMediacao',
      label: 'idMediacao',
      path: '$.data.idMediacao',
      aliasPath: 'data.idMediacao',
      displayPath: 'data.idMediacao',
      kind: 'field',
      type: 'string',
      parentId: 'target-root.data',
      expanded: true,
      manual: false,
      itemModel: false,
      children: [],
      binding: {
        mode: 'defaultSource',
        sourcePaths: [],
        separator: '',
        formatters: [],
        defaultValue: '',
        defaultSourcePath: '',
        advancedExpression: ''
      }
    });

    expect(service.collectValidationErrors(targetTree)).toContain(
      'Campo "data.idMediacao" precisa de uma origem para default dinamico.'
    );
  });

  it('collects validation for alias, concat, eval and unmapped fields', () => {
    targetTree[0].children[0].children.push(
      {
        id: 'target-root.data.aliasVazio',
        scope: 'target',
        key: 'aliasVazio',
        label: 'aliasVazio',
        path: '$.data.aliasVazio',
        aliasPath: 'data.aliasVazio',
        displayPath: 'data.aliasVazio',
        kind: 'field',
        type: 'string',
        parentId: 'target-root.data',
        expanded: true,
        manual: false,
        itemModel: false,
        children: [],
        binding: {
          mode: 'alias',
          sourcePaths: [],
          separator: '',
          formatters: [],
          defaultValue: '',
          defaultSourcePath: '',
          advancedExpression: ''
        }
      },
      {
        id: 'target-root.data.concatVazio',
        scope: 'target',
        key: 'concatVazio',
        label: 'concatVazio',
        path: '$.data.concatVazio',
        aliasPath: 'data.concatVazio',
        displayPath: 'data.concatVazio',
        kind: 'field',
        type: 'string',
        parentId: 'target-root.data',
        expanded: true,
        manual: false,
        itemModel: false,
        children: [],
        binding: {
          mode: 'concat',
          sourcePaths: [],
          separator: '',
          formatters: [],
          defaultValue: '',
          defaultSourcePath: '',
          advancedExpression: ''
        }
      },
      {
        id: 'target-root.data.evalVazio',
        scope: 'target',
        key: 'evalVazio',
        label: 'evalVazio',
        path: '$.data.evalVazio',
        aliasPath: 'data.evalVazio',
        displayPath: 'data.evalVazio',
        kind: 'field',
        type: 'string',
        parentId: 'target-root.data',
        expanded: true,
        manual: false,
        itemModel: false,
        children: [],
        binding: {
          mode: 'eval',
          sourcePaths: [],
          aliasStrategy: 'fallback',
          separator: '',
          formatters: [],
          defaultValue: '',
          defaultSourcePath: '',
          advancedExpression: '',
          evalExpression: '   ',
          script: {
            language: 'java',
            source: '',
            returnType: 'string'
          }
        }
      },
      {
        id: 'target-root.data.unmapped',
        scope: 'target',
        key: 'unmapped',
        label: 'unmapped',
        path: '$.data.unmapped',
        aliasPath: 'data.unmapped',
        displayPath: 'data.unmapped',
        kind: 'field',
        type: 'string',
        parentId: 'target-root.data',
        expanded: true,
        manual: false,
        itemModel: false,
        children: [],
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
    );

    const errors = service.collectValidationErrors(targetTree);
    expect(errors).toContain('Campo "data.aliasVazio" precisa de uma origem para alias.');
    expect(errors).toContain('Campo "data.concatVazio" precisa de pelo menos uma origem no concat.');
    expect(errors).toContain('Campo "data.evalVazio" precisa de uma expressao eval.');
    expect(errors).toContain('Campo "data.unmapped" ainda nao foi configurado.');
  });

  it('collects validation errors for arrays without map_from source and script without source', () => {
    const itemsNode = targetTree[0].children[0].children.find((node) => node.displayPath == 'data.itens')!;
    itemsNode.mapFrom = {
      sourcePaths: [],
      aliasStrategy: 'fallback'
    };

    targetTree[0].children[0].children.push({
      id: 'target-root.data.scriptVazio',
      scope: 'target',
      key: 'scriptVazio',
      label: 'scriptVazio',
      path: '$.data.scriptVazio',
      aliasPath: 'data.scriptVazio',
      displayPath: 'data.scriptVazio',
      kind: 'field',
      type: 'string',
      parentId: 'target-root.data',
      expanded: true,
      manual: false,
      itemModel: false,
      children: [],
      binding: {
        mode: 'script',
        sourcePaths: [],
        aliasStrategy: 'fallback',
        separator: '',
        formatters: [],
        defaultValue: '',
        defaultSourcePath: '',
        advancedExpression: '',
        evalExpression: '',
        script: {
          language: 'java',
          source: '',
          returnType: 'string'
        }
      }
    });

    const errors = service.collectValidationErrors(targetTree);
    expect(errors).toContain('Array "data.itens" precisa de uma origem para map_from.');
    expect(errors).toContain('Campo "data.scriptVazio" precisa de um script configurado.');
  });

  it('converts visual rules into eval on the final field schema', () => {
    const schema = service.generateTargetSchema(
      targetTree,
      [
        {
          id: 'rule-porto',
          name: 'Marca Porto',
          matchMode: 'all',
          conditions: [
            {
              id: 'cond-1',
              scope: 'source',
              fieldPath: '$.dadosApolice.ramo',
              operator: '==',
              value: '5'
            },
            {
              id: 'cond-2',
              scope: 'source',
              fieldPath: '$.dadosApolice.codigoMarca',
              operator: '==',
              value: '1001'
            }
          ],
          actions: [
            {
              id: 'act-1',
              scope: 'target',
              fieldPath: '$.data.tip',
              type: 'setLiteral',
              value: 'Porto',
              sourceScope: 'source',
              sourceFieldPath: '$.dadosApolice.codigoMarca',
              expression: ''
            }
          ]
        }
      ]
    );

    const rootProperties = schema['properties'] as Record<string, unknown>;
    const data = ((rootProperties['data'] as Record<string, unknown>)['properties']) as Record<string, unknown>;
    const tip = data['tip'] as Record<string, unknown>;
    const evalBlock = tip['eval'] as Record<string, unknown>;

    expect(evalBlock['alias']).toContain("dadosApolice.ramo == 5");
    expect(evalBlock['alias']).toContain("dadosApolice.codigoMarca == 1001");
    expect(evalBlock['alias']).toContain('"Porto"');
  });

  it('supports fallback and whenEmpty modes for visual rule actions', () => {
    const schema = service.generateTargetSchema(
      targetTree,
      [
        {
          id: 'rule-fallback',
          name: 'Fallback visual',
          matchMode: 'all',
          conditions: [
            {
              id: 'cond-fallback',
              scope: 'source',
              fieldPath: '$.dadosApolice.codigoMarca',
              operator: '==',
              value: '1001'
            }
          ],
          actions: [
            {
              id: 'act-fallback',
              scope: 'target',
              fieldPath: '$.data.tip',
              type: 'setLiteral',
              applicationMode: 'fallback',
              value: 'Porto',
              sourceScope: 'source',
              sourceFieldPath: '$.dadosApolice.codigoMarca',
              expression: ''
            }
          ]
        },
        {
          id: 'rule-empty',
          name: 'So quando vazio',
          matchMode: 'all',
          conditions: [
            {
              id: 'cond-empty',
              scope: 'source',
              fieldPath: '$.dadosApolice.ramo',
              operator: '==',
              value: '5'
            }
          ],
          actions: [
            {
              id: 'act-empty',
              scope: 'target',
              fieldPath: '$.data.tip',
              type: 'setLiteral',
              applicationMode: 'whenEmpty',
              value: 'Reserva',
              sourceScope: 'source',
              sourceFieldPath: '$.dadosApolice.ramo',
              expression: ''
            }
          ]
        }
      ]
    );

    const rootProperties = schema['properties'] as Record<string, unknown>;
    const data = ((rootProperties['data'] as Record<string, unknown>)['properties']) as Record<string, unknown>;
    const tip = data['tip'] as Record<string, unknown>;
    const expression = (
      (tip['eval'] as Record<string, unknown> | undefined)?.['alias'] ??
      (tip['script'] as Record<string, unknown> | undefined)?.['source']
    ) as string;

    expect(expression).toContain('"Porto"');
    expect(expression).toContain('"Reserva"');
    expect(expression).toContain('== null');
  });

  it('falls back to script when a rule writes multiple actions to the same target field', () => {
    const schema = service.generateTargetSchema(
      targetTree,
      [
        {
          id: 'rule-script',
          name: 'Regra complexa',
          matchMode: 'all',
          conditions: [
            {
              id: 'cond-1',
              scope: 'source',
              fieldPath: '$.dadosApolice.ramo',
              operator: '==',
              value: '5'
            }
          ],
          actions: [
            {
              id: 'act-1',
              scope: 'target',
              fieldPath: '$.data.tip',
              type: 'setLiteral',
              value: 'Porto',
              sourceScope: 'source',
              sourceFieldPath: '$.dadosApolice.codigoMarca',
              expression: ''
            },
            {
              id: 'act-2',
              scope: 'target',
              fieldPath: '$.data.tip',
              type: 'copyField',
              value: '',
              sourceScope: 'source',
              sourceFieldPath: '$.dadosApolice.numeroApolice',
              expression: ''
            }
          ]
        }
      ]
    );

    const rootProperties = schema['properties'] as Record<string, unknown>;
    const data = ((rootProperties['data'] as Record<string, unknown>)['properties']) as Record<string, unknown>;
    const tip = data['tip'] as Record<string, unknown>;
    const evalBlock = tip['eval'] as Record<string, unknown>;

    expect(evalBlock['eval_type']).toBe('script');
    expect(String(evalBlock['alias'])).toContain('return');
  });

  it('generates arrays without map_from, numeric and boolean defaults, and default source alias path', () => {
    targetTree[0].children[0].children.push(
      {
        id: 'target-root.data.listaLivre',
        scope: 'target',
        key: 'listaLivre',
        label: 'listaLivre',
        path: '$.data.listaLivre',
        aliasPath: 'data.listaLivre',
        displayPath: 'data.listaLivre',
        kind: 'array',
        type: 'array',
        parentId: 'target-root.data',
        expanded: true,
        manual: false,
        itemModel: false,
        children: []
      },
      {
        id: 'target-root.data.numeroFixo',
        scope: 'target',
        key: 'numeroFixo',
        label: 'numeroFixo',
        path: '$.data.numeroFixo',
        aliasPath: 'data.numeroFixo',
        displayPath: 'data.numeroFixo',
        kind: 'field',
        type: 'number',
        parentId: 'target-root.data',
        expanded: true,
        manual: false,
        itemModel: false,
        children: [],
        binding: {
          mode: 'defaultLiteral',
          sourcePaths: [],
          separator: '',
          formatters: [],
          defaultValue: '42',
          defaultSourcePath: '',
          advancedExpression: ''
        }
      },
      {
        id: 'target-root.data.flagAtivo',
        scope: 'target',
        key: 'flagAtivo',
        label: 'flagAtivo',
        path: '$.data.flagAtivo',
        aliasPath: 'data.flagAtivo',
        displayPath: 'data.flagAtivo',
        kind: 'field',
        type: 'boolean',
        parentId: 'target-root.data',
        expanded: true,
        manual: false,
        itemModel: false,
        children: [],
        binding: {
          mode: 'defaultLiteral',
          sourcePaths: [],
          separator: '',
          formatters: [],
          defaultValue: 'true',
          defaultSourcePath: '',
          advancedExpression: ''
        }
      },
      {
        id: 'target-root.data.idMediacao',
        scope: 'target',
        key: 'idMediacao',
        label: 'idMediacao',
        path: '$.data.idMediacao',
        aliasPath: 'data.idMediacao',
        displayPath: 'data.idMediacao',
        kind: 'field',
        type: 'string',
        parentId: 'target-root.data',
        expanded: true,
        manual: false,
        itemModel: false,
        children: [],
        binding: {
          mode: 'defaultSource',
          sourcePaths: [],
          separator: '',
          formatters: [],
          defaultValue: '',
          defaultSourcePath: '$.dadosApolice.idMediacao',
          advancedExpression: ''
        }
      }
    );

    const schema = service.generateTargetSchema(targetTree);
    const data = (((schema['properties'] as Record<string, unknown>)['data'] as Record<string, unknown>)['properties']) as Record<string, unknown>;
    expect((data['listaLivre'] as Record<string, unknown>)['items']).toEqual({ type: 'object', properties: {} });
    expect((data['numeroFixo'] as Record<string, unknown>)['default']).toBe(42);
    expect((data['flagAtivo'] as Record<string, unknown>)['default']).toBeTrue();
    expect((data['idMediacao'] as Record<string, unknown>)['default']).toBe('dadosApolice.idMediacao');
  });

  it('supports setExpression actions and target scoped references in synthesized rules', () => {
    const schema = service.generateTargetSchema(
      targetTree,
      [
        {
          id: 'rule-expr',
          name: 'Expressao alvo',
          matchMode: 'all',
          conditions: [
            {
              id: 'cond-1',
              scope: 'target',
              fieldPath: '$.data.tip',
              operator: '!=',
              value: 'null'
            }
          ],
          actions: [
            {
              id: 'act-1',
              scope: 'target',
              fieldPath: '$.data.tip',
              type: 'setExpression',
              value: '',
              sourceScope: 'source',
              sourceFieldPath: '',
              expression: "target.data.tip + '-ajustado'"
            }
          ]
        }
      ]
    );

    const data = (((schema['properties'] as Record<string, unknown>)['data'] as Record<string, unknown>)['properties']) as Record<string, unknown>;
    const tip = data['tip'] as Record<string, unknown>;
    const evalBlock = tip['eval'] as Record<string, unknown>;
    expect(evalBlock['alias']).toContain('target.data.tip');
    expect(evalBlock['alias']).toContain("'-ajustado'");
  });

  it('adds eval_type script when visual rules synthesize a code-like eval expression', () => {
    const schema = service.generateTargetSchema(
      targetTree,
      [
        {
          id: 'rule-python-like',
          name: 'Python-like expression',
          matchMode: 'all',
          conditions: [
            {
              id: 'cond-1',
              scope: 'source',
              fieldPath: '$.dadosApolice.codigoMarca',
              operator: '==',
              value: '1001'
            }
          ],
          actions: [
            {
              id: 'act-1',
              scope: 'target',
              fieldPath: '$.data.tip',
              type: 'setExpression',
              value: '',
              sourceScope: 'source',
              sourceFieldPath: '',
              expression: 'resultado = "Porto" if dadosApolice.codigoMarca == 1001 else "Nao identificado"\nreturn resultado'
            }
          ]
        }
      ]
    );

    const data = (((schema['properties'] as Record<string, unknown>)['data'] as Record<string, unknown>)['properties']) as Record<string, unknown>;
    const tip = data['tip'] as Record<string, unknown>;
    const evalBlock = tip['eval'] as Record<string, unknown>;

    expect(evalBlock['alias']).toContain('resultado = "Porto"');
    expect(evalBlock['eval_type']).toBe('script');
  });

  it('supports any-match rule conditions and copyField actions', () => {
    const schema = service.generateTargetSchema(
      targetTree,
      [
        {
          id: 'rule-any',
          name: 'Regra any',
          matchMode: 'any',
          conditions: [
            {
              id: 'cond-1',
              scope: 'source',
              fieldPath: '$.dadosApolice.ramo',
              operator: 'contains',
              value: '5'
            },
            {
              id: 'cond-2',
              scope: 'source',
              fieldPath: '$.dadosApolice.codigoMarca',
              operator: 'exists',
              value: ''
            }
          ],
          actions: [
            {
              id: 'act-1',
              scope: 'target',
              fieldPath: '$.data.tip',
              type: 'copyField',
              value: '',
              sourceScope: 'source',
              sourceFieldPath: '$.dadosApolice.marca',
              expression: ''
            }
          ]
        }
      ]
    );

    const rootProperties = schema['properties'] as Record<string, unknown>;
    const data = ((rootProperties['data'] as Record<string, unknown>)['properties']) as Record<string, unknown>;
    const tip = data['tip'] as Record<string, unknown>;
    const evalBlock = tip['eval'] as Record<string, unknown>;

    expect(evalBlock['alias']).toContain('||');
    expect(evalBlock['alias']).toContain("String(dadosApolice.ramo ?? '').includes(5)");
    expect(evalBlock['alias']).toContain("dadosApolice.codigoMarca != null");
    expect(evalBlock['alias']).toContain('dadosApolice.marca');
  });

  it('keeps alias fallback chain and concat formatter details in synthesized expressions', () => {
    targetTree[0].children[0].children.push({
      id: 'target-root.data.aliasFallback',
      scope: 'target',
      key: 'aliasFallback',
      label: 'aliasFallback',
      path: '$.data.aliasFallback',
      aliasPath: 'data.aliasFallback',
      displayPath: 'data.aliasFallback',
      kind: 'field',
      type: 'string',
      parentId: 'target-root.data',
      expanded: true,
      manual: false,
      itemModel: false,
      children: [],
      binding: {
        mode: 'alias',
        sourcePaths: ['$.dadosApolice.codigoSucursal', '$.dadosApolice.numeroApolice'],
        aliasStrategy: 'fallback',
        separator: '',
        formatters: [],
        defaultValue: '',
        defaultSourcePath: '',
        advancedExpression: ''
      }
    });

    const schema = service.generateTargetSchema(
      targetTree,
      [
        {
          id: 'rule-fallback',
          name: 'Com fallback',
          matchMode: 'all',
          conditions: [],
          actions: [
            {
              id: 'act-fallback',
              scope: 'target',
              fieldPath: '$.data.aliasFallback',
              type: 'setLiteral',
              value: 'valor',
              sourceScope: 'source',
              sourceFieldPath: '',
              expression: ''
            }
          ]
        }
      ]
    );

    const rootProperties = schema['properties'] as Record<string, unknown>;
    const data = ((rootProperties['data'] as Record<string, unknown>)['properties']) as Record<string, unknown>;
    const aliasFallback = data['aliasFallback'] as Record<string, unknown>;
    const evalBlock = aliasFallback['eval'] as Record<string, unknown>;

    expect(evalBlock['alias']).toContain('??');
    expect(evalBlock['alias']).toContain('"valor"');
  });

  it('generates and previews deeply nested map_from arrays across multiple target branches', () => {
    const sourceSchema = {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'object',
      properties: {
        apolice: {
          type: 'object',
          properties: {
            produtor: {
              type: 'object',
              properties: {
                cnpj: { type: 'string' }
              }
            },
            pacotes: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  codigoPacote: { type: 'string' },
                  itens: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        codigoItem: { type: 'string' },
                        coberturas: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              codigoCobertura: { type: 'string' },
                              valor: { type: 'number' }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    };

    const targetSchema = {
      $schema: 'http://json-schema.org/draft-04/schema#',
      type: 'object',
      properties: {
        data: {
          type: 'object',
          properties: {
            pacotes: {
              type: 'array',
              map_from: {
                alias: ['apolice.pacotes']
              },
              items: {
                type: 'object',
                properties: {
                  pacoteId: {
                    type: 'string',
                    alias: ['codigoPacote']
                  },
                  itens: {
                    type: 'array',
                    map_from: {
                      alias: ['itens']
                    },
                    items: {
                      type: 'object',
                      properties: {
                        itemId: {
                          type: 'string',
                          alias: ['codigoItem']
                        },
                        coberturas: {
                          type: 'array',
                          map_from: {
                            alias: ['coberturas']
                          },
                          items: {
                            type: 'object',
                            properties: {
                              coberturaId: {
                                type: 'string',
                                alias: ['codigoCobertura']
                              },
                              valorCobertura: {
                                type: 'number',
                                alias: ['valor']
                              },
                              produtorCnpj: {
                                type: 'string',
                                alias: ['apolice.produtor.cnpj']
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            },
            pacotesResumo: {
              type: 'array',
              map_from: {
                alias: ['apolice.pacotes']
              },
              items: {
                type: 'object',
                properties: {
                  codigo: {
                    type: 'string',
                    alias: ['codigoPacote']
                  },
                  itensResumo: {
                    type: 'array',
                    map_from: {
                      alias: ['itens']
                    },
                    items: {
                      type: 'object',
                      properties: {
                        codigo: {
                          type: 'string',
                          alias: ['codigoItem']
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    };

    const importedTargetTree = schemaImport.importTargetTree(targetSchema);
    const generatedSchema = service.generateTargetSchema(importedTargetTree);
    const data = (((generatedSchema['properties'] as Record<string, unknown>)['data'] as Record<string, unknown>)['properties']) as Record<string, unknown>;
    const pacotes = data['pacotes'] as Record<string, unknown>;
    const pacotesResumo = data['pacotesResumo'] as Record<string, unknown>;

    expect(((pacotes['map_from'] as Record<string, unknown>)['alias']) as string[]).toEqual(['apolice.pacotes']);
    expect(((((pacotes['map_from'] as Record<string, unknown>)['items'] as Record<string, unknown>)['properties'] as Record<string, unknown>)['itens'] as Record<string, unknown>)['map_from']).toEqual({
      alias: ['itens'],
      items: jasmine.any(Object)
    });
    expect(((((((((pacotes['map_from'] as Record<string, unknown>)['items'] as Record<string, unknown>)['properties'] as Record<string, unknown>)['itens'] as Record<string, unknown>)['map_from'] as Record<string, unknown>)['items'] as Record<string, unknown>)['properties'] as Record<string, unknown>)['coberturas'] as Record<string, unknown>)['map_from']).toEqual({
      alias: ['coberturas'],
      items: jasmine.any(Object)
    });
    expect(((pacotesResumo['map_from'] as Record<string, unknown>)['alias']) as string[]).toEqual(['apolice.pacotes']);

    const preview = service.buildPreviewPayload(
      JSON.stringify({
        apolice: {
          produtor: {
            cnpj: '61199164000160'
          },
          pacotes: [
            {
              codigoPacote: 'PKG-01',
              itens: [
                {
                  codigoItem: 'ITEM-01',
                  coberturas: [
                    {
                      codigoCobertura: 'COB-01',
                      valor: 10
                    },
                    {
                      codigoCobertura: 'COB-02',
                      valor: 20
                    }
                  ]
                }
              ]
            },
            {
              codigoPacote: 'PKG-02',
              itens: [
                {
                  codigoItem: 'ITEM-02',
                  coberturas: [
                    {
                      codigoCobertura: 'COB-03',
                      valor: 30
                    }
                  ]
                }
              ]
            }
          ]
        }
      }),
      importedTargetTree,
      [],
      'http://json-schema.org/draft-04/schema#'
    );

    expect(preview).toContain('"pacoteId": "PKG-01"');
    expect(preview).toContain('"itemId": "ITEM-01"');
    expect(preview).toContain('"coberturaId": "COB-01"');
    expect(preview).toContain('"valorCobertura": 20');
    expect(preview).toContain('"produtorCnpj": "61199164000160"');
    expect(preview).toContain('"codigo": "PKG-02"');
    expect(preview).toContain('"codigo": "ITEM-02"');
  });
});
