import { importTargetTree } from '../schema/schemaImport';
import {
  addAliasFallback,
  clearConcatFormat,
  moveConcatSource,
  setAliasSource,
  setAdvancedExpression,
  setEvalExpression,
  setScriptBinding,
  shouldPersistEvalAsScript,
  updateAliasStrategy,
  updateConcatFormat,
  updateConcatSeparator
} from './workbenchState';

describe('workbenchState', () => {
  it('atualiza alias no campo selecionado', () => {
    const targetTree = importTargetTree({
      type: 'object',
      properties: {
        data: {
          type: 'object',
          properties: {
            numero: {
              type: 'string'
            }
          }
        }
      }
    });

    const updated = setAliasSource(targetTree, 'target-root.data.numero', '$.dadosApolice.numeroApolice');
    const binding = updated[0].children[0]?.children[0]?.binding;

    expect(binding?.mode).toBe('alias');
    expect(binding?.sourcePaths).toEqual(['$.dadosApolice.numeroApolice']);
  });

  it('marca eval inline com return como script', () => {
    const targetTree = importTargetTree({
      type: 'object',
      properties: {
        marcaDescricao: {
          type: 'string'
        }
      }
    });

    const expression = 'resultado = "Porto" if dadosApolice.codigoMarca == 1001 else "Nao identificado"\\nreturn resultado';
    const updated = setEvalExpression(
      targetTree,
      'target-root.marcaDescricao',
      expression,
      shouldPersistEvalAsScript(expression) ? 'script' : undefined
    );

    expect(updated[0].children[0]?.binding?.evalType).toBe('script');
  });

  it('preserva Python como linguagem válida no script', () => {
    const targetTree = importTargetTree({
      type: 'object',
      properties: {
        marcaDescricao: {
          type: 'string'
        }
      }
    });

    const updated = setScriptBinding(targetTree, 'target-root.marcaDescricao', {
      language: 'python',
      source: 'return "Porto"',
      returnType: 'string'
    });

    expect(updated[0].children[0]?.binding?.script).toEqual({
      language: 'python',
      source: 'return "Porto"',
      returnType: 'string'
    });
  });

  it('reordena as entradas do concat', () => {
    const targetTree = importTargetTree({
      type: 'object',
      properties: {
        numero: {
          type: 'string',
          concat: {
            alias: ['dadosApolice.codigoSucursal', 'dadosApolice.numeroApolice', 'dadosApolice.numeroItem']
          }
        }
      }
    });

    const updated = moveConcatSource(targetTree, 'target-root.numero', 2, -1);

    expect(updated[0].children[0]?.binding?.sourcePaths).toEqual([
      '$.dadosApolice.codigoSucursal',
      '$.dadosApolice.numeroItem',
      '$.dadosApolice.numeroApolice'
    ]);
  });

  it('mantém alias fallback e estratégia configurável', () => {
    const targetTree = importTargetTree({
      type: 'object',
      properties: {
        numero: {
          type: 'string',
          alias: ['dadosApolice.numeroApolice']
        }
      }
    });

    const withFallback = addAliasFallback(targetTree, 'target-root.numero', '$.dadosApolice.numeroItem');
    const withStrategy = updateAliasStrategy(withFallback, 'target-root.numero', 'first');

    expect(withStrategy[0].children[0]?.binding?.sourcePaths).toEqual(['$.dadosApolice.numeroApolice', '$.dadosApolice.numeroItem']);
    expect(withStrategy[0].children[0]?.binding?.aliasStrategy).toBe('first');
  });

  it('atualiza separator, formatter e expressão avançada do concat', () => {
    const targetTree = importTargetTree({
      type: 'object',
      properties: {
        numero: {
          type: 'string',
          concat: {
            alias: ['dadosApolice.codigoSucursal', 'dadosApolice.numeroApolice']
          }
        }
      }
    });

    const withSeparator = updateConcatSeparator(targetTree, 'target-root.numero', '|');
    const withFormat = updateConcatFormat(withSeparator, 'target-root.numero', 1, { pad: 'left', length: 3, char: '0' });
    const withExpression = setAdvancedExpression(withFormat, 'target-root.numero', "concat(src('$.a'), src('$.b'))");
    const cleared = clearConcatFormat(withExpression, 'target-root.numero', 1);

    expect(withExpression[0].children[0]?.binding?.separator).toBe('|');
    expect(withExpression[0].children[0]?.binding?.formatters[1]?.length).toBe(3);
    expect(withExpression[0].children[0]?.binding?.advancedExpression).toContain("src('$.a')");
    expect(cleared[0].children[0]?.binding?.formatters[1]?.length).toBe(0);
  });
});
