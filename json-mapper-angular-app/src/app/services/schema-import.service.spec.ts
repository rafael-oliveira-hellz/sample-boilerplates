import { TestBed } from '@angular/core/testing';
import { SchemaImportService } from './schema-import.service';

describe('SchemaImportService', () => {
  let service: SchemaImportService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SchemaImportService);
  });

  it('parses valid json text and extracts schema uri', () => {
    const parsed = service.parseJsonText('{"$schema":"x","type":"object"}');

    expect(parsed.schemaUri).toBe('x');
    expect(parsed.raw['type']).toBe('object');
  });

  it('rejects non-object roots', () => {
    expect(() => service.parseJsonText('[]')).toThrowError('O JSON precisa ter um objeto na raiz.');
  });

  it('imports source trees from schema and array payloads', () => {
    const nodes = service.importSourceTree({
      type: 'object',
      properties: {
        descontos: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              codigoDesconto: { type: 'integer' }
            }
          }
        }
      }
    });
    const payloadNodes = service.importSourceTree({
      descontos: [{ codigoDesconto: 10 }]
    });

    expect(nodes[0].children[0].kind).toBe('array');
    expect(nodes[0].children[0].children[0].itemModel).toBeTrue();
    expect(payloadNodes[0].children[0].children[0].displayPath).toContain('[item]');
  });

  it('imports target bindings from declarative schema', () => {
    const nodes = service.importTargetTree({
      type: 'object',
      properties: {
        data: {
          type: 'object',
          properties: {
            estado: {
              type: 'string',
              alias: ['dadosApolice.uf']
            },
            cep: {
              type: 'string',
              concat: {
                alias: ['dadosApolice.cep', 'dadosApolice.complemento'],
                separator: '-',
                format: [{ pad: 'left', length: 5, char: '0' }]
              }
            },
            tip: {
              type: 'string',
              default: 'APOLICE'
            },
            idMediacao: {
              type: 'string',
              default: 'dadosApolice.idMediacao'
            },
            estadoCalculado: {
              type: 'string',
              eval: {
                alias: 'var total = 0; return total;',
                eval_type: 'script'
              }
            },
            scriptado: {
              type: 'script',
              script: {
                language: 'java',
                source: 'return "ok";',
                returnType: 'string'
              }
            },
            itens: {
              type: 'array',
              map_from: {
                alias: ['dadosApolice.itens']
              },
              items: {
                type: 'object',
                properties: {
                  valor: {
                    type: 'number',
                    alias: ['valor']
                  }
                }
              }
            }
          }
        }
      }
    });
    const leaves = service.flattenLeafNodes(nodes);

    expect(leaves.find((node) => node.displayPath == 'data.estado')?.binding?.mode).toBe('alias');
    expect(leaves.find((node) => node.displayPath == 'data.cep')?.binding?.mode).toBe('concat');
    expect(leaves.find((node) => node.displayPath == 'data.tip')?.binding?.mode).toBe('defaultLiteral');
    expect(leaves.find((node) => node.displayPath == 'data.idMediacao')?.binding?.mode).toBe('defaultSource');
    expect(leaves.find((node) => node.displayPath == 'data.estadoCalculado')?.binding?.mode).toBe('eval');
    expect(leaves.find((node) => node.displayPath == 'data.estadoCalculado')?.binding?.evalType).toBe('script');
    expect(leaves.find((node) => node.displayPath == 'data.scriptado')?.binding?.mode).toBe('script');
    expect(nodes[0].children[0].children.find((node) => node.displayPath == 'data.itens')?.mapFrom?.sourcePaths).toEqual([
      '$.dadosApolice.itens'
    ]);
  });

  it('flattens fields and normalizes paths', () => {
    const nodes = service.importSourceTree({
      type: 'object',
      properties: {
        itens: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              codigo: { type: 'integer' }
            }
          }
        }
      }
    });

    const fields = service.flattenFields(nodes, 'source');

    expect(fields.some((field) => field.path == '$.itens[0].codigo')).toBeTrue();
    expect(service.normalizeSourcePath('itens[item].codigo')).toBe('$.itens[0].codigo');
    expect(service.toSchemaAliasPath('$.itens[0].codigo')).toBe('itens.codigo');
  });

  it('preserves descriptions, nullable flags and target-specific metadata while importing', () => {
    const sourceNodes = service.importSourceTree({
      type: ['object', 'null'],
      description: 'Origem raiz',
      properties: {
        itens: {
          type: 'array',
          nullable: true,
          description: 'Lista de itens',
          items: {
            type: 'object',
            properties: {
              codigo: {
                type: ['string', 'null'],
                description: 'Codigo do item'
              }
            }
          }
        }
      }
    });
    const targetNodes = service.importTargetTree({
      type: 'object',
      properties: {
        scriptado: {
          type: 'script',
          description: 'Campo com script',
          script: {
            language: 'javascript',
            source: 'return 1;',
            resultType: 'number'
          }
        },
        cep: {
          type: 'string',
          concat: {
            alias: ['dados.cep', 'dados.sufixo'],
            format: [{ pad: 'right' }]
          }
        }
      }
    });

    const sourceItem = sourceNodes[0].children[0];
    const sourceField = sourceItem.children[0].children[0];
    const targetScript = service.flattenLeafNodes(targetNodes).find((node) => node.displayPath == 'scriptado');
    const targetConcat = service.flattenLeafNodes(targetNodes).find((node) => node.displayPath == 'cep');
    const targetFields = service.flattenFields(targetNodes, 'target');

    expect(sourceNodes[0].nullable).toBeTrue();
    expect(sourceItem.nullable).toBeTrue();
    expect(sourceField.nullable).toBeTrue();
    expect(sourceField.description).toBe('Codigo do item');
    expect(targetScript?.binding?.script).toEqual(
      jasmine.objectContaining({
        language: 'javascript',
        source: 'return 1;',
        returnType: 'number'
      })
    );
    expect(targetConcat?.binding?.formatters[0]).toEqual(
      jasmine.objectContaining({
        pad: 'right',
        length: 0,
        char: '0'
      })
    );
    expect(targetFields[0].mode).toBe('target-schema');
  });

  it('normalizes already-rooted paths and imports array payloads with empty first item fallback', () => {
    const payloadNodes = service.importTargetTree({
      itens: []
    });

    expect(service.normalizeSourcePath('$.itens[item].codigo')).toBe('$.itens[0].codigo');
    expect(payloadNodes[0].children[0].children[0].displayPath).toBe('itens[item]');
  });
});
