import { addAction, addCondition, createRule, createRuleTemplate, updateAction, updateCondition } from './rulesState';

describe('rulesState', () => {
  it('cria uma regra com condição e ação padrão', () => {
    const rules = createRule([], '$.data.tipoContrato');

    expect(rules).toHaveLength(1);
    expect(rules[0]?.conditions).toHaveLength(1);
    expect(rules[0]?.actions).toHaveLength(1);
    expect(rules[0]?.actions[0]?.fieldPath).toBe('$.data.tipoContrato');
  });

  it('permite adicionar condição e ação em uma regra existente', () => {
    let rules = createRule([], '$.data.tipoContrato');
    const ruleId = rules[0]!.id;

    rules = addCondition(rules, ruleId);
    rules = addAction(rules, ruleId, '$.data.marcaDescricao');

    expect(rules[0]?.conditions).toHaveLength(2);
    expect(rules[0]?.actions).toHaveLength(2);
    expect(rules[0]?.actions[1]?.fieldPath).toBe('$.data.marcaDescricao');
  });

  it('gera template Porto preenchido', () => {
    const rules = createRuleTemplate([], 'porto', '$.data.marcaDescricao');
    const created = rules[0]!;

    expect(created.name).toBe('Marca Porto');
    expect(created.conditions[0]?.fieldPath).toBe('$.dadosApolice.codigoMarca');
    expect(created.actions[0]?.value).toBe('Porto');
  });

  it('atualiza condition e action por patch', () => {
    let rules = createRule([], '$.data.tipoContrato');
    const ruleId = rules[0]!.id;
    const conditionId = rules[0]!.conditions[0]!.id;
    const actionId = rules[0]!.actions[0]!.id;

    rules = updateCondition(rules, ruleId, conditionId, { operator: '==', value: '5' });
    rules = updateAction(rules, ruleId, actionId, { type: 'setExpression', expression: 'return "APOLICE"' });

    expect(rules[0]?.conditions[0]?.operator).toBe('==');
    expect(rules[0]?.conditions[0]?.value).toBe('5');
    expect(rules[0]?.actions[0]?.type).toBe('setExpression');
    expect(rules[0]?.actions[0]?.expression).toBe('return "APOLICE"');
  });
});
