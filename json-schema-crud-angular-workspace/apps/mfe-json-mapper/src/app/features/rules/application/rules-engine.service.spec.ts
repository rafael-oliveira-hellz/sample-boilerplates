import { TestBed } from '@angular/core/testing';
import { MappingRule } from '../../../core/models';
import { RulesEngineService } from './rules-engine.service';

describe('RulesEngineService', () => {
  let service: RulesEngineService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(RulesEngineService);
  });

  it('evaluates supported operators', () => {
    const source = { ramo: 5, marca: '1001', nome: 'Porto Seguro', ativo: true };

    expect(service.evaluateCondition({ id: '1', scope: 'source', fieldPath: '$.ramo', operator: '==', value: '5' }, source, {})).toBeTrue();
    expect(service.evaluateCondition({ id: '2', scope: 'source', fieldPath: '$.ramo', operator: '>=', value: '4' }, source, {})).toBeTrue();
    expect(service.evaluateCondition({ id: '3', scope: 'source', fieldPath: '$.nome', operator: 'contains', value: 'Porto' }, source, {})).toBeTrue();
    expect(service.evaluateCondition({ id: '4', scope: 'source', fieldPath: '$.ativo', operator: 'exists', value: '' }, source, {})).toBeTrue();
    expect(service.evaluateCondition({ id: '5', scope: 'source', fieldPath: '$.ramo', operator: '!=', value: '7' }, source, {})).toBeTrue();
    expect(service.evaluateCondition({ id: '6', scope: 'source', fieldPath: '$.ramo', operator: '<', value: '10' }, source, {})).toBeTrue();
    expect(service.evaluateCondition({ id: '7', scope: 'source', fieldPath: '$.ramo', operator: '<=', value: '5' }, source, {})).toBeTrue();
    expect(service.evaluateCondition({ id: '8', scope: 'source', fieldPath: '$.ramo', operator: 'unknown' as never, value: '5' }, source, {})).toBeFalse();
  });

  it('applies rules with all/any matching and all action types', () => {
    const source = { ramo: 5, marca: 1001, nome: 'Porto' };
    const target: Record<string, unknown> = { data: { estado: '', sigla: '', nome: '' } };
    const rules: MappingRule[] = [
      {
        id: 'rule-1',
        name: 'all',
        matchMode: 'all',
        conditions: [
          { id: 'c1', scope: 'source', fieldPath: '$.ramo', operator: '==', value: '5' },
          { id: 'c2', scope: 'source', fieldPath: '$.marca', operator: '==', value: '1001' }
        ],
        actions: [
          {
            id: 'a1',
            scope: 'target',
            fieldPath: '$.data.estado',
            type: 'setLiteral',
            value: 'SP',
            sourceScope: 'source',
            sourceFieldPath: '',
            expression: ''
          },
          {
            id: 'a2',
            scope: 'target',
            fieldPath: '$.data.sigla',
            type: 'copyField',
            value: '',
            sourceScope: 'source',
            sourceFieldPath: '$.nome',
            expression: ''
          }
        ]
      },
      {
        id: 'rule-2',
        name: 'any',
        matchMode: 'any',
        conditions: [{ id: 'c3', scope: 'source', fieldPath: '$.marca', operator: '==', value: '1001' }],
        actions: [
          {
            id: 'a3',
            scope: 'target',
            fieldPath: '$.data.nome',
            type: 'setExpression',
            value: '',
            sourceScope: 'source',
            sourceFieldPath: '',
            expression: "upper(src('$.nome'))"
          }
        ]
      }
    ];

    service.applyRules(rules, source, target);

    expect((target['data'] as Record<string, unknown>)['estado']).toBe('SP');
    expect((target['data'] as Record<string, unknown>)['sigla']).toBe('Porto');
    expect((target['data'] as Record<string, unknown>)['nome']).toBe('PORTO');
  });

  it('parses literal values', () => {
    expect(service.parseValue('')).toBe('');
    expect(service.parseValue('true')).toBeTrue();
    expect(service.parseValue('false')).toBeFalse();
    expect(service.parseValue('null')).toBeNull();
    expect(service.parseValue('42')).toBe(42);
    expect(service.parseValue('Porto')).toBe('Porto');
  });
});



