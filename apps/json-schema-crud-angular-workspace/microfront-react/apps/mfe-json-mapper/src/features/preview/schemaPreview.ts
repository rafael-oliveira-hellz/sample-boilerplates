import type { MappingRule, RuleAction, RuleCondition, SchemaNodeDraft, TargetBindingDraft } from '../../core/models/mapperModels';
import { shouldPersistEvalAsScript } from '../workbench/workbenchState';

type JsonRecord = Record<string, unknown>;

export interface PersistenceMetadata {
  nomeParceiro: string;
  tipoSchema: 'origem' | 'destino';
  versaoSchema: string;
  eventoParceiro: string;
}

export function stringifyJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export function countJsonLines(value: string): number {
  return value ? value.split('\n').length : 0;
}

export function generateSourceSchema(nodes: SchemaNodeDraft[], schemaUri = 'https://json-schema.org/draft/2020-12/schema'): JsonRecord {
  return {
    $schema: schemaUri,
    ...(generateSourceNode(nodes[0] ?? emptyRoot()) as JsonRecord)
  };
}

export function generateTargetSchema(nodes: SchemaNodeDraft[], schemaUri = 'http://json-schema.org/draft-04/schema#'): JsonRecord {
  const synthesized = synthesizeRuleBindings(nodes, []);
  return {
    $schema: schemaUri,
    ...(generateTargetNode(synthesized[0] ?? emptyRoot()) as JsonRecord)
  };
}

export function buildPersistenceDocument(
  sourceNodes: SchemaNodeDraft[],
  targetNodes: SchemaNodeDraft[],
  metadata: PersistenceMetadata,
  rules: MappingRule[] = []
): JsonRecord {
  const synthesizedTarget = synthesizeRuleBindings(targetNodes, rules);
  return {
    nome_parceiro: metadata.nomeParceiro,
    tipo_schema: metadata.tipoSchema,
    versao_schema: metadata.versaoSchema,
    evento_parceiro: metadata.eventoParceiro,
    schema_origem: generateSourceSchema(sourceNodes),
    schema_destino: {
      $schema: 'http://json-schema.org/draft-04/schema#',
      ...(generateTargetNode(synthesizedTarget[0] ?? emptyRoot()) as JsonRecord)
    }
  };
}

export function collectValidationErrors(targetNodes: SchemaNodeDraft[], rules: MappingRule[] = []): string[] {
  const errors: string[] = [];
  const ruleTargetPaths = new Set(
    rules
      .flatMap((rule) => rule.actions)
      .filter((action) => action.scope === 'target' && !!action.fieldPath)
      .map((action) => action.fieldPath)
  );

  const walk = (node: SchemaNodeDraft): void => {
    if (node.kind === 'field') {
      if (ruleTargetPaths.has(node.path)) {
        node.children.forEach(walk);
        return;
      }

      const mode = node.binding?.mode ?? 'unmapped';

      if (mode === 'unmapped') {
        errors.push(`Campo "${node.displayPath}" ainda não foi configurado.`);
      }

      if (mode === 'alias' && !node.binding?.sourcePaths.some(Boolean)) {
        errors.push(`Campo "${node.displayPath}" precisa de uma origem para alias.`);
      }

      if (mode === 'concat' && !node.binding?.sourcePaths.some(Boolean)) {
        errors.push(`Campo "${node.displayPath}" precisa de pelo menos uma origem no concat.`);
      }

      if (mode === 'defaultSource' && !node.binding?.defaultSourcePath) {
        errors.push(`Campo "${node.displayPath}" precisa de uma origem para default dinâmico.`);
      }

      if (mode === 'eval' && !node.binding?.evalExpression.trim()) {
        errors.push(`Campo "${node.displayPath}" precisa de uma expressão eval.`);
      }

      if (mode === 'script' && !node.binding?.script?.source?.trim()) {
        errors.push(`Campo "${node.displayPath}" precisa de um script configurado.`);
      }
    }

    if (node.kind === 'array' && node.mapFrom && !node.mapFrom.sourcePaths.some(Boolean)) {
      errors.push(`Array "${node.displayPath}" precisa de uma origem para map_from.`);
    }

    node.children.forEach(walk);
  };

  targetNodes.forEach(walk);
  return errors;
}

function generateSourceNode(node: SchemaNodeDraft): unknown {
  if (node.kind === 'root' || node.kind === 'object') {
    const properties: JsonRecord = {};
    node.children.filter((child) => !child.itemModel).forEach((child) => {
      properties[child.key] = generateSourceNode(child);
    });

    return {
      type: 'object',
      ...(node.nullable ? { nullable: true } : {}),
      properties
    };
  }

  if (node.kind === 'array') {
    const item = node.children.find((child) => child.itemModel) ?? node.children[0];
    return {
      type: 'array',
      ...(node.nullable ? { nullable: true } : {}),
      items: item ? generateSourceNode(item) : { type: 'object', properties: {} }
    };
  }

  return {
    type: node.type,
    ...(node.nullable ? { nullable: true } : {})
  };
}

function generateTargetNode(node: SchemaNodeDraft): unknown {
  if (node.kind === 'root' || node.kind === 'object') {
    const properties: JsonRecord = {};
    node.children.filter((child) => !child.itemModel).forEach((child) => {
      properties[child.key] = generateTargetNode(child);
    });

    return {
      type: 'object',
      ...(node.nullable ? { nullable: true } : {}),
      properties
    };
  }

  if (node.kind === 'array') {
    const item = node.children.find((child) => child.itemModel) ?? node.children[0];
    const itemSchema = item ? generateTargetNode(item) : { type: 'object', properties: {} };

    if (node.mapFrom?.sourcePaths.some(Boolean)) {
      return {
        type: 'array',
        ...(node.nullable ? { nullable: true } : {}),
        map_from: {
          alias: node.mapFrom.sourcePaths.filter(Boolean).map(toSchemaAliasPath),
          items: itemSchema
        }
      };
    }

    return {
      type: 'array',
      ...(node.nullable ? { nullable: true } : {}),
      items: itemSchema
    };
  }

  const base: JsonRecord = {
    type: node.type,
    ...(node.nullable ? { nullable: true } : {})
  };

  switch (node.binding?.mode) {
    case 'alias':
      return {
        ...base,
        alias: node.binding.sourcePaths.filter(Boolean).map(toSchemaAliasPath)
      };
    case 'concat':
      {
        const normalizedFormatters = node.binding.sourcePaths.map((_, index) => {
          const formatter = node.binding?.formatters?.[index];
          if (!formatter || formatter.length <= 0) {
            return null;
          }

          return {
            pad: formatter.pad,
            length: formatter.length,
            char: formatter.char
          };
        });
        const hasConfiguredFormat = normalizedFormatters.some(Boolean);
      return {
        ...base,
        concat: {
          alias: node.binding.sourcePaths.filter(Boolean).map(toSchemaAliasPath),
          ...(node.binding.separator ? { separator: node.binding.separator } : {}),
          ...(hasConfiguredFormat
            ? {
                format: normalizedFormatters.map((item) => item ?? {})
              }
            : {})
        }
      };
      }
    case 'defaultLiteral':
      return {
        ...base,
        default: node.binding.defaultValue
      };
    case 'defaultSource':
      return {
        ...base,
        default: toSchemaAliasPath(node.binding.defaultSourcePath)
      };
    case 'eval': {
      const evalType = shouldPersistEvalAsScript(node.binding.evalExpression) ? 'script' : undefined;
      return {
        ...base,
        eval: {
          alias: node.binding.evalExpression,
          ...(evalType ? { eval_type: evalType } : {})
        }
      };
    }
    case 'script':
      return {
        ...base,
        eval: {
          alias: node.binding.script?.source ?? '',
          eval_type: 'script'
        }
      };
    default:
      return base;
  }
}

function synthesizeRuleBindings(nodes: SchemaNodeDraft[], rules: MappingRule[]): SchemaNodeDraft[] {
  const cloned = structuredClone(nodes) as SchemaNodeDraft[];
  const targetPaths = new Set(
    rules.flatMap((rule) => rule.actions.filter((action) => action.scope === 'target').map((action) => action.fieldPath))
  );

  for (const path of targetPaths) {
    const targetNode = findNodeByPath(cloned, path);
    if (!targetNode || targetNode.kind !== 'field') {
      continue;
    }

    const ruleSet = rules.filter((rule) => rule.actions.some((action) => action.scope === 'target' && action.fieldPath === path));
    const preview = compileRulesForField(targetNode, ruleSet);
    if (!preview) {
      continue;
    }

    targetNode.binding = {
      ...createBinding(targetNode.type),
      mode: preview.mode,
      evalExpression: preview.expression,
      evalType: preview.mode === 'script' ? 'script' : shouldPersistEvalAsScript(preview.expression) ? 'script' : undefined
    };
  }

  return cloned;
}

function compileRulesForField(node: SchemaNodeDraft, rules: MappingRule[]): { mode: 'eval' | 'script'; expression: string } | null {
  if (!rules.length) {
    return null;
  }

  let expression = bindingFallbackExpression(node.binding, node.type);

  for (const rule of rules) {
    const action = rule.actions.find((item) => item.scope === 'target' && item.fieldPath === node.path);
    if (!action) {
      continue;
    }

    const conditionExpression = compileRuleConditions(rule);
    const actionExpression = compileRuleAction(action);
    expression = applyRuleActionMode(action, conditionExpression, actionExpression, expression);
  }

  if (!expression.trim()) {
    return null;
  }

  if (shouldPersistEvalAsScript(expression)) {
    return { mode: 'script', expression: `return ${expression};` };
  }

  return { mode: 'eval', expression };
}

function compileRuleConditions(rule: MappingRule): string {
  const parts = rule.conditions.map((condition) => compileCondition(condition)).filter(Boolean);
  if (!parts.length) {
    return 'true';
  }

  const joiner = rule.matchMode === 'any' ? ' || ' : ' && ';
  return parts.length === 1 ? parts[0] : `(${parts.join(joiner)})`;
}

function compileCondition(condition: RuleCondition): string {
  const reference = compilePathReference(condition.scope, condition.fieldPath);
  const literal = toExpressionLiteral(condition.value);

  switch (condition.operator) {
    case 'exists':
      return `(${reference} != null && ${reference} != undefined && ${reference} != '')`;
    case 'contains':
      return `String(${reference} ?? '').includes(${literal})`;
    case '==':
    case '!=':
    case '>':
    case '>=':
    case '<':
    case '<=':
      return `${reference} ${condition.operator} ${literal}`;
    default:
      return '';
  }
}

function compileRuleAction(action: RuleAction): string {
  if (action.type === 'setLiteral') {
    return toExpressionLiteral(action.value);
  }
  if (action.type === 'copyField') {
    return compilePathReference(action.sourceScope, action.sourceFieldPath);
  }
  if (action.type === 'setExpression') {
    return action.expression.trim();
  }
  return '';
}

function applyRuleActionMode(action: RuleAction, conditionExpression: string, actionExpression: string, currentExpression: string): string {
  const applicationMode = action.applicationMode ?? 'replace';

  if (applicationMode === 'fallback') {
    return wrapWithEmptyCheck(currentExpression, `(${conditionExpression}) ? (${actionExpression}) : (null)`);
  }

  if (applicationMode === 'whenEmpty') {
    return `(${conditionExpression}) && ${emptyValueCheck(currentExpression)} ? (${actionExpression}) : (${currentExpression})`;
  }

  return `(${conditionExpression}) ? (${actionExpression}) : (${currentExpression})`;
}

function wrapWithEmptyCheck(currentExpression: string, fallbackExpression: string): string {
  return `${emptyValueCheck(currentExpression)} ? (${fallbackExpression}) : (${currentExpression})`;
}

function emptyValueCheck(expression: string): string {
  return `((${expression}) == null || (${expression}) == undefined || (${expression}) === '')`;
}

function compilePathReference(scope: 'source' | 'target', path: string): string {
  if (!path?.trim()) {
    return 'null';
  }
  const normalized = toSchemaAliasPath(path);
  return scope === 'target' ? `target.${normalized}` : normalized;
}

function toExpressionLiteral(value: string): string {
  const parsed = parseRuleLiteral(value);
  if (parsed == null) {
    return 'null';
  }
  if (typeof parsed === 'string') {
    return JSON.stringify(parsed);
  }
  return String(parsed);
}

function parseRuleLiteral(value: string): string | number | boolean | null {
  const trimmed = String(value ?? '').trim();
  if (trimmed === '') {
    return '';
  }
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (trimmed === 'null') return null;
  if (!Number.isNaN(Number(trimmed))) {
    return Number(trimmed);
  }
  return trimmed;
}

function bindingFallbackExpression(binding: TargetBindingDraft | undefined, type: string): string {
  if (!binding) {
    return 'null';
  }

  switch (binding.mode) {
    case 'alias':
      if (!binding.sourcePaths.filter(Boolean).length) {
        return 'null';
      }
      return binding.sourcePaths
        .filter(Boolean)
        .map((path) => compilePathReference('source', path))
        .reduceRight((fallback, current) => `(${current} ?? ${fallback})`, 'null');
    case 'concat':
      return binding.sourcePaths
        .filter(Boolean)
        .map((path) => compilePathReference('source', path))
        .join(` + ${JSON.stringify('')} + `) || '""';
    case 'defaultLiteral':
      return JSON.stringify(binding.defaultValue ?? '');
    case 'defaultSource':
      return compilePathReference('source', binding.defaultSourcePath);
    case 'eval':
      return binding.evalExpression?.trim() || 'null';
    case 'script':
      return 'null';
    default:
      return type === 'string' ? '""' : 'null';
  }
}

function createBinding(type: string): TargetBindingDraft {
  return {
    mode: 'unmapped',
    sourcePaths: [],
    defaultValue: '',
    defaultSourcePath: '',
    evalExpression: '',
    script: {
      language: 'java',
      source: '',
      returnType: type
    }
  };
}

function findNodeByPath(nodes: SchemaNodeDraft[], path: string): SchemaNodeDraft | null {
  for (const node of nodes) {
    if (node.path === path) {
      return node;
    }
    const child = findNodeByPath(node.children, path);
    if (child) {
      return child;
    }
  }
  return null;
}

function toSchemaAliasPath(path: string): string {
  return path.replace(/^\$\./, '').replace(/^\$/, '').replace(/\[0\]/g, '');
}

function emptyRoot(): SchemaNodeDraft {
  return {
    id: 'root',
    scope: 'target',
    key: 'root',
    label: 'Root',
    path: '$',
    aliasPath: '',
    displayPath: 'root',
    kind: 'root',
    type: 'object',
    parentId: null,
    children: [],
    expanded: true,
    manual: false,
    itemModel: false
  };
}
