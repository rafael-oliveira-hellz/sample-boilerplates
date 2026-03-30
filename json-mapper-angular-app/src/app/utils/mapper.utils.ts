import { FieldScope, MapperField, SchemaNodeDraft } from '@models/mapper.models';

type JsonRecord = Record<string, unknown>;

interface PathToken {
  type: 'property' | 'index';
  value: string | number;
}

export interface RankedSourceSuggestion {
  source: SchemaNodeDraft;
  score: number;
}

export function safeJsonParse(value: string): unknown {
  return JSON.parse(value);
}

export function buildFieldsFromJson(
  value: unknown,
  scope: FieldScope,
  basePath = '$'
): MapperField[] {
  if (looksLikeSchemaNode(value)) {
    return buildFieldsFromSchema(value, scope, basePath, detectSchemaMode(scope, value));
  }

  return buildFieldsFromPayload(value, scope, basePath);
}

export function normalizePayloadForExecution(value: unknown, scope: FieldScope): JsonRecord {
  if (looksLikeSchemaNode(value)) {
    return buildTemplateFromSchema(value, scope) as JsonRecord;
  }

  return (deepClone(value) as JsonRecord) ?? {};
}

export function createField(
  scope: FieldScope,
  path: string,
  type: string,
  manual: boolean,
  mode: MapperField['mode'] = 'payload',
  metadata?: Record<string, unknown>
): MapperField {
  return {
    id: `${scope}:${path}`,
    scope,
    path,
    xPath: toXPath(path),
    alias: toAlias(path),
    type,
    manual,
    mode,
    metadata
  };
}

export function toXPath(path: string): string {
  return path
    .replace(/^\$/, '')
    .replace(/\[(\d+)\]/g, '/$1')
    .replace(/\./g, '/')
    .replace(/^/, '/')
    .replace(/\/+/g, '/');
}

export function toAlias(path: string): string {
  const clean = path.replace(/\[(\d+)\]/g, '_$1');
  const parts = clean.split('.').filter(Boolean);
  return parts[parts.length - 1]?.replace('$', 'root') ?? 'field';
}

export function inferType(value: unknown): string {
  if (Array.isArray(value)) {
    return 'array';
  }

  if (value == null) {
    return 'null';
  }

  return typeof value == 'object' ? 'object' : typeof value;
}

export function getValueByPath(data: unknown, path: string): unknown {
  if (!path || path == '$') {
    return data;
  }

  const tokens = parsePath(path);
  let current = data as unknown;

  for (const token of tokens) {
    if (current == null || current == undefined) {
      return undefined;
    }

    if (token.type == 'index') {
      if (!Array.isArray(current)) {
        return undefined;
      }

      current = current[token.value as number];
      continue;
    }

    current = (current as JsonRecord)[token.value as string];
  }

  return current;
}

export function setValueByPath(target: unknown, path: string, value: unknown): void {
  if (!target || typeof target != 'object' || !path || path == '$') {
    return;
  }

  const tokens = parsePath(path);
  let current = target as unknown;

  tokens.forEach((token, index) => {
    const isLast = index == tokens.length - 1;
    const nextToken = tokens[index + 1];

    if (token.type == 'property') {
      const record = current as JsonRecord;

      if (isLast) {
        record[token.value as string] = value;
        return;
      }

      const existing = record[token.value as string];
      if (existing == undefined || existing == null || typeof existing != 'object') {
        record[token.value as string] = nextToken?.type == 'index' ? [] : {};
      }

      current = record[token.value as string];
      return;
    }

    const array = current as unknown[];
    const arrayIndex = token.value as number;

    if (!Array.isArray(array)) {
      return;
    }

    if (isLast) {
      array[arrayIndex] = value;
      return;
    }

    if (array[arrayIndex] == undefined || array[arrayIndex] == null || typeof array[arrayIndex] != 'object') {
      array[arrayIndex] = nextToken?.type == 'index' ? [] : {};
    }

    current = array[arrayIndex];
  });
}

export function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function rankSuggestedSources(
  target: SchemaNodeDraft | null,
  sourceOptions: SchemaNodeDraft[],
  limit = 5
): RankedSourceSuggestion[] {
  if (!target || target.kind != 'field') {
    return [];
  }

  const targetTokens = tokenizeSuggestionText(`${target.key} ${target.displayPath}`);

  return [...sourceOptions]
    .map((source) => ({
      source,
      score: computeSuggestionScore(target, targetTokens, source)
    }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score || left.source.displayPath.localeCompare(right.source.displayPath))
    .slice(0, limit);
}

export interface TransformContext {
  source: Record<string, unknown>;
  target: Record<string, unknown>;
  currentValue: unknown;
  currentSourcePath: string;
  currentTargetPath: string;
}

export function evaluateExpression(expression: string, context: TransformContext): unknown {
  const safeExpression = expression.trim();
  if (!safeExpression) {
    return context.currentValue;
  }

  const helpers = {
    src: (path: string) => getValueByPath(context.source, normalizeAliasPath(path)),
    out: (path: string) => getValueByPath(context.target, normalizeAliasPath(path)),
    value: context.currentValue,
    upper: (input: unknown) => String(input ?? '').toUpperCase(),
    lower: (input: unknown) => String(input ?? '').toLowerCase(),
    trim: (input: unknown) => String(input ?? '').trim(),
    concat: (...args: unknown[]) => args.map((item) => String(item ?? '')).join(''),
    coalesce: (...args: unknown[]) => args.find((item) => item != undefined && item != null && item != ''),
    replace: (input: unknown, search: string, replacement: string) =>
      String(input ?? '').replaceAll(search, replacement),
    substring: (input: unknown, start: number, end?: number) =>
      String(input ?? '').substring(start, end),
    toNumber: (input: unknown) => Number(input),
    toString: (input: unknown) => String(input ?? ''),
    sum: (...args: unknown[]) => args.reduce<number>((total, item) => total + Number(item ?? 0), 0),
    multiply: (...args: unknown[]) => args.reduce<number>((total, item) => total * Number(item ?? 1), 1),
    divide: (left: unknown, right: unknown) => Number(left ?? 0) / Number(right ?? 1),
    padLeft: (input: unknown, length: number, char = '0') => String(input ?? '').padStart(length, char),
    padRight: (input: unknown, length: number, char = '0') => String(input ?? '').padEnd(length, char),
    today: () => new Date().toISOString(),
    path: {
      source: context.currentSourcePath,
      target: context.currentTargetPath
    }
  };

  const scopeEntries = collectExpressionScope(context, helpers);
  const helperEntries = Object.entries(helpers);
  const parameterNames = [...helperEntries.map(([key]) => key), ...scopeEntries.map(([key]) => key)];
  const parameterValues = [...helperEntries.map(([, value]) => value), ...scopeEntries.map(([, value]) => value)];

  const fn = new Function(...parameterNames, buildExpressionBody(safeExpression));
  return fn(...parameterValues) as unknown;
}

function buildFieldsFromPayload(value: unknown, scope: FieldScope, basePath: string): MapperField[] {
  const fields: MapperField[] = [];

  const visit = (current: unknown, currentPath: string) => {
    fields.push(createField(scope, currentPath, inferType(current), false, 'payload'));

    if (Array.isArray(current)) {
      current.forEach((item, index) => visit(item, `${currentPath}[${index}]`));
      return;
    }

    if (current != null && typeof current == 'object') {
      Object.entries(current as JsonRecord).forEach(([key, item]) => {
        const nextPath = currentPath == '$' ? `$.${key}` : `${currentPath}.${key}`;
        visit(item, nextPath);
      });
    }
  };

  visit(value, basePath);
  return fields;
}

function buildFieldsFromSchema(
  value: unknown,
  scope: FieldScope,
  basePath: string,
  mode: MapperField['mode']
): MapperField[] {
  const fields: MapperField[] = [];

  const visitNode = (node: unknown, currentPath: string) => {
    const schemaNode = normalizeSchemaNode(node);
    const fieldType = inferSchemaType(schemaNode);
    const metadata = buildSchemaMetadata(schemaNode);

    fields.push(createField(scope, currentPath, fieldType, false, mode, metadata));

    const properties = getSchemaProperties(schemaNode);
    Object.entries(properties).forEach(([key, child]) => {
      const nextPath = currentPath == '$' ? `$.${key}` : `${currentPath}.${key}`;
      visitNode(child, nextPath);
    });

    const items = getSchemaItems(schemaNode);
    if (items != undefined) {
      visitNode(items, `${currentPath}[0]`);
    }
  };

  visitNode(value, basePath);
  return fields;
}

function normalizeSchemaNode(node: unknown): JsonRecord {
  return node != null && typeof node == 'object' ? (node as JsonRecord) : {};
}

function getSchemaProperties(node: JsonRecord): Record<string, unknown> {
  const properties = node['properties'];
  return properties != null && typeof properties == 'object' ? (properties as Record<string, unknown>) : {};
}

function getSchemaItems(node: JsonRecord): unknown {
  return node['items'];
}

function buildSchemaMetadata(node: JsonRecord): Record<string, unknown> | undefined {
  const metadata: Record<string, unknown> = {};

  if ('default' in node) {
    metadata['default'] = node['default'];
  }

  if ('alias' in node) {
    metadata['alias'] = node['alias'];
  }

  if ('format' in node) {
    metadata['format'] = node['format'];
  }

  if (node['concat'] && typeof node['concat'] == 'object') {
    metadata['concat'] = node['concat'];
  }

  if (node['description']) {
    metadata['description'] = node['description'];
  }

  return Object.keys(metadata).length > 0 ? metadata : undefined;
}

function looksLikeSchemaNode(value: unknown): boolean {
  if (value == null || typeof value != 'object' || Array.isArray(value)) {
    return false;
  }

  const node = value as JsonRecord;
  return (
    '$schema' in node ||
    'properties' in node ||
    'items' in node ||
    'type' in node ||
    'default' in node ||
    'alias' in node ||
    'concat' in node ||
    'format' in node
  );
}

function detectSchemaMode(scope: FieldScope, value: unknown): MapperField['mode'] {
  if (scope == 'target' && looksLikeTargetSchema(value)) {
    return 'target-schema';
  }

  return 'json-schema';
}

export function looksLikeTargetSchema(value: unknown): boolean {
  if (value == null || typeof value != 'object' || Array.isArray(value)) {
    return false;
  }

  const stack: unknown[] = [value];
  while (stack.length > 0) {
    const current = stack.pop();
    if (current == null || typeof current != 'object') {
      continue;
    }

    const record = current as JsonRecord;
    if (Object.hasOwn(record, 'alias') || Object.hasOwn(record, 'concat')) {
      return true;
    }

    Object.values(record).forEach((item) => stack.push(item));
  }

  return false;
}

function inferSchemaType(node: JsonRecord): string {
  const schemaType = node['type'];

  if (Array.isArray(schemaType)) {
    return String(schemaType.find((item) => item != 'null') ?? schemaType[0] ?? 'object');
  }

  if (typeof schemaType == 'string') {
    return schemaType;
  }

  if ('properties' in node) {
    return 'object';
  }

  if ('items' in node) {
    return 'array';
  }

  if ('concat' in node || 'alias' in node || 'default' in node) {
    return 'string';
  }

  return 'object';
}

function buildTemplateFromSchema(node: unknown, scope: FieldScope): unknown {
  const schemaNode = normalizeSchemaNode(node);
  const fieldType = inferSchemaType(schemaNode);

  if (fieldType == 'object') {
    const result: JsonRecord = {};
    Object.entries(getSchemaProperties(schemaNode)).forEach(([key, child]) => {
      result[key] = buildTemplateFromSchema(child, scope);
    });
    return result;
  }

  if (fieldType == 'array') {
    const itemTemplate = buildTemplateFromSchema(getSchemaItems(schemaNode), scope);
    return [itemTemplate];
  }

  if (scope == 'target') {
    if (schemaNode['default'] != undefined && !looksLikeAliasReference(schemaNode['default'])) {
      return schemaNode['default'];
    }

    if (schemaNode['concat'] && typeof schemaNode['concat'] == 'object') {
      return '';
    }
  }

  return defaultValueForType(fieldType);
}

function defaultValueForType(type: string): unknown {
  switch (type) {
    case 'string':
      return '';
    case 'integer':
    case 'number':
      return null;
    case 'boolean':
      return false;
    default:
      return null;
  }
}

function looksLikeAliasReference(value: unknown): boolean {
  return typeof value == 'string' && /^[a-zA-Z_]\w*(\.[a-zA-Z_]\w*)+/.test(value);
}

function parsePath(path: string): PathToken[] {
  const normalized = path.replace(/^\$\./, '').replace(/^\$/, '');
  if (!normalized) {
    return [];
  }

  const rawSegments = normalized.split('.');
  const tokens: PathToken[] = [];

  rawSegments.forEach((segment) => {
    const regex = /([^[\]]+)|\[(\d+)\]/g;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(segment)) != null) {
      if (match[1]) {
        tokens.push({ type: 'property', value: match[1] });
      } else if (match[2]) {
        tokens.push({ type: 'index', value: Number(match[2]) });
      }
    }
  });

  return tokens;
}

function normalizeAliasPath(path: string): string {
  return path.startsWith('$') ? path : `$.${path}`;
}

function buildExpressionBody(expression: string): string {
  if (looksLikeStatementBlock(expression)) {
    return expression;
  }

  return `return (${expression});`;
}

function looksLikeStatementBlock(expression: string): boolean {
  return /(?:^|[\s;])(return|var|let|const|for|while|if|switch|try)\b/.test(expression) || expression.includes(';');
}

function collectExpressionScope(
  context: TransformContext,
  helpers: Record<string, unknown>
): Array<[string, unknown]> {
  const scope = Object.create(null) as Record<string, unknown>;
  const helperKeys = new Set(Object.keys(helpers));

  const assignRecord = (value: unknown) => {
    if (value == null || typeof value != 'object' || Array.isArray(value)) {
      return;
    }

    Object.entries(value as Record<string, unknown>).forEach(([key, entryValue]) => {
      if (helperKeys.has(key) || !isValidExpressionIdentifier(key)) {
        return;
      }

      scope[key] = entryValue;
    });
  };

  assignRecord(context.source);
  assignRecord(context.currentValue);

  return Object.entries(scope);
}

function isValidExpressionIdentifier(value: string): boolean {
  return /^[A-Za-z_$][\w$]*$/.test(value);
}

function tokenizeSuggestionText(value: string): string[] {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[\s.\-_:[\]()]+/)
    .map((token) => token.trim().toLowerCase())
    .filter((token) => token.length > 1);
}

function computeSuggestionScore(
  target: SchemaNodeDraft,
  targetTokens: string[],
  source: SchemaNodeDraft
): number {
  const sourceKey = source.key.toLowerCase();
  const sourcePath = source.displayPath.toLowerCase();
  const normalizedTargetKey = target.key.toLowerCase();
  const sourceTokens = new Set(tokenizeSuggestionText(`${source.key} ${source.displayPath}`));

  let score = 0;

  if (sourceKey == normalizedTargetKey) {
    score += 10;
  }

  if (sourcePath.endsWith(normalizedTargetKey)) {
    score += 6;
  }

  if (normalizedTargetKey && sourcePath.includes(normalizedTargetKey)) {
    score += 4;
  }

  targetTokens.forEach((token) => {
    if (sourceTokens.has(token)) {
      score += 3;
    } else if (sourcePath.includes(token)) {
      score += 1;
    }
  });

  if (target.type == source.type) {
    score += 2;
  }

  return score;
}
