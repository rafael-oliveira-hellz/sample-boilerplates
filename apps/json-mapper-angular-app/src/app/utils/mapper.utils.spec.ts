import {
    buildFieldsFromJson,
    createField,
    deepClone,
    evaluateExpression,
    getValueByPath,
    looksLikeTargetSchema,
    normalizePayloadForExecution,
    rankSuggestedSources,
    safeJsonParse,
    setValueByPath,
    toAlias,
    toXPath
} from './mapper.utils';

describe('mapper utils', () => {
  it('should parse json safely', () => {
    expect(safeJsonParse('{"ok":true}')).toEqual({ ok: true });
  });

  it('should keep current value when expression is blank', () => {
    expect(
      evaluateExpression('   ', {
        source: {},
        target: {},
        currentValue: 'valor-atual',
        currentSourcePath: '$.origem',
        currentTargetPath: '$.destino'
      })
    ).toBe('valor-atual');
  });

  it('should derive xpath and alias', () => {
    expect(toXPath('$.dadosApolice.numeroApolice')).toBe('/dadosApolice/numeroApolice');
    expect(toAlias('$.dadosApolice.numeroApolice')).toBe('numeroApolice');
    expect(toAlias('')).toBe('field');
  });

  it('should create field with metadata', () => {
    const field = createField('source', '$.numero', 'integer', true, 'json-schema', { format: 'date' });
    expect(field.mode).toBe('json-schema');
    expect(field.metadata).toEqual({ format: 'date' });
  });

  it('should build fields from payload', () => {
    const fields = buildFieldsFromJson(
      {
        dadosApolice: {
          numeroApolice: 10,
          descontos: [{ valorDesconto: 12.5 }]
        }
      },
      'source'
    );

    expect(fields.map((field) => field.path)).toContain('$.dadosApolice.numeroApolice');
    expect(fields.map((field) => field.path)).toContain('$.dadosApolice.descontos[0].valorDesconto');
  });

  it('should build fields from source json schema', () => {
    const fields = buildFieldsFromJson(
      {
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        type: 'object',
        properties: {
          dadosApolice: {
            type: 'object',
            properties: {
              numeroApolice: { type: 'integer' },
              descontos: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    valorDesconto: { type: 'number' }
                  }
                }
              }
            }
          }
        }
      },
      'source'
    );

    const numero = fields.find((field) => field.path == '$.dadosApolice.numeroApolice');
    const desconto = fields.find((field) => field.path == '$.dadosApolice.descontos[0].valorDesconto');

    expect(numero?.mode).toBe('json-schema');
    expect(numero?.type).toBe('integer');
    expect(desconto?.type).toBe('number');
  });

  it('should build fields from target schema with metadata', () => {
    const fields = buildFieldsFromJson(
      {
        type: 'object',
        properties: {
          data: {
            type: 'object',
            properties: {
              contrato: {
                type: 'object',
                properties: {
                  numero: {
                    type: 'string',
                    concat: {
                      alias: [
                        'dadosApolice.codigoSucursal',
                        'dadosApolice.ramo'
                      ]
                    }
                  }
                }
              }
            }
          }
        }
      },
      'target'
    );

    const field = fields.find((item) => item.path == '$.data.contrato.numero');
    expect(field?.mode).toBe('target-schema');
    expect(field?.metadata?.['concat']).toEqual({
      alias: ['dadosApolice.codigoSucursal', 'dadosApolice.ramo']
    });
  });

  it('should normalize payload from source schema and target schema', () => {
    const sourcePayload = normalizePayloadForExecution(
      {
        type: 'object',
        properties: {
          dadosApolice: {
            type: 'object',
            properties: {
              numeroApolice: { type: 'integer' }
            }
          }
        }
      },
      'source'
    ) as Record<string, unknown>;

    const targetPayload = normalizePayloadForExecution(
      {
        type: 'object',
        properties: {
          proposta: {
            type: 'object',
            properties: {
              idMediacao: {
                type: 'string',
                default: 'dadosApolice.idMediacao'
              },
              tipo: {
                type: 'string',
                default: 'Apolice'
              }
            }
          }
        }
      },
      'target'
    ) as Record<string, unknown>;

    expect((sourcePayload['dadosApolice'] as Record<string, unknown>)['numeroApolice']).toBeNull();
    expect((targetPayload['proposta'] as Record<string, unknown>)['idMediacao']).toBe('');
    expect((targetPayload['proposta'] as Record<string, unknown>)['tipo']).toBe('Apolice');
  });

  it('should normalize raw payloads and clone values', () => {
    const original = { codigo: 1, lista: [{ id: 1 }] };
    const normalized = normalizePayloadForExecution(original, 'source') as Record<string, unknown>;
    const cloned = deepClone(original);

    (normalized['lista'] as Array<Record<string, unknown>>)[0]['id'] = 99;

    expect((original.lista[0] as Record<string, unknown>)['id']).toBe(1);
    expect(cloned).toEqual(original);
  });

  it('should normalize null payloads to empty objects', () => {
    expect(normalizePayloadForExecution(null, 'source')).toEqual({});
  });

  it('should read and write values by path including arrays', () => {
    const payload = { descontos: [{ valor: 1 }] };

    expect(getValueByPath(payload, '$')).toBe(payload);
    expect(getValueByPath(payload, '$.descontos[0].valor')).toBe(1);
    setValueByPath(payload, '$.descontos[0].valor', 99);
    setValueByPath(payload, '$.dadosApolice.numeroApolice', 123);

    expect(getValueByPath(payload, '$.descontos[0].valor')).toBe(99);
    expect(getValueByPath(payload, '$.dadosApolice.numeroApolice')).toBe(123);
  });

  it('should create arrays and objects while writing nested paths', () => {
    const payload = { itens: [] as Array<unknown> };
    setValueByPath(payload, '$.itens[0].veiculo.placa', 'ABC1234');
    expect(getValueByPath(payload, '$.itens[0].veiculo.placa')).toBe('ABC1234');
  });

  it('should replace incompatible nested structures while writing paths', () => {
    const payload = { itens: '' as unknown, lista: ['x'] as unknown[] };

    setValueByPath(payload, '$.itens[0].codigo', 10);
    setValueByPath(payload, '$.lista[0][1]', 'novo');

    expect(getValueByPath(payload, '$.itens[0].codigo')).toBe(10);
    expect(getValueByPath(payload, '$.lista[0][1]')).toBe('novo');
  });

  it('should ignore invalid writes and missing array reads', () => {
    const payload = { objeto: {} };

    expect(getValueByPath(payload, '$.objeto[0]')).toBeUndefined();
    expect(getValueByPath(payload, '$.')).toEqual(payload);
    setValueByPath(payload, '$.objeto[0].codigo', 1);
    setValueByPath(null, '$.teste', 1);
    setValueByPath(payload, '$', 1);

    expect(payload).toEqual({ objeto: { codigo: 1 } });
  });

  it('should evaluate expressions with helpers', () => {
    const result = evaluateExpression("concat(padLeft(src('$.codigo'), 3, '0'), '-', upper(value))", {
      source: { codigo: 7 },
      target: {},
      currentValue: 'porto',
      currentSourcePath: '$.marca',
      currentTargetPath: '$.seguro.marcaDescricao'
    });

    expect(result).toBe('007-PORTO');
  });

  it('should evaluate expressions with additional helpers and alias paths', () => {
    const result = evaluateExpression(
      "concat(padRight(trim(value), 5), '|', lower(out('saida.nome')), '|', toString(sum(1,2,3)), '|', toString(divide(10, 2)))",
      {
        source: {},
        target: { saida: { nome: 'PORTO' } },
        currentValue: ' A ',
        currentSourcePath: '$.origem',
        currentTargetPath: '$.saida'
      }
    );

    expect(result).toBe('A0000|porto|6|5');
  });

  it('should evaluate expressions with remaining helper branches', () => {
    const result = evaluateExpression(
      "concat(coalesce('', null, 'fallback'), '|', replace(src('codigo'), '-', ''), '|', substring('abcdef', 1, 4), '|', toString(multiply(2, 3, 4)), '|', upper(), '|', concat(), '|', padLeft(null, 3), '|', path.source, '|', path.target)",
      {
        source: { codigo: '12-34' },
        target: {},
        currentValue: null,
        currentSourcePath: '$.origem.codigo',
        currentTargetPath: '$.destino.codigo'
      }
    ) as string;

    const [coalesced, replaced, sliced, multiplied, uppered, concatenated, padded, sourcePath, targetPath] =
      result.split('|');

    expect(coalesced).toBe('fallback');
    expect(replaced).toBe('1234');
    expect(sliced).toBe('bcd');
    expect(multiplied).toBe('24');
    expect(uppered).toBe('');
    expect(concatenated).toBe('');
    expect(padded).toBe('000');
    expect(sourcePath).toBe('$.origem.codigo');
    expect(targetPath).toBe('$.destino.codigo');
  });

  it('should evaluate expression helpers with nullish defaults and current date', () => {
    const result = evaluateExpression(
      "concat(lower(), '|', trim(), '|', substring(null, 0, 2), '|', toString(), '|', toString(sum(1, null, 2)), '|', toString(multiply(2, null, 3)), '|', toString(divide(null, undefined)), '|', padRight(null, 2), '|', today())",
      {
        source: {},
        target: {},
        currentValue: null,
        currentSourcePath: '$.origem',
        currentTargetPath: '$.destino'
      }
    ) as string;

    const [lowered, trimmed, sliced, stringified, summed, multiplied, divided, padded, isoDate] =
      result.split('|');

    expect(lowered).toBe('');
    expect(trimmed).toBe('');
    expect(sliced).toBe('');
    expect(stringified).toBe('');
    expect(summed).toBe('3');
    expect(multiplied).toBe('6');
    expect(divided).toBe('0');
    expect(padded).toBe('00');
    expect(Number.isNaN(Date.parse(isoDate))).toBeFalse();
  });

  it('should evaluate concat with null items', () => {
    const result = evaluateExpression("concat(null, 'A', undefined)", {
      source: {},
      target: {},
      currentValue: null,
      currentSourcePath: '$.origem',
      currentTargetPath: '$.destino'
    });

    expect(result).toBe('A');
  });

  it('should evaluate expressions with root variables and relative item variables', () => {
    const result = evaluateExpression(
      "concat(apolice.estado, '|', valor == 10 ? 'OK' : 'NOK')",
      {
        source: { apolice: { estado: 'SP' } },
        target: {},
        currentValue: { valor: 10 },
        currentSourcePath: '$.apolice.itens[0]',
        currentTargetPath: '$.data.itens[0]'
      }
    );

    expect(result).toBe('SP|OK');
  });

  it('should evaluate expression blocks with return statements', () => {
    const result = evaluateExpression(
      "var total = 0; for (const item of coberturas) { total += Number(item.valor ?? 0); } return total;",
      {
        source: {},
        target: {},
        currentValue: {
          coberturas: [{ valor: 5 }, { valor: 7 }]
        },
        currentSourcePath: '$.itens[0]',
        currentTargetPath: '$.data.itens[0].total'
      }
    );

    expect(result).toBe(12);
  });

  it('should infer schema type fallbacks and target concat placeholders', () => {
    const payload = normalizePayloadForExecution(
      {
        properties: {
          data: {
            properties: {
              documento: {
                concat: {
                  alias: ['dadosApolice.codigoSucursal', 'dadosApolice.ramo']
                }
              }
            }
          }
        }
      },
      'target'
    ) as Record<string, unknown>;

    expect(((payload['data'] as Record<string, unknown>)['documento'])).toBe('');
  });

  it('should keep target schemas without alias metadata as json-schema mode', () => {
    const fields = buildFieldsFromJson(
      {
        type: 'object',
        properties: {
          proposta: {
            type: 'object',
            properties: {
              id: {
                type: ['string', 'null'],
                description: 'identificador'
              }
            }
          }
        }
      },
      'target'
    );

    const field = fields.find((item) => item.path == '$.proposta.id');
    expect(field?.mode).toBe('json-schema');
    expect(field?.type).toBe('string');
    expect(field?.metadata?.['description']).toBe('identificador');
  });

  it('should preserve alias and format metadata from schema nodes', () => {
    const fields = buildFieldsFromJson(
      {
        type: 'object',
        properties: {
          cep: {
            type: 'string',
            alias: ['dadosApolice.endereco.cep'],
            format: [{ pad: 'left', length: 5, char: '0' }]
          }
        }
      },
      'target'
    );

    const field = fields.find((item) => item.path == '$.cep');
    expect(field?.metadata?.['alias']).toEqual(['dadosApolice.endereco.cep']);
    expect(field?.metadata?.['format']).toEqual([{ pad: 'left', length: 5, char: '0' }]);
  });

  it('should keep target mode as json-schema when no alias-like metadata exists anywhere', () => {
    const fields = buildFieldsFromJson(
      {
        type: 'object',
        properties: {
          proposta: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                description: 'sem alias'
              }
            }
          }
        }
      },
      'target'
    );

    expect(fields.every((field) => field.mode == 'json-schema')).toBeTrue();
  });

  it('should keep plain target schemas without alias or concat as json-schema mode', () => {
    const fields = buildFieldsFromJson(
      {
        type: 'object',
        properties: {
          codigo: {
            type: 'string'
          }
        }
      },
      'target'
    );

    expect(fields.find((field) => field.path == '$.codigo')?.mode).toBe('json-schema');
  });

  it('should reject non-object target schema candidates', () => {
    expect(looksLikeTargetSchema(null)).toBeFalse();
    expect(looksLikeTargetSchema([])).toBeFalse();
    expect(looksLikeTargetSchema('texto')).toBeFalse();
  });

  it('should build schema children even when child nodes are null', () => {
    const fields = buildFieldsFromJson(
      {
        type: 'object',
        properties: {
          contrato: null
        }
      },
      'target'
    );

    const field = fields.find((item) => item.path == '$.contrato');
    expect(field?.type).toBe('object');
  });

  it('should normalize array schemas and fallback schema types', () => {
    const sourcePayload = normalizePayloadForExecution(
      {
        items: {
          type: 'boolean'
        }
      },
      'source'
    ) as unknown;

    const targetPayload = normalizePayloadForExecution(
      {
        type: 'object',
        properties: {
          vazio: { type: [] },
          dinamico: { items: {} },
          desconhecido: { type: 'custom' }
        }
      },
      'target'
    ) as Record<string, unknown>;

    expect(sourcePayload).toEqual([false]);
    expect(targetPayload['vazio']).toEqual({});
    expect(targetPayload['dinamico']).toEqual([{}]);
    expect(targetPayload['desconhecido']).toBeNull();
  });

  it('should rank source suggestions by key and type similarity', () => {
    const ranked = rankSuggestedSources(
      {
        id: 'target-1',
        scope: 'target',
        key: 'numeroApolice',
        label: 'numeroApolice',
        path: '$.data.contrato.numeroApolice',
        aliasPath: 'data.contrato.numeroApolice',
        displayPath: 'data.contrato.numeroApolice',
        kind: 'field',
        type: 'integer',
        parentId: 'root',
        children: [],
        expanded: true,
        manual: false,
        itemModel: false
      },
      [
        {
          id: 'src-1',
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
        },
        {
          id: 'src-2',
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
        }
      ]
    );

    expect(ranked[0].source.displayPath).toBe('dadosApolice.numeroApolice');
    expect(ranked[0].score).toBeGreaterThan(ranked[1].score);
  });
});
