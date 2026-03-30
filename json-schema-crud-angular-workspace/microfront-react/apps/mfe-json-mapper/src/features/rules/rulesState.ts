import type { MappingRule, RuleAction, RuleActionApplicationMode, RuleActionType, RuleCondition, RuleOperator } from '../../core/models/mapperModels';

export const RULE_OPERATORS: RuleOperator[] = ['==', '!=', '>', '>=', '<', '<=', 'contains', 'exists'];

export function createRule(rules: MappingRule[], selectedTargetPath: string): MappingRule[] {
  const nextId = `rule-${rules.length + 1}`;
  const defaultFieldPath = selectedTargetPath || '$';

  return [
    ...rules,
    {
      id: nextId,
      name: `Nova regra ${rules.length + 1}`,
      matchMode: 'all',
      conditions: [
        {
          id: `${nextId}-condition-1`,
          scope: 'source',
          fieldPath: '$',
          operator: 'exists',
          value: ''
        }
      ],
      actions: [
        {
          id: `${nextId}-action-1`,
          scope: 'target',
          fieldPath: defaultFieldPath,
          type: 'setLiteral',
          applicationMode: 'replace',
          value: '',
          sourceScope: 'source',
          sourceFieldPath: '$',
          expression: ''
        }
      ]
    }
  ];
}

export function removeRule(rules: MappingRule[], ruleId: string): MappingRule[] {
  return rules.filter((rule) => rule.id !== ruleId);
}

export function updateRuleName(rules: MappingRule[], ruleId: string, value: string): MappingRule[] {
  return rules.map((rule) => (rule.id === ruleId ? { ...rule, name: value } : rule));
}

export function updateRuleMatchMode(rules: MappingRule[], ruleId: string, mode: 'all' | 'any'): MappingRule[] {
  return rules.map((rule) => (rule.id === ruleId ? { ...rule, matchMode: mode } : rule));
}

export function addCondition(rules: MappingRule[], ruleId: string): MappingRule[] {
  return rules.map((rule) =>
    rule.id === ruleId
      ? {
          ...rule,
          conditions: [
            ...rule.conditions,
            {
              id: `${ruleId}-condition-${rule.conditions.length + 1}`,
              scope: 'source',
              fieldPath: '$',
              operator: 'exists',
              value: ''
            }
          ]
        }
      : rule
  );
}

export function removeCondition(rules: MappingRule[], ruleId: string, conditionId: string): MappingRule[] {
  return rules.map((rule) =>
    rule.id === ruleId
      ? {
          ...rule,
          conditions: rule.conditions.filter((condition) => condition.id !== conditionId)
        }
      : rule
  );
}

export function updateCondition(rules: MappingRule[], ruleId: string, conditionId: string, patch: Partial<RuleCondition>): MappingRule[] {
  return rules.map((rule) =>
    rule.id === ruleId
      ? {
          ...rule,
          conditions: rule.conditions.map((condition) => (condition.id === conditionId ? { ...condition, ...patch } : condition))
        }
      : rule
  );
}

export function addAction(rules: MappingRule[], ruleId: string, selectedTargetPath: string): MappingRule[] {
  return rules.map((rule) =>
    rule.id === ruleId
      ? {
          ...rule,
          actions: [
            ...rule.actions,
            {
              id: `${ruleId}-action-${rule.actions.length + 1}`,
              scope: 'target',
              fieldPath: selectedTargetPath || '$',
              type: 'setLiteral',
              applicationMode: 'replace',
              value: '',
              sourceScope: 'source',
              sourceFieldPath: '$',
              expression: ''
            }
          ]
        }
      : rule
  );
}

export function removeAction(rules: MappingRule[], ruleId: string, actionId: string): MappingRule[] {
  return rules.map((rule) =>
    rule.id === ruleId
      ? {
          ...rule,
          actions: rule.actions.filter((action) => action.id !== actionId)
        }
      : rule
  );
}

export function updateAction(rules: MappingRule[], ruleId: string, actionId: string, patch: Partial<RuleAction>): MappingRule[] {
  return rules.map((rule) =>
    rule.id === ruleId
      ? {
          ...rule,
          actions: rule.actions.map((action) => (action.id === actionId ? { ...action, ...patch } : action))
        }
      : rule
  );
}

export function createRuleTemplate(
  rules: MappingRule[],
  template: 'porto' | 'apolice' | 'cnpjProdutor',
  selectedTargetPath: string
): MappingRule[] {
  const withRule = createRule(rules, selectedTargetPath);
  const created = withRule.at(-1);
  if (!created) {
    return withRule;
  }

  const conditionId = created.conditions[0]?.id ?? '';
  const actionId = created.actions[0]?.id ?? '';

  const setTemplate = (
    name: string,
    fieldPath: string,
    operator: RuleOperator,
    value: string,
    targetValue: string,
    applicationMode: RuleActionApplicationMode = 'replace'
  ): MappingRule[] => {
    let next = updateRuleName(withRule, created.id, name);
    next = updateCondition(next, created.id, conditionId, {
      scope: 'source',
      fieldPath,
      operator,
      value
    });
    next = updateAction(next, created.id, actionId, {
      scope: 'target',
      fieldPath: selectedTargetPath || created.actions[0]?.fieldPath || '$',
      type: 'setLiteral',
      value: targetValue,
      applicationMode
    });
    return next;
  };

  if (template === 'porto') {
    return setTemplate('Marca Porto', '$.dadosApolice.codigoMarca', '==', '1001', 'Porto');
  }

  if (template === 'apolice') {
    return setTemplate('Tipo apólice', '$.dadosApolice.numeroApolice', 'exists', '', 'APOLICE', 'fallback');
  }

  return setTemplate('Produtor padrão', '$.dadosApolice.codigoMarca', 'exists', '', '61199164000160');
}

export function totalConditions(rules: MappingRule[]): number {
  return rules.reduce((sum, rule) => sum + rule.conditions.length, 0);
}

export function totalActions(rules: MappingRule[]): number {
  return rules.reduce((sum, rule) => sum + rule.actions.length, 0);
}

export function summarizeCondition(condition: RuleCondition, label: string): string {
  if (condition.operator === 'exists') {
    return `${label} existe`;
  }

  return `${label} ${condition.operator} ${condition.value?.trim() || '(vazio)'}`;
}

export function summarizeAction(action: RuleAction, targetLabel: string, sourceLabel: string): string {
  const mode = action.applicationMode ?? 'replace';
  const modeLabel =
    mode === 'fallback' ? 'Usar como fallback' : mode === 'whenEmpty' ? 'Aplicar só quando vazio' : 'Substituir o campo';

  if (action.type === 'setLiteral') {
    return `${targetLabel} ← ${action.value || '(vazio)'} · ${modeLabel}`;
  }

  if (action.type === 'copyField') {
    return `${targetLabel} ← ${sourceLabel} · ${modeLabel}`;
  }

  return `${targetLabel} ← fórmula avançada · ${modeLabel}`;
}

export function actionApplicationLabel(mode?: RuleActionApplicationMode): string {
  if (mode === 'fallback') return 'Usar como fallback';
  if (mode === 'whenEmpty') return 'Aplicar só quando vazio';
  return 'Substituir o campo';
}

export function ruleActionTypeLabel(type: RuleActionType): string {
  if (type === 'copyField') return 'Copiar campo';
  if (type === 'setExpression') return 'Fórmula avançada';
  return 'Definir valor';
}
