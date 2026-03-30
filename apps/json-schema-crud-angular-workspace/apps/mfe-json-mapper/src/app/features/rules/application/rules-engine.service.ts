import { Injectable } from '@angular/core';
import { MappingRule, RuleAction, RuleCondition } from '../../../core/models';
import { evaluateExpression, getValueByPath, setValueByPath } from '../../../core/utils';

@Injectable({
  providedIn: 'root'
})
export class RulesEngineService {
  applyRules(
    rules: MappingRule[],
    source: Record<string, unknown>,
    target: Record<string, unknown>
  ): void {
    rules.forEach((rule) => {
      const matcher = rule.matchMode == 'any' ? 'some' : 'every';
      const matches = rule.conditions[matcher]((condition) =>
        this.evaluateCondition(condition, source, target)
      );

      if (matches) {
        rule.actions.forEach((action) => this.executeAction(action, source, target));
      }
    });
  }

  evaluateCondition(
    condition: RuleCondition,
    source: Record<string, unknown>,
    target: Record<string, unknown>
  ): boolean {
    const currentValue = getValueByPath(condition.scope == 'source' ? source : target, condition.fieldPath);
    const expectedValue = this.parseValue(condition.value);

    switch (condition.operator) {
      case '==':
        return currentValue == expectedValue;
      case '!=':
        return currentValue != expectedValue;
      case '>':
        return Number(currentValue) > Number(expectedValue);
      case '>=':
        return Number(currentValue) >= Number(expectedValue);
      case '<':
        return Number(currentValue) < Number(expectedValue);
      case '<=':
        return Number(currentValue) <= Number(expectedValue);
      case 'contains':
        return String(currentValue ?? '').includes(String(expectedValue ?? ''));
      case 'exists':
        return currentValue != undefined && currentValue != null && currentValue != '';
      default:
        return false;
    }
  }

  executeAction(
    action: RuleAction,
    source: Record<string, unknown>,
    target: Record<string, unknown>
  ): void {
    const base = action.scope == 'source' ? source : target;
    let nextValue: unknown;

    if (action.type == 'copyField') {
      nextValue = getValueByPath(action.sourceScope == 'source' ? source : target, action.sourceFieldPath);
    } else if (action.type == 'setExpression') {
      nextValue = evaluateExpression(action.expression, {
        source,
        target,
        currentValue: getValueByPath(base, action.fieldPath),
        currentSourcePath: action.sourceFieldPath,
        currentTargetPath: action.fieldPath
      });
    } else {
      nextValue = this.parseValue(action.value);
    }

    setValueByPath(base, action.fieldPath, nextValue);
  }

  parseValue(value: unknown): unknown {
    const trimmed = String(value ?? '').trim();

    if (trimmed == '') {
      return '';
    }

    if (trimmed == 'true') {
      return true;
    }

    if (trimmed == 'false') {
      return false;
    }

    if (trimmed == 'null') {
      return null;
    }

    if (!Number.isNaN(Number(trimmed))) {
      return Number(trimmed);
    }

    return trimmed;
  }
}



