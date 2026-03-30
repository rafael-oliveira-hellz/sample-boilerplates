import { Injectable } from '@angular/core';
import {
    FieldScope,
    MapperField,
    SchemaNodeDraft,
    TargetBindingDraft
} from '@models/mapper.models';
import { createField, safeJsonParse } from '@utils/mapper.utils';

type JsonRecord = Record<string, unknown>;

interface ParsedImport {
  raw: JsonRecord;
  schemaUri: string;
}

@Injectable({
  providedIn: 'root'
})
export class SchemaImportService {
  createEmptyTree(scope: FieldScope): SchemaNodeDraft[] {
    if (scope == 'source') {
      return [this.createEmptyRootNode('source', 'source-root', 'Origem', 'origem')];
    }

    return [this.createEmptyRootNode('target', 'target-root', 'Destino', 'destino')];
  }

  parseJsonText(value: string): ParsedImport {
    const parsed = safeJsonParse(value);

    if (parsed == null || typeof parsed != 'object' || Array.isArray(parsed)) {
      throw new Error('O JSON precisa ter um objeto na raiz.');
    }

    const raw = parsed as JsonRecord;
    return {
      raw,
      schemaUri: typeof raw['$schema'] == 'string' ? raw['$schema'] : ''
    };
  }

  importSourceTree(raw: JsonRecord): SchemaNodeDraft[] {
    return [this.buildSourceNode(raw, 'source', null, '$', '', '', 'source-root', true)];
  }

  importTargetTree(raw: JsonRecord): SchemaNodeDraft[] {
    return [this.buildTargetNode(raw, null, '$', '', '', 'target-root', true)];
  }

  flattenFields(nodes: SchemaNodeDraft[], scope: FieldScope): MapperField[] {
    const fields: MapperField[] = [];

    const walk = (node: SchemaNodeDraft) => {
      if (node.kind == 'field') {
        fields.push(
          createField(
            scope,
            node.path,
            node.type,
            node.manual,
            scope == 'target' ? 'target-schema' : 'json-schema',
            node.metadata
          )
        );
      }

      node.children.forEach(walk);
    };

    nodes.forEach(walk);
    return fields;
  }

  flattenLeafNodes(nodes: SchemaNodeDraft[]): SchemaNodeDraft[] {
    const leaves: SchemaNodeDraft[] = [];

    const walk = (node: SchemaNodeDraft) => {
      if (node.kind == 'field') {
        leaves.push(node);
      }

      node.children.forEach(walk);
    };

    nodes.forEach(walk);
    return leaves;
  }

  flattenNodes(nodes: SchemaNodeDraft[]): SchemaNodeDraft[] {
    const items: SchemaNodeDraft[] = [];

    const walk = (node: SchemaNodeDraft) => {
      if (node.kind != 'root') {
        items.push(node);
      }

      node.children.forEach(walk);
    };

    nodes.forEach(walk);
    return items;
  }

  normalizeSourcePath(path: string): string {
    if (!path) {
      return '$';
    }

    return path.startsWith('$') ? path.replace(/\[item\]/g, '[0]') : `$.${path.replace(/\[item\]/g, '[0]')}`;
  }

  toSchemaAliasPath(path: string): string {
    return path.replace(/^\$\./, '').replace(/^\$/, '').replace(/\[0\]/g, '');
  }

  private buildSourceNode(
    node: unknown,
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
    const schemaNode = this.toRecord(node);
    const type = this.inferType(node, schemaNode);
    const label = isRoot ? 'Origem' : itemModel ? '[item]' : key;
    const metadata = this.extractMetadata(schemaNode);
    const built: SchemaNodeDraft = {
      id,
      scope,
      key,
      label,
      path,
      aliasPath,
      displayPath: isRoot ? 'origem' : displayPath,
      kind: isRoot ? 'root' : this.kindForType(type),
      type,
      nullable: this.isNullable(schemaNode),
      parentId,
      children: [],
      expanded: true,
      manual: false,
      itemModel,
      metadata,
      description: typeof schemaNode['description'] == 'string' ? schemaNode['description'] : undefined
    };

    if (this.isSchemaNode(node)) {
      const properties = this.getProperties(schemaNode);
      built.children = Object.entries(properties).map(([childKey, childValue]) =>
        this.buildSourceNode(
          childValue,
          scope,
          built.id,
          this.childRuntimePath(path, childKey),
          this.childAliasPath(aliasPath, childKey),
          this.childDisplayPath(built.displayPath, childKey),
          `${built.id}.${childKey}`,
          false,
          childKey
        )
      );

      const items = schemaNode['items'];
      if (items != undefined) {
        built.children.push(
          this.buildSourceNode(
            items,
            scope,
            built.id,
            `${path}[0]`,
            aliasPath,
            `${built.displayPath}[item]`,
            `${built.id}.item`,
            false,
            'item',
            true
          )
        );
      }

      return built;
    }

    if (Array.isArray(node)) {
      const firstItem = node[0] ?? {};
      built.children = [
        this.buildSourceNode(
          firstItem,
          scope,
          built.id,
          `${path}[0]`,
          aliasPath,
          `${built.displayPath}[item]`,
          `${built.id}.item`,
          false,
          'item',
          true
        )
      ];
      return built;
    }

    if (node != null && typeof node == 'object') {
      built.children = Object.entries(node as JsonRecord).map(([childKey, childValue]) =>
        this.buildSourceNode(
          childValue,
          scope,
          built.id,
          this.childRuntimePath(path, childKey),
          this.childAliasPath(aliasPath, childKey),
          this.childDisplayPath(built.displayPath, childKey),
          `${built.id}.${childKey}`,
          false,
          childKey
        )
      );
    }

    return built;
  }

  private buildTargetNode(
    node: unknown,
    parentId: string | null,
    path: string,
    aliasPath: string,
    displayPath: string,
    id: string,
    isRoot = false,
    key = 'root',
    itemModel = false
  ): SchemaNodeDraft {
    const schemaNode = this.toRecord(node);
    const type = this.inferType(node, schemaNode);
    const label = isRoot ? 'Destino' : itemModel ? '[item]' : key;
    const metadata = this.extractMetadata(schemaNode);
    const built: SchemaNodeDraft = {
      id,
      scope: 'target',
      key,
      label,
      path,
      aliasPath,
      displayPath: isRoot ? 'destino' : displayPath,
      kind: isRoot ? 'root' : this.kindForType(type),
      type,
      nullable: this.isNullable(schemaNode),
      parentId,
      children: [],
      expanded: true,
      manual: false,
      itemModel,
      metadata,
      description: typeof schemaNode['description'] == 'string' ? schemaNode['description'] : undefined,
      binding: !isRoot && this.kindForType(type) == 'field' ? this.readBinding(schemaNode, type) : undefined,
      mapFrom: !isRoot && this.kindForType(type) != 'field' ? this.readMapFrom(schemaNode) : undefined
    };

    if (this.isSchemaNode(node)) {
      const properties = this.getProperties(schemaNode);
      built.children = Object.entries(properties).map(([childKey, childValue]) =>
        this.buildTargetNode(
          childValue,
          built.id,
          this.childRuntimePath(path, childKey),
          this.childAliasPath(aliasPath, childKey),
          this.childDisplayPath(built.displayPath, childKey),
          `${built.id}.${childKey}`,
          false,
          childKey
        )
      );

      const items = schemaNode['items'];
      if (items != undefined) {
        built.children.push(
          this.buildTargetNode(
            items,
            built.id,
            `${path}[0]`,
            aliasPath,
            `${built.displayPath}[item]`,
            `${built.id}.item`,
            false,
            'item',
            true
          )
        );
      }

      return built;
    }

    if (Array.isArray(node)) {
      const firstItem = node[0] ?? {};
      built.children = [
        this.buildTargetNode(
          firstItem,
          built.id,
          `${path}[0]`,
          aliasPath,
          `${built.displayPath}[item]`,
          `${built.id}.item`,
          false,
          'item',
          true
        )
      ];
      return built;
    }

    if (node != null && typeof node == 'object') {
      built.children = Object.entries(node as JsonRecord).map(([childKey, childValue]) =>
        this.buildTargetNode(
          childValue,
          built.id,
          this.childRuntimePath(path, childKey),
          this.childAliasPath(aliasPath, childKey),
          this.childDisplayPath(built.displayPath, childKey),
          `${built.id}.${childKey}`,
          false,
          childKey
        )
      );
    }

    return built;
  }

  private readBinding(node: JsonRecord, type: string): TargetBindingDraft {
    if (Array.isArray(node['alias']) || typeof node['alias'] == 'string') {
      return {
        mode: 'alias',
        sourcePaths: this.normalizeSourcePaths(node['alias']),
        aliasStrategy: 'fallback',
        separator: '',
        formatters: [],
        defaultValue: '',
        defaultSourcePath: '',
        advancedExpression: '',
        evalExpression: '',
        script: this.createScriptDraft(type)
      };
    }

    if (node['concat'] && typeof node['concat'] == 'object') {
      const concat = node['concat'] as JsonRecord;
      return {
        mode: 'concat',
        sourcePaths: this.normalizeSourcePaths(concat['alias']),
        aliasStrategy: 'fallback',
        separator: typeof concat['separator'] == 'string' ? concat['separator'] : '',
        formatters: Array.isArray(concat['format'])
          ? concat['format'].map((item, index) => ({
              id: `fmt-${index}`,
              pad: (item as JsonRecord)['pad'] == 'right' ? 'right' : 'left',
              length: Number((item as JsonRecord)['length'] ?? 0),
              char: String((item as JsonRecord)['char'] ?? '0')
            }))
          : [],
        defaultValue: '',
        defaultSourcePath: '',
        advancedExpression: '',
        evalExpression: '',
        script: this.createScriptDraft(type)
      };
    }

    if (node['eval'] && typeof node['eval'] == 'object') {
      const evalNode = node['eval'] as JsonRecord;
      return {
        mode: 'eval',
        sourcePaths: [],
        aliasStrategy: 'fallback',
        separator: '',
        formatters: [],
        defaultValue: '',
        defaultSourcePath: '',
        advancedExpression: '',
        evalExpression: String(evalNode['alias'] ?? ''),
        evalType: evalNode['eval_type'] == 'script' ? 'script' : undefined,
        script: this.createScriptDraft(type)
      };
    }

    if (node['script'] && typeof node['script'] == 'object') {
      const scriptNode = node['script'] as JsonRecord;
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
          language:
            scriptNode['language'] == 'javascript'
              ? 'javascript'
              : scriptNode['language'] == 'python'
                ? 'python'
                : 'java',
          source: String(scriptNode['source'] ?? ''),
          returnType: String(scriptNode['returnType'] ?? scriptNode['resultType'] ?? type)
        }
      };
    }

    if (node['default'] != undefined) {
      const defaultValue = node['default'];
      if (typeof defaultValue == 'string' && /^[a-zA-Z_]\w*(\.[a-zA-Z_]\w*)+/.test(defaultValue)) {
        return {
          mode: 'defaultSource',
          sourcePaths: [],
          aliasStrategy: 'fallback',
          separator: '',
          formatters: [],
          defaultValue: '',
          defaultSourcePath: this.normalizeSourcePath(defaultValue),
          advancedExpression: '',
          evalExpression: '',
          script: this.createScriptDraft(type)
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
        evalExpression: '',
        script: this.createScriptDraft(type)
      };
    }

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
      script: this.createScriptDraft(type)
    };
  }

  private normalizeSourcePaths(value: unknown): string[] {
    if (Array.isArray(value)) {
      return value.map((item) => this.normalizeSourcePath(String(item)));
    }

    if (typeof value == 'string' && value.trim()) {
      return [this.normalizeSourcePath(value)];
    }

    return [];
  }

  private readMapFrom(node: JsonRecord) {
    if (!node['map_from'] || typeof node['map_from'] != 'object') {
      return undefined;
    }

    const mapFromNode = node['map_from'] as JsonRecord;
    return {
      sourcePaths: this.normalizeSourcePaths(mapFromNode['alias']),
      aliasStrategy: 'fallback' as const
    };
  }

  private isSchemaNode(value: unknown): boolean {
    if (value == null || typeof value != 'object' || Array.isArray(value)) {
      return false;
    }

    const record = value as JsonRecord;
    return (
      '$schema' in record ||
      'properties' in record ||
      'items' in record ||
      'type' in record ||
      'default' in record ||
      'alias' in record ||
      'concat' in record ||
      'eval' in record ||
      'map_from' in record ||
      'script' in record ||
      'format' in record
    );
  }

  private toRecord(value: unknown): JsonRecord {
    return value != null && typeof value == 'object' && !Array.isArray(value)
      ? (value as JsonRecord)
      : {};
  }

  private getProperties(node: JsonRecord): Record<string, unknown> {
    const properties = node['properties'];
    return properties != null && typeof properties == 'object' && !Array.isArray(properties)
      ? (properties as Record<string, unknown>)
      : {};
  }

  private inferType(value: unknown, node: JsonRecord): string {
    const schemaType = node['type'];

    if (Array.isArray(schemaType)) {
      return String(schemaType.find((item) => item != 'null') ?? schemaType[0] ?? 'object');
    }

    if (typeof schemaType == 'string') {
      return schemaType;
    }

    if (Array.isArray(value)) {
      return 'array';
    }

    if (value == null) {
      return 'null';
    }

    if ('items' in node) {
      return 'array';
    }

    if ('properties' in node) {
      return 'object';
    }

    if ('alias' in node || 'concat' in node || 'default' in node || 'eval' in node || 'script' in node) {
      return 'string';
    }

    return typeof value == 'object' ? 'object' : typeof value;
  }

  private kindForType(type: string): SchemaNodeDraft['kind'] {
    if (type == 'array') {
      return 'array';
    }

    if (type == 'object') {
      return 'object';
    }

    return 'field';
  }

  private extractMetadata(node: JsonRecord): Record<string, unknown> | undefined {
    const metadata: Record<string, unknown> = {};

    if (this.isNullable(node)) {
      metadata['nullable'] = true;
    }

    if ('default' in node) {
      metadata['default'] = node['default'];
    }

    if ('alias' in node) {
      metadata['alias'] = node['alias'];
    }

    if ('format' in node) {
      metadata['format'] = node['format'];
    }

    if ('concat' in node) {
      metadata['concat'] = node['concat'];
    }

    if ('eval' in node) {
      metadata['eval'] = node['eval'];
    }

    if ('map_from' in node) {
      metadata['map_from'] = node['map_from'];
    }

    if ('script' in node) {
      metadata['script'] = node['script'];
    }

    return Object.keys(metadata).length > 0 ? metadata : undefined;
  }

  private createScriptDraft(type: string) {
    return {
      language: 'java' as const,
      source: '',
      returnType: type
    };
  }

  private isNullable(node: JsonRecord): boolean {
    if (node['nullable'] === true) {
      return true;
    }

    const schemaType = node['type'];
    return Array.isArray(schemaType) && schemaType.includes('null');
  }

  private childRuntimePath(parentPath: string, key: string): string {
    return parentPath == '$' ? `$.${key}` : `${parentPath}.${key}`;
  }

  private childAliasPath(parentAliasPath: string, key: string): string {
    return parentAliasPath ? `${parentAliasPath}.${key}` : key;
  }

  private childDisplayPath(parentDisplayPath: string, key: string): string {
    if (parentDisplayPath == 'origem' || parentDisplayPath == 'destino') {
      return key;
    }

    return `${parentDisplayPath}.${key}`;
  }

  private createEmptyRootNode(
    scope: FieldScope,
    id: string,
    label: string,
    displayPath: string
  ): SchemaNodeDraft {
    return {
      id,
      scope,
      key: 'root',
      label,
      path: '$',
      aliasPath: '',
      displayPath,
      kind: 'root',
      type: 'object',
      nullable: false,
      parentId: null,
      children: [],
      expanded: true,
      manual: false,
      itemModel: false
    };
  }
}
