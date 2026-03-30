import { importSourceTree, importTargetTree } from '../schema/schemaImport';
import { setEvalExpression, setScriptBinding } from '../workbench/workbenchState';
import { buildPersistenceDocument, collectValidationErrors } from './schemaPreview';
import { createRule, updateAction, updateCondition } from '../rules/rulesState';

describe('schemaPreview', () => {
  it('gera eval_type script para eval inline com código', () => {
    const sourceTree = importSourceTree({
      type: 'object',
      properties: {
        dadosApolice: {
          type: 'object',
          properties: {
            codigoMarca: { type: 'integer' }
          }
        }
      }
    });

    const targetTree = importTargetTree({
      type: 'object',
      properties: {
        marcaDescricao: { type: 'string' }
      }
    });

    const expression = 'resultado = "Porto" if dadosApolice.codigoMarca == 1001 else "Não identificado"\\nreturn resultado';
    const updatedTarget = setEvalExpression(targetTree, 'target-root.marcaDescricao', expression, 'script');
    const persisted = buildPersistenceDocument(sourceTree, updatedTarget, {
      nomeParceiro: 'porto_teste_1',
      eventoParceiro: 'emissao',
      tipoSchema: 'destino',
      versaoSchema: 'v1'
    });

    expect((persisted.schema_destino as Record<string, unknown>).properties).toBeDefined();
    const field = (((persisted.schema_destino as any).properties.marcaDescricao) as any).eval;
    expect(field.eval_type).toBe('script');
  });

  it('converte binding script para eval com eval_type script', () => {
    const sourceTree = importSourceTree({ type: 'object', properties: {} });
    const targetTree = importTargetTree({
      type: 'object',
      properties: {
        marcaDescricao: { type: 'string' }
      }
    });

    const updatedTarget = setScriptBinding(targetTree, 'target-root.marcaDescricao', {
      language: 'python',
      source: 'return "Porto"',
      returnType: 'string'
    });

    const persisted = buildPersistenceDocument(sourceTree, updatedTarget, {
      nomeParceiro: 'porto_teste_1',
      eventoParceiro: 'emissao',
      tipoSchema: 'destino',
      versaoSchema: 'v1'
    });

    const field = (((persisted.schema_destino as any).properties.marcaDescricao) as any).eval;
    expect(field.alias).toBe('return "Porto"');
    expect(field.eval_type).toBe('script');
  });

  it('gera erro quando array com map_from fica sem origem', () => {
    const targetTree = importTargetTree({
      type: 'object',
      properties: {
        itens: {
          type: 'array',
          map_from: {
            alias: []
          },
          items: {
            type: 'object',
            properties: {}
          }
        }
      }
    });

    expect(collectValidationErrors(targetTree)).toContain('Array "itens" precisa de uma origem para map_from.');
  });

  it('incorpora regra visual como eval no schema salvo', () => {
    const sourceTree = importSourceTree({
      type: 'object',
      properties: {
        dadosApolice: {
          type: 'object',
          properties: {
            codigoMarca: { type: 'integer' }
          }
        }
      }
    });
    const targetTree = importTargetTree({
      type: 'object',
      properties: {
        marcaDescricao: { type: 'string' }
      }
    });

    let rules = createRule([], '$.marcaDescricao');
    const ruleId = rules[0]!.id;
    const conditionId = rules[0]!.conditions[0]!.id;
    const actionId = rules[0]!.actions[0]!.id;
    rules = updateCondition(rules, ruleId, conditionId, { fieldPath: '$.dadosApolice.codigoMarca', operator: '==', value: '1001' });
    rules = updateAction(rules, ruleId, actionId, { type: 'setLiteral', value: 'Porto' });

    const persisted = buildPersistenceDocument(sourceTree, targetTree, {
      nomeParceiro: 'porto_teste_1',
      eventoParceiro: 'emissao',
      tipoSchema: 'destino',
      versaoSchema: 'v1'
    }, rules);

    const field = (((persisted.schema_destino as any).properties.marcaDescricao) as any).eval;
    expect(field.alias).toContain('codigoMarca == 1001');
    expect(field.alias).toContain('"Porto"');
  });

  it('preserva separador e formatação configurados no concat salvo', () => {
    const sourceTree = importSourceTree({ type: 'object', properties: {} });
    const targetTree = importTargetTree({
      type: 'object',
      properties: {
        numero: {
          type: 'string',
          concat: {
            alias: ['dadosApolice.codigoSucursal', 'dadosApolice.numeroApolice'],
            separator: '-',
            format: [{}, { pad: 'left', length: 3, char: '0' }]
          }
        }
      }
    });

    const persisted = buildPersistenceDocument(sourceTree, targetTree, {
      nomeParceiro: 'porto_teste_1',
      eventoParceiro: 'emissao',
      tipoSchema: 'destino',
      versaoSchema: 'v1'
    });

    const concat = (((persisted.schema_destino as any).properties.numero) as any).concat;
    expect(concat.separator).toBe('-');
    expect(concat.format[1]).toEqual({ pad: 'left', length: 3, char: '0' });
  });
});
