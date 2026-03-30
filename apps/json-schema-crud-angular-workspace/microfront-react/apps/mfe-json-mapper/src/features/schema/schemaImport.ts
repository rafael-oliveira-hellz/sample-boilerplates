import type { FieldScope, ImportedFileSummary, SchemaNodeDraft, TargetBindingDraft } from '../../core/models/mapperModels';

type JsonRecord = Record<string, unknown>;

function toRecord(value: unknown): JsonRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as JsonRecord) : {};
}

function isSchemaNode(value: unknown): boolean {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const record = value as JsonRecord;
  return '$schema' in record || 'properties' in record || 'items' in record || 'type' in record || 'default' in record || 'alias' in record || 'concat' in record || 'eval' in record || 'map_from' in record || 'script' in record;
}

function inferType(value: unknown, node: JsonRecord): string {
  const schemaType = node.type;

  if (Array.isArray(schemaType)) {
    return String(schemaType.find((item) => item !== 'null') ?? schemaType[0] ?? 'object');
  }
  if (typeof schemaType === 'string') {
    return schemaType;
  }
  if (Array.isArray(value) || 'items' in node) {
    return 'array';
  }
  if ('properties' in node) {
    return 'object';
  }
  if ('alias' in node || 'concat' in node || 'default' in node || 'eval' in node || 'script' in node) {
    return 'string';
  }
  if (value === null) {
    return 'null';
  }
  return typeof value === 'object' ? 'object' : typeof value;
}

function kindForType(type: string): SchemaNodeDraft['kind'] {
  if (type === 'array') return 'array';
  if (type === 'object') return 'object';
  return 'field';
}

function normalizeSourcePath(path: string): string {
  if (!path) return '$';
  return path.startsWith('$') ? path.replace(/\[item\]/g, '[0]') : `$.${path.replace(/\[item\]/g, '[0]')}`;
}

function normalizeSourcePaths(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => normalizeSourcePath(String(item)));
  if (typeof value === 'string' && value.trim()) return [normalizeSourcePath(value)];
  return [];
}

function readBinding(node: JsonRecord): TargetBindingDraft | undefined {
  if (Array.isArray(node.alias) || typeof node.alias === 'string') {
    return {
      mode: 'alias',
      sourcePaths: normalizeSourcePaths(node.alias),
      aliasStrategy: 'fallback',
      separator: '',
      formatters: [],
      defaultValue: '',
      defaultSourcePath: '',
      advancedExpression: '',
      evalExpression: ''
    };
  }
  if (node.concat && typeof node.concat === 'object') {
    const concatNode = node.concat as JsonRecord;
    return {
      mode: 'concat',
      sourcePaths: normalizeSourcePaths(concatNode.alias),
      aliasStrategy: 'fallback',
      separator: typeof concatNode.separator === 'string' ? concatNode.separator : '',
      formatters: Array.isArray(concatNode.format)
        ? concatNode.format.map((item, index) => {
            const formatter = toRecord(item);
            return {
              id: `fmt-${index}`,
              pad: formatter.pad === 'right' ? 'right' : 'left',
              length: Number(formatter.length ?? 0),
              char: typeof formatter.char === 'string' ? formatter.char : '0'
            };
          })
        : [],
      defaultValue: '',
      defaultSourcePath: '',
      advancedExpression: '',
      evalExpression: ''
    };
  }
  if (node.eval && typeof node.eval === 'object') {
    const evalNode = node.eval as JsonRecord;
    return {
      mode: 'eval',
      sourcePaths: [],
      aliasStrategy: 'fallback',
      separator: '',
      formatters: [],
      defaultValue: '',
      defaultSourcePath: '',
      advancedExpression: '',
      evalExpression: String(evalNode.alias ?? ''),
      evalType: evalNode.eval_type === 'script' ? 'script' : undefined
    };
  }
  if (node.script && typeof node.script === 'object') {
    const scriptNode = node.script as JsonRecord;
    return {
      mode: 'script',
      sourcePaths: [],
      aliasStrategy: 'fallback',
      separator: '',
      formatters: [],
      defaultValue: '',
      defaultSourcePath: '',
      advancedExpression: '',
      evalExpression: '',
      script: {
        language: scriptNode.language === 'python' ? 'python' : scriptNode.language === 'javascript' ? 'javascript' : 'java',
        source: String(scriptNode.source ?? ''),
        returnType: String(scriptNode.returnType ?? node.type ?? 'string')
      }
    };
  }
  if (node.default !== undefined) {
    const defaultValue = node.default;
    if (typeof defaultValue === 'string' && /^[a-zA-Z_]\w*(\.[a-zA-Z_]\w*)+/.test(defaultValue)) {
      return {
        mode: 'defaultSource',
        sourcePaths: [],
        aliasStrategy: 'fallback',
        separator: '',
        formatters: [],
        defaultValue: '',
        defaultSourcePath: normalizeSourcePath(defaultValue),
        advancedExpression: '',
        evalExpression: ''
      };
    }
    return {
      mode: 'defaultLiteral',
      sourcePaths: [],
      aliasStrategy: 'fallback',
      separator: '',
      formatters: [],
      defaultValue: String(defaultValue ?? ''),
      defaultSourcePath: '',
      advancedExpression: '',
      evalExpression: ''
    };
  }
  return undefined;
}

function childRuntimePath(parentPath: string, key: string): string {
  return parentPath === '$' ? `$.${key}` : `${parentPath}.${key}`;
}

function childAliasPath(parentAliasPath: string, key: string): string {
  return parentAliasPath ? `${parentAliasPath}.${key}` : key;
}

function childDisplayPath(parentDisplayPath: string, key: string): string {
  return parentDisplayPath === 'origem' || parentDisplayPath === 'destino' ? key : `${parentDisplayPath}.${key}`;
}

function buildNode(
  value: unknown,
  scope: FieldScope,
  parentId: string | null,
  path: string,
  aliasPath: string,
  displayPath: string,
  id: string,
  isRoot = false,
  key = 'root',
  itemModel = false
): SchemaNodeDraft {
  const schemaNode = toRecord(value);
  const type = inferType(value, schemaNode);
  const built: SchemaNodeDraft = {
    id,
    scope,
    key,
    label: isRoot ? (scope === 'source' ? 'Origem' : 'Destino') : itemModel ? '[item]' : key,
    path,
    aliasPath,
    displayPath: isRoot ? (scope === 'source' ? 'origem' : 'destino') : displayPath,
    kind: isRoot ? 'root' : kindForType(type),
    type,
    nullable: schemaNode.nullable === true || (Array.isArray(schemaNode.type) && schemaNode.type.includes('null')),
    parentId,
    children: [],
    expanded: true,
    manual: false,
    itemModel,
    binding: scope === 'target' && !isRoot && kindForType(type) === 'field' ? readBinding(schemaNode) : undefined,
    mapFrom:
      scope === 'target' && !isRoot && kindForType(type) !== 'field' && schemaNode.map_from && typeof schemaNode.map_from === 'object'
        ? { sourcePaths: normalizeSourcePaths((schemaNode.map_from as JsonRecord).alias) }
        : undefined
  };

  if (isSchemaNode(value)) {
    const properties = schemaNode.properties && typeof schemaNode.properties === 'object' && !Array.isArray(schemaNode.properties)
      ? (schemaNode.properties as Record<string, unknown>)
      : {};

    built.children = Object.entries(properties).map(([childKey, childValue]) =>
      buildNode(childValue, scope, built.id, childRuntimePath(path, childKey), childAliasPath(aliasPath, childKey), childDisplayPath(built.displayPath, childKey), `${built.id}.${childKey}`, false, childKey)
    );

    if (schemaNode.items !== undefined) {
      built.children.push(
        buildNode(schemaNode.items, scope, built.id, `${path}[0]`, aliasPath, `${built.displayPath}[item]`, `${built.id}.item`, false, 'item', true)
      );
    }

    return built;
  }

  return built;
}

export function parseJsonText(value: string): JsonRecord {
  const parsed = JSON.parse(value) as unknown;
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('O JSON precisa ter um objeto na raiz.');
  }
  return parsed as JsonRecord;
}

export function importSourceTree(raw: string | JsonRecord): SchemaNodeDraft[] {
  const parsed = typeof raw === 'string' ? parseJsonText(raw) : raw;
  return [buildNode(parsed, 'source', null, '$', '', '', 'source-root', true)];
}

export function importTargetTree(raw: string | JsonRecord): SchemaNodeDraft[] {
  const parsed = typeof raw === 'string' ? parseJsonText(raw) : raw;
  return [buildNode(parsed, 'target', null, '$', '', '', 'target-root', true)];
}

export function createEmptyTree(scope: FieldScope): SchemaNodeDraft[] {
  return [{
    id: `${scope}-root`,
    scope,
    key: 'root',
    label: scope === 'source' ? 'Origem' : 'Destino',
    path: '$',
    aliasPath: '',
    displayPath: scope === 'source' ? 'origem' : 'destino',
    kind: 'root',
    type: 'object',
    nullable: false,
    parentId: null,
    children: [],
    expanded: true,
    manual: false,
    itemModel: false
  }];
}

export function stringifySchema(value: unknown): string {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '{}';
  return JSON.stringify(value, null, 2);
}

export function toImportedFileSummary(file: File): ImportedFileSummary {
  const extension = file.name.includes('.') ? file.name.split('.').pop() ?? 'json' : 'json';
  const sizeLabel = file.size < 1024 ? `${file.size} B` : `${(file.size / 1024).toFixed(1)} KB`;
  return { name: file.name, mimeType: file.type || 'application/json', extension, sizeLabel };
}
