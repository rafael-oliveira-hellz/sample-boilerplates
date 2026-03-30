import { Injectable, inject } from '@angular/core';
import { SchemaImportService } from './schema-import.service';
import { ConcatFormatDraft, MapFromDraft, MappingRule, SchemaNodeDraft, TargetBindingDraft } from '../../../core/models';
import {
    deepClone,
    evaluateExpression,
    getValueByPath,
    normalizePayloadForExecution
} from '../../../core/utils';

type JsonRecord = Record<string, unknown>;
type ValueContext = Record<string, unknown>;

@Injectable({
  providedIn: 'root'
})
export class SchemaGeneratorService {
  private readonly schemaImport = inject(SchemaImportService);

  previewRuleBinding(
    node: SchemaNodeDraft,
    rules: MappingRule[]
  ): { mode: 'eval' | 'script'; expression: string } | null {
    return this.compileRulesForField(node, rules);
  }

  generateTargetSchema(
    nodes: SchemaNodeDraft[],
    rules: MappingRule[] = [],
    schemaUri = 'http://json-schema.org/draft-04/schema#'
  ): JsonRecord {
    if (!nodes.length || !nodes[0]) {
      return {
        $schema: schemaUri,
        type: 'object',
        properties: {}
      };
    }

    const synthesizedTree = this.synthesizeRuleBindings(nodes, rules);
    const root = synthesizedTree[0];
    const schema = this.generateNodeSchema(root);
    return {
      $schema: schemaUri,
      ...(schema as JsonRecord)
    };
  }

  generateSourceSchema(
    nodes: SchemaNodeDraft[],
    schemaUri = 'https://json-schema.org/draft/2020-12/schema'
  ): JsonRecord {
    if (!nodes.length || !nodes[0]) {
      return {
        $schema: schemaUri,
        type: 'object',
        properties: {}
      };
    }

    const root = nodes[0];
    const schema = this.generateSourceNodeSchema(root);
    return {
      $schema: schemaUri,
      ...(schema as JsonRecord)
    };
  }

  generatePreviewPayload(targetNodes: SchemaNodeDraft[], sourceNodes: SchemaNodeDraft[], rules: MappingRule[]): string {
    const sourceRaw = JSON.stringify(this.generateSourceSchema(sourceNodes), null, 2);
    return this.buildPreviewPayload(sourceRaw, targetNodes, rules, 'http://json-schema.org/draft-04/schema#');
  }

  validateWorkspace(_sourceNodes: SchemaNodeDraft[], targetNodes: SchemaNodeDraft[], rules: MappingRule[] = []): string[] {
    return this.collectValidationErrors(targetNodes, rules);
  }

  countRulesForTarget(rules: MappingRule[], targetNodeIdOrPath: string): number {
    if (!targetNodeIdOrPath) {
      return 0;
    }

    return rules.filter((rule) => rule.actions.some((action) => action.fieldPath == targetNodeIdOrPath)).length;
  }

  summarizeTargetField(node: SchemaNodeDraft | null): { mode: string; sourceCount: number; hasRules: boolean } {
    if (!node?.binding) {
      return { mode: 'unmapped', sourceCount: 0, hasRules: false };
    }

    const sourceCount = node.binding.mode == 'defaultSource'
      ? (node.binding.defaultSourcePath ? 1 : 0)
      : node.binding.sourcePaths.filter(Boolean).length;

    return {
      mode: node.binding.mode,
      sourceCount,
      hasRules: node.binding.mode == 'rule'
    };
  }
  buildPreviewPayload(
    sourceRaw: string,
    targetNodes: SchemaNodeDraft[],
    rules: MappingRule[],
    schemaUri: string
  ): string {
    const sourceParsed = this.schemaImport.parseJsonText(sourceRaw).raw;
    const source = normalizePayloadForExecution(sourceParsed, 'source') as JsonRecord;
    const synthesizedTree = this.synthesizeRuleBindings(targetNodes, rules);
    const targetSchema = this.generateTargetSchema(synthesizedTree, [], schemaUri);
    const target = this.buildNodeValue(synthesizedTree[0], source, source, {} as JsonRecord) as JsonRecord
      ?? normalizePayloadForExecution(targetSchema, 'target') as JsonRecord;

    return JSON.stringify(target, null, 2);
  }

  collectValidationErrors(nodes: SchemaNodeDraft[], rules: MappingRule[] = []): string[] {
    const errors: string[] = [];
    const ruleTargetPaths = new Set<string>(
      rules.flatMap((rule) =>
        rule.actions
          .filter((action) => action.scope == 'target')
          .map((action) => action.fieldPath)
      )
    );

    const walk = (node: SchemaNodeDraft) => {
      if (node.kind == 'field') {
        if (ruleTargetPaths.has(node.path)) {
          node.children.forEach(walk);
          return;
        }

        const mode = node.binding?.mode ?? 'unmapped';
        if (mode == 'unmapped') {
          errors.push(`Campo "${node.displayPath}" ainda nao foi configurado.`);
        }

        if (mode == 'alias' && !node.binding?.sourcePaths.some(Boolean)) {
          errors.push(`Campo "${node.displayPath}" precisa de uma origem para alias.`);
        }

        if (mode == 'concat' && !node.binding?.sourcePaths.some(Boolean)) {
          errors.push(`Campo "${node.displayPath}" precisa de pelo menos uma origem no concat.`);
        }

        if (mode == 'defaultSource' && !node.binding?.defaultSourcePath) {
          errors.push(`Campo "${node.displayPath}" precisa de uma origem para default dinamico.`);
        }

        if (mode == 'eval' && !node.binding?.evalExpression?.trim()) {
          errors.push(`Campo "${node.displayPath}" precisa de uma expressao eval.`);
        }

        if (mode == 'script' && !node.binding?.script?.source?.trim()) {
          errors.push(`Campo "${node.displayPath}" precisa de um script configurado.`);
        }
      }

      if (node.kind == 'array' && node.mapFrom && !node.mapFrom.sourcePaths.some(Boolean)) {
        errors.push(`Array "${node.displayPath}" precisa de uma origem para map_from.`);
      }

      node.children.forEach(walk);
    };

    nodes.forEach(walk);
    return errors;
  }

  private generateNodeSchema(node: SchemaNodeDraft): unknown {
    if (node.kind == 'root' || node.kind == 'object') {
      const properties: Record<string, unknown> = {};
      node.children
        .filter((child) => !child.itemModel)
        .forEach((child) => {
          properties[child.key] = this.generateNodeSchema(child);
        });

      return {
        type: 'object',
        ...(node.nullable ? { nullable: true } : {}),
        properties
      };
    }

    if (node.kind == 'array') {
      const item = node.children.find((child) => child.itemModel) ?? node.children[0];
      const itemSchema = item ? this.generateNodeSchema(item) : { type: 'object', properties: {} };
      if (node.mapFrom?.sourcePaths.some(Boolean)) {
        return {
          type: 'array',
          ...(node.nullable ? { nullable: true } : {}),
          map_from: {
            alias: node.mapFrom.sourcePaths
              .filter(Boolean)
              .map((path) => this.schemaImport.toSchemaAliasPath(path)),
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
    const binding = node.binding;

    if (!binding) {
      return base;
    }

    switch (binding.mode) {
      case 'alias':
        return {
          ...base,
          alias: binding.sourcePaths.filter(Boolean).map((path) => this.schemaImport.toSchemaAliasPath(path))
        };
      case 'concat':
        {
          const normalizedFormatters = binding.sourcePaths.map((_, index) => {
            const formatter = binding.formatters[index];
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
            alias: binding.sourcePaths.filter(Boolean).map((path) => this.schemaImport.toSchemaAliasPath(path)),
            ...(binding.separator ? { separator: binding.separator } : {}),
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
          default: this.parseLiteralByType(node.type, binding.defaultValue)
        };
      case 'defaultSource':
        return {
          ...base,
          default: this.schemaImport.toSchemaAliasPath(binding.defaultSourcePath)
        };
      case 'eval':
        {
          const evalExpression = binding.evalExpression ?? '';
          const evalType = this.shouldPersistEvalAsScript(evalExpression, binding.evalType) ? 'script' : undefined;

          return {
            ...base,
            eval: {
              alias: evalExpression,
              ...(evalType ? { eval_type: evalType } : {})
            }
          };
        }
      case 'script':
        return {
          ...base,
          eval: {
            alias: binding.script?.source ?? '',
            eval_type: 'script'
          }
        };
      default:
        return base;
    }
  }

  private buildNodeValue(
    node: SchemaNodeDraft,
    sourceRoot: JsonRecord,
    currentSource: ValueContext,
    targetRoot: JsonRecord
  ): unknown {
    if (node.kind == 'root' || node.kind == 'object') {
      const result: JsonRecord = {};

      node.children
        .filter((child) => !child.itemModel)
        .forEach((child) => {
          const childValue = this.buildNodeValue(child, sourceRoot, currentSource, targetRoot);
          if (childValue != undefined) {
            result[child.key] = childValue;
          }
        });

      return result;
    }

    if (node.kind == 'array') {
      if (node.mapFrom?.sourcePaths.some(Boolean)) {
        const collection = this.resolveSourceValues(node.mapFrom, sourceRoot, currentSource);
        const itemNode = node.children.find((child) => child.itemModel) ?? node.children[0];

        if (!itemNode || !Array.isArray(collection)) {
          return [];
        }

        return collection.map((item) => {
          const currentItem = item != null && typeof item == 'object' ? (item as ValueContext) : {};
          return this.buildNodeValue(itemNode, sourceRoot, currentItem, targetRoot);
        });
      }

      return [];
    }

    return this.resolveFieldValue(node, sourceRoot, currentSource, targetRoot);
  }

  private resolveFieldValue(
    node: SchemaNodeDraft,
    sourceRoot: JsonRecord,
    currentSource: ValueContext,
    targetRoot: JsonRecord
  ): unknown {
    const binding = node.binding;
    if (!binding) {
      return undefined;
    }

    switch (binding.mode) {
      case 'alias':
        return this.resolveFirstSourceValue(binding.sourcePaths, sourceRoot, currentSource);
      case 'concat':
        return binding.sourcePaths
          .map((path, index) => this.applyFormatter(this.resolvePath(path, sourceRoot, currentSource), binding.formatters[index]))
          .join(binding.separator ?? '');
      case 'defaultLiteral':
        return this.parseLiteralByType(node.type, binding.defaultValue);
      case 'defaultSource':
        return this.resolvePath(binding.defaultSourcePath, sourceRoot, currentSource);
      case 'eval':
        return this.evaluateBindingExpression(binding.evalExpression ?? '', sourceRoot, currentSource, targetRoot, node.path);
      case 'script':
        return `[script:${binding.script?.language ?? 'java'}] ${binding.script?.source ? 'configured' : 'empty'}`;
      case 'rule':
        return getValueByPath(targetRoot, node.path);
      default:
        if (binding.advancedExpression.trim()) {
          return this.evaluateBindingExpression(binding.advancedExpression, sourceRoot, currentSource, targetRoot, node.path);
        }

        return undefined;
    }
  }

  private resolveSourceValues(
    mapFrom: MapFromDraft,
    sourceRoot: JsonRecord,
    currentSource: ValueContext
  ): unknown {
    return this.resolveFirstSourceValue(mapFrom.sourcePaths, sourceRoot, currentSource);
  }

  private resolveFirstSourceValue(
    paths: string[],
    sourceRoot: JsonRecord,
    currentSource: ValueContext
  ): unknown {
    for (const path of paths.filter(Boolean)) {
      const value = this.resolvePath(path, sourceRoot, currentSource);
      if (value != undefined && value != null && value != '') {
        return value;
      }
    }

    return undefined;
  }

  private resolvePath(path: string, sourceRoot: JsonRecord, currentSource: ValueContext): unknown {
    if (!path) {
      return undefined;
    }

    if (path.startsWith('$')) {
      const contextualValue = getValueByPath(currentSource, path);
      if (contextualValue != undefined) {
        return contextualValue;
      }

      return getValueByPath(sourceRoot, path);
    }

    const relativePath = path.startsWith('$.') ? path : `$.${path}`;
    const relativeValue = getValueByPath(currentSource, relativePath);
    if (relativeValue != undefined) {
      return relativeValue;
    }

    return getValueByPath(sourceRoot, relativePath);
  }

  private evaluateBindingExpression(
    expression: string,
    sourceRoot: JsonRecord,
    currentSource: ValueContext,
    targetRoot: JsonRecord,
    targetPath: string
  ): unknown {
    if (!expression.trim()) {
      return undefined;
    }

    try {
      return evaluateExpression(expression, {
        source: sourceRoot,
        target: targetRoot,
        currentValue: currentSource,
        currentSourcePath: '$',
        currentTargetPath: targetPath
      });
    } catch {
      return `[eval] ${expression}`;
    }
  }

  shouldPersistEvalAsScript(expression: string, explicitType?: 'script'): boolean {
    if (explicitType == 'script') {
      return true;
    }

    const normalized = expression
      .replace(/\\r\\n/g, '\n')
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\n')
      .trim();
    if (!normalized) {
      return false;
    }

    const expressionWithoutTrailingSemicolon = normalized.replace(/;+\s*$/, '').trim();
    if (this.looksLikePureEvalExpression(expressionWithoutTrailingSemicolon)) {
      return false;
    }

    const nonEmptyLines = normalized
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (nonEmptyLines.length > 1) {
      return true;
    }

    const scriptMarkers = [
      /[{}]/,
      /=>/,
      /\breturn\b/i,
      /^\s*[A-Za-z_][\w$]*\s*=(?!=).+$/m,
      /\bfunction\b/i,
      /\bconst\b/i,
      /\blet\b/i,
      /\bvar\b/i,
      /\bdef\b/i,
      /\bclass\b/i,
      /\bpublic\b/i,
      /\bprivate\b/i,
      /\bprotected\b/i,
      /\bstatic\b/i,
      /\bfor\s*\(/i,
      /\bfor\s+\w+\s+in\s+/i,
      /\bwhile\s*\(/i,
      /\bif\s*\(/i,
      /^\s*if\s+.+:\s*$/im,
      /\btry\b/i,
      /\bcatch\b/i,
      /\bfinally\b/i,
      /\bconsole\./i,
      /\bSystem\./,
      /\bpackage\s+[\w.]+/,
      /^\s*from\s+[\w.]+\s+import\s+/im,
      /^\s*import\s+[\w.*,\s]+$/im,
      /\bnew\s+[A-Z]\w*/
    ];

    return scriptMarkers.some((pattern) => pattern.test(normalized));
  }

  private looksLikePureEvalExpression(expression: string): boolean {
    if (!expression) {
      return false;
    }

    if (expression.includes('\\n') || expression.includes('\\r')) {
      return false;
    }

    if (expression.includes('\n') || expression.includes('\r')) {
      return false;
    }

    const normalized = expression.trim();

    const expressionPatterns = [
      /^['"`].*['"`]$/,
      /^-?\d+(\.\d+)?$/,
      /^(true|false|null)$/i,
      /^[A-Za-z_$][\w$.]*(\s*\?\s*.+\s*:\s*.+)?$/,
      /^[A-Za-z_$][\w$.]*\([^)]*\)(\s*\?\s*.+\s*:\s*.+)?$/,
      /^.+\?.+:.+$/,
      /^.+\s+if\s+.+\s+else\s+.+$/i,
      /^[A-Za-z_$][\w$.]*\s*(==|!=|===|!==|>=|<=|>|<)\s*.+(\s*\?\s*.+\s*:\s*.+)?$/,
      /^[A-Za-z_$][\w$.]*\s*(\+|-|\*|\/|%){1}\s*.+$/,
      /^\(.+\)$/
    ];

    return expressionPatterns.some((pattern) => pattern.test(normalized));
  }

  private generateSourceNodeSchema(node: SchemaNodeDraft): unknown {
    if (node.kind == 'root' || node.kind == 'object') {
      const properties: Record<string, unknown> = {};
      node.children
        .filter((child) => !child.itemModel)
        .forEach((child) => {
          properties[child.key] = this.generateSourceNodeSchema(child);
        });

      return {
        type: 'object',
        ...(node.nullable ? { nullable: true } : {}),
        properties
      };
    }

    if (node.kind == 'array') {
      const item = node.children.find((child) => child.itemModel) ?? node.children[0];
      return {
        type: 'array',
        ...(node.nullable ? { nullable: true } : {}),
        items: item ? this.generateSourceNodeSchema(item) : { type: 'object', properties: {} }
      };
    }

    return {
      type: node.type,
      ...(node.nullable ? { nullable: true } : {})
    };
  }

  private applyFormatter(value: unknown, formatter?: ConcatFormatDraft): string {
    const asText = String(value ?? '');
    if (!formatter || formatter.length <= 0) {
      return asText;
    }

    return formatter.pad == 'right'
      ? asText.padEnd(formatter.length, formatter.char || '0')
      : asText.padStart(formatter.length, formatter.char || '0');
  }

  private parseLiteralByType(type: string, value: string): unknown {
    if (type == 'integer' || type == 'number') {
      return value == '' ? null : Number(value);
    }

    if (type == 'boolean') {
      return value == 'true';
    }

    return value;
  }

  private synthesizeRuleBindings(nodes: SchemaNodeDraft[], rules: MappingRule[]): SchemaNodeDraft[] {
    if (!rules.length) {
      return nodes;
    }

    const cloned = deepClone(nodes);
    const walk = (node: SchemaNodeDraft) => {
      if (node.kind == 'field') {
        const compiled = this.compileRulesForField(node, rules);
        if (compiled) {
          node.binding = {
            ...this.createBinding(node.type),
            ...node.binding,
            mode: compiled.mode,
            evalExpression: compiled.mode == 'eval' ? compiled.expression : '',
            evalType:
              compiled.mode == 'eval' && this.shouldPersistEvalAsScript(compiled.expression)
                ? 'script'
                : undefined,
            script: compiled.mode == 'script'
              ? {
                  language: 'javascript',
                  source: compiled.expression,
                  returnType: node.type
                }
              : {
                  ...(node.binding?.script ?? { language: 'java', source: '', returnType: node.type }),
                  returnType: node.type
                }
          };
        }
      }

      node.children.forEach(walk);
    };

    cloned.forEach(walk);
    return cloned;
  }

  private compileRulesForField(
    node: SchemaNodeDraft,
    rules: MappingRule[]
  ): { mode: 'eval' | 'script'; expression: string } | null {
    const relevantRules = this.findRulesForTarget(rules, node.path);
    if (!relevantRules.length) {
      return null;
    }

    const baseExpression = this.bindingFallbackExpression(node.binding, node.type);
    let expression = baseExpression;
    let mustUseScript = false;

    for (let index = relevantRules.length - 1; index >= 0; index -= 1) {
      const rule = relevantRules[index];
      const actions = rule.actions.filter((action) => action.scope == 'target' && action.fieldPath == node.path);
      if (actions.length != 1) {
        mustUseScript = true;
        continue;
      }

      const conditionExpression = this.compileRuleConditions(rule);
      const actionExpression = this.compileRuleAction(actions[0]);
      if (!conditionExpression || !actionExpression) {
        mustUseScript = true;
        continue;
      }

      expression = this.applyRuleActionMode(actions[0], conditionExpression, actionExpression, expression);
      if (expression.length > 500) {
        mustUseScript = true;
      }
    }

    if (!expression.trim()) {
      return null;
    }

    if (!mustUseScript) {
      return {
        mode: 'eval',
        expression
      };
    }

    return {
      mode: 'script',
      expression: `return ${expression};`
    };
  }

  private findRulesForTarget(rules: MappingRule[], targetPath: string): MappingRule[] {
    return rules.filter((rule) =>
      rule.actions.some((action) => action.scope == 'target' && action.fieldPath == targetPath)
    );
  }

  private compileRuleConditions(rule: MappingRule): string {
    const parts = rule.conditions
      .map((condition) => this.compileCondition(condition))
      .filter(Boolean);

    if (!parts.length) {
      return 'true';
    }

    const joiner = rule.matchMode == 'any' ? ' || ' : ' && ';
    return parts.length == 1 ? parts[0] : `(${parts.join(joiner)})`;
  }

  private compileCondition(condition: MappingRule['conditions'][number]): string {
    const reference = this.compilePathReference(condition.scope, condition.fieldPath);
    const literal = this.toExpressionLiteral(condition.value);

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

  private compileRuleAction(action: MappingRule['actions'][number]): string {
    if (action.type == 'setLiteral') {
      return this.toExpressionLiteral(action.value);
    }

    if (action.type == 'copyField') {
      return this.compilePathReference(action.sourceScope, action.sourceFieldPath);
    }

    if (action.type == 'setExpression') {
      return action.expression.trim();
    }

    return '';
  }

  private applyRuleActionMode(
    action: MappingRule['actions'][number],
    conditionExpression: string,
    actionExpression: string,
    currentExpression: string
  ): string {
    const applicationMode = action.applicationMode ?? 'replace';

    if (applicationMode == 'fallback') {
      return this.wrapWithEmptyCheck(
        currentExpression,
        `(${conditionExpression}) ? (${actionExpression}) : (null)`
      );
    }

    if (applicationMode == 'whenEmpty') {
      return `(${conditionExpression}) && ${this.emptyValueCheck(currentExpression)} ? (${actionExpression}) : (${currentExpression})`;
    }

    return `(${conditionExpression}) ? (${actionExpression}) : (${currentExpression})`;
  }

  private wrapWithEmptyCheck(currentExpression: string, fallbackExpression: string): string {
    return `${this.emptyValueCheck(currentExpression)} ? (${fallbackExpression}) : (${currentExpression})`;
  }

  private emptyValueCheck(expression: string): string {
    return `((${expression}) == null || (${expression}) == undefined || (${expression}) === '')`;
  }

  private compilePathReference(scope: 'source' | 'target', path: string): string {
    if (!path?.trim()) {
      return 'null';
    }

    const normalized = this.schemaImport.toSchemaAliasPath(path);
    return scope == 'target' ? `target.${normalized}` : normalized;
  }

  private toExpressionLiteral(value: string): string {
    const parsed = this.parseRuleLiteral(value);
    if (parsed == null) {
      return 'null';
    }

    if (typeof parsed == 'string') {
      return JSON.stringify(parsed);
    }

    return String(parsed);
  }

  private parseRuleLiteral(value: string): string | number | boolean | null {
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

  private bindingFallbackExpression(binding: TargetBindingDraft | undefined, type: string): string {
    if (!binding) {
      return 'null';
    }

    switch (binding.mode) {
      case 'alias':
        if (!binding.sourcePaths.filter(Boolean).length) {
          return 'null';
        }

        return binding.sourcePaths.length > 1
          ? binding.sourcePaths
              .filter(Boolean)
              .map((path) => this.compilePathReference('source', path))
              .reduceRight((fallback, current) => `(${current} ?? ${fallback})`, 'null')
          : this.compilePathReference('source', binding.sourcePaths[0] ?? '');
      case 'concat':
        return binding.sourcePaths
          .filter(Boolean)
          .map((path, index) => {
            const reference = this.compilePathReference('source', path);
            const formatter = binding.formatters[index];
            if (!formatter || formatter.length <= 0) {
              return reference;
            }

            const padFunction = formatter.pad == 'right' ? 'padEnd' : 'padStart';
            return `String(${reference} ?? '').${padFunction}(${formatter.length}, ${JSON.stringify(formatter.char || '0')})`;
          })
          .join(` + ${JSON.stringify(binding.separator ?? '')} + `) || '""';
      case 'defaultLiteral':
        {
          const parsed = this.parseLiteralByType(type, binding.defaultValue);
          if (parsed == null) {
            return 'null';
          }

          return typeof parsed == 'string' ? JSON.stringify(parsed) : String(parsed);
        }
      case 'defaultSource':
        return this.compilePathReference('source', binding.defaultSourcePath);
      case 'eval':
        return binding.evalExpression?.trim() || 'null';
      case 'script':
        return 'null';
      default:
        return 'null';
    }
  }

  private createBinding(type: string): TargetBindingDraft {
    return {
      mode: 'unmapped',
      sourcePaths: [],
      aliasStrategy: 'fallback',
      separator: '',
      formatters: [],
      defaultValue: '',
      defaultSourcePath: '',
      advancedExpression: '',
      evalExpression: '',
      evalType: undefined,
      script: {
        language: 'java',
        source: '',
        returnType: type
      }
    };
  }
}






