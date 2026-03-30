import { Injectable } from '@angular/core';
import {
    ConcatFormatDraft,
    FieldScope,
    MappingDraft,
    SchemaNodeDraft,
    TargetBindingDraft,
    TargetBindingMode
} from '@models/mapper.models';
import { deepClone, toAlias } from '@utils/mapper.utils';

@Injectable({
  providedIn: 'root'
})
export class MappingEditorService {
  findNode(nodes: SchemaNodeDraft[], nodeId: string): SchemaNodeDraft | null {
    for (const node of nodes) {
      if (node.id == nodeId) {
        return node;
      }

      const child = this.findNode(node.children, nodeId);
      if (child) {
        return child;
      }
    }

    return null;
  }

  updateNode(
    nodes: SchemaNodeDraft[],
    nodeId: string,
    updater: (node: SchemaNodeDraft, siblings: SchemaNodeDraft[]) => void
  ): SchemaNodeDraft[] {
    const cloned = deepClone(nodes);

    const walk = (items: SchemaNodeDraft[]): boolean => {
      for (const item of items) {
        if (item.id == nodeId) {
          updater(item, items);
          return true;
        }

        if (walk(item.children)) {
          return true;
        }
      }

      return false;
    };

    walk(cloned);
    return cloned;
  }

  toggleExpanded(nodes: SchemaNodeDraft[], nodeId: string): SchemaNodeDraft[] {
    return this.updateNode(nodes, nodeId, (node) => {
      node.expanded = !node.expanded;
    });
  }

  removeNode(nodes: SchemaNodeDraft[], nodeId: string): SchemaNodeDraft[] {
    const cloned = deepClone(nodes);
    return this.removeNodeRecursive(cloned, nodeId);
  }

  renameNode(nodes: SchemaNodeDraft[], nodeId: string, nextKey: string): SchemaNodeDraft[] {
    const normalizedKey = nextKey.trim();
    if (!normalizedKey) {
      return nodes;
    }

    const cloned = deepClone(nodes);
    const node = this.findNode(cloned, nodeId);
    if (!node || node.kind == 'root' || node.itemModel) {
      return nodes;
    }

    node.key = normalizedKey;
    node.label = normalizedKey;

    const parent = node.parentId ? this.findNode(cloned, node.parentId) : null;
    if (!parent) {
      return cloned;
    }

    this.rebuildSubtreePaths(node, parent);
    return cloned;
  }

  updateNodeType(nodes: SchemaNodeDraft[], nodeId: string, nextType: string): SchemaNodeDraft[] {
    const normalizedType = nextType.trim();
    if (!normalizedType) {
      return nodes;
    }

    const cloned = deepClone(nodes);
    const node = this.findNode(cloned, nodeId);
    if (!node || node.kind != 'field') {
      return nodes;
    }

    node.type = normalizedType;
    if (node.binding?.script) {
      node.binding.script.returnType = normalizedType;
    }

    return cloned;
  }

  updateNodeNullable(nodes: SchemaNodeDraft[], nodeId: string, nullable: boolean): SchemaNodeDraft[] {
    const cloned = deepClone(nodes);
    const node = this.findNode(cloned, nodeId);
    if (!node || node.kind == 'root') {
      return nodes;
    }

    node.nullable = nullable;
    return cloned;
  }

  addNode(
    nodes: SchemaNodeDraft[],
    scope: FieldScope,
    selectedNodeId: string,
    kind: 'field' | 'object' | 'array'
  ): { tree: SchemaNodeDraft[]; createdNodeId: string } {
    const cloned = deepClone(nodes);
    const selected = this.findNode(cloned, selectedNodeId) ?? cloned[0];
    const container = this.resolveContainerForInsert(cloned, selected);
    const siblingCount = container.children.length + 1;
    const keyBase = kind == 'field' ? 'novoCampo' : kind == 'array' ? 'novaLista' : 'novoObjeto';
    const key = `${keyBase}${siblingCount}`;
    const nodeId = `${container.id}.${key}`;
    const child = this.createChildNode(scope, container, kind, key, nodeId);

    container.children.push(child);
    container.expanded = true;

    return {
      tree: cloned,
      createdNodeId: child.id
    };
  }

  bindSourceDrop(
    nodes: SchemaNodeDraft[],
    targetNodeId: string,
    sourcePath: string
  ): { tree: SchemaNodeDraft[]; targetNodeId: string } {
    const cloned = deepClone(nodes);
    const targetNode = this.findNode(cloned, targetNodeId);
    if (!targetNode) {
      return { tree: nodes, targetNodeId };
    }

    let finalTarget = targetNode;
    if (targetNode.kind != 'field') {
      const container = this.resolveContainerForInsert(cloned, targetNode);
      const droppedSourcePath = this.resolveDroppedSourcePath(cloned, container, sourcePath);
      const created = this.createChildNode('target', container, 'field', toAlias(droppedSourcePath), `${targetNode.id}.${toAlias(droppedSourcePath)}`);
      created.binding = this.createBinding('alias');
      created.binding.sourcePaths = [droppedSourcePath];
      targetNode.children.push(created);
      targetNode.expanded = true;
      finalTarget = created;
    }

    finalTarget.binding ??= this.createBinding('alias');
    const droppedSourcePath = this.resolveDroppedSourcePath(cloned, finalTarget, sourcePath);

    if (finalTarget.binding.mode == 'unmapped' || finalTarget.binding.mode == 'defaultLiteral' || finalTarget.binding.mode == 'defaultSource') {
      finalTarget.binding.mode = 'alias';
      finalTarget.binding.sourcePaths = [droppedSourcePath];
      finalTarget.binding.defaultSourcePath = '';
      finalTarget.binding.defaultValue = '';
      return { tree: cloned, targetNodeId: finalTarget.id };
    }

    if (finalTarget.binding.mode == 'alias') {
      if (!finalTarget.binding.sourcePaths.includes(droppedSourcePath)) {
        finalTarget.binding.mode = 'concat';
        finalTarget.binding.sourcePaths = [...finalTarget.binding.sourcePaths, droppedSourcePath];
      }
      return { tree: cloned, targetNodeId: finalTarget.id };
    }

    if (finalTarget.binding.mode == 'concat' && !finalTarget.binding.sourcePaths.includes(droppedSourcePath)) {
      finalTarget.binding.sourcePaths = [...finalTarget.binding.sourcePaths, droppedSourcePath];
    }

    return { tree: cloned, targetNodeId: finalTarget.id };
  }

  setBindingMode(nodes: SchemaNodeDraft[], targetNodeId: string, mode: TargetBindingMode): SchemaNodeDraft[] {
    return this.updateNode(nodes, targetNodeId, (node) => {
      node.binding ??= this.createBinding('unmapped');
      node.binding.mode = mode;

      if (mode == 'alias' && node.binding.sourcePaths.length == 0) {
        node.binding.sourcePaths = [''];
      }

      if (mode == 'concat' && node.binding.sourcePaths.length == 0) {
        node.binding.sourcePaths = [''];
      }

      if (mode != 'concat') {
        node.binding.separator = mode == 'alias' ? '' : node.binding.separator;
      }

      if (mode != 'defaultLiteral') {
        node.binding.defaultValue = mode == 'defaultSource' ? node.binding.defaultValue : '';
      }

      if (mode != 'defaultSource') {
        node.binding.defaultSourcePath = '';
      }

      if (mode != 'eval') {
        node.binding.evalExpression = '';
        node.binding.evalType = undefined;
      }

      if (mode != 'script') {
        node.binding.script = {
          language: 'java',
          source: '',
          returnType: node.type
        };
      }

      if (mode == 'unmapped') {
        node.binding = this.createBinding('unmapped');
      }
    });
  }

  updateBinding(
    nodes: SchemaNodeDraft[],
    nodeId: string,
    updater: (binding: TargetBindingDraft) => void
  ): SchemaNodeDraft[] {
    return this.updateNode(nodes, nodeId, (node) => {
      node.binding ??= this.createBinding('unmapped');
      updater(node.binding);
    });
  }

  listMappedTargets(nodes: SchemaNodeDraft[]): MappingDraft[] {
    const items: MappingDraft[] = [];

    const walk = (node: SchemaNodeDraft) => {
      if (node.kind == 'field' && node.binding && node.binding.mode != 'unmapped') {
        items.push({
          id: node.id,
          targetNodeId: node.id,
          targetPath: node.displayPath,
          targetLabel: node.label,
          targetType: node.type,
          mode: node.binding.mode,
          sourcePaths: node.binding.mode == 'defaultSource'
            ? [node.binding.defaultSourcePath]
            : node.binding.sourcePaths,
          summary: this.describeBinding(node.binding)
        });
      }

      node.children.forEach(walk);
    };

    nodes.forEach(walk);
    return items;
  }

  private resolveContainerForInsert(nodes: SchemaNodeDraft[], selected: SchemaNodeDraft): SchemaNodeDraft {
    if (selected.kind == 'field') {
      return selected.parentId ? this.findNode(nodes, selected.parentId) ?? nodes[0] : nodes[0];
    }

    if (selected.kind == 'array') {
      const item = selected.children.find((child) => child.itemModel);
      if (item) {
        return item;
      }
    }

    return selected;
  }

  private resolveDroppedSourcePath(
    nodes: SchemaNodeDraft[],
    targetNode: SchemaNodeDraft,
    sourcePath: string
  ): string {
    const mapFromAncestors = this.findMapFromAncestors(nodes, targetNode);
    if (mapFromAncestors.length == 0) {
      return sourcePath;
    }

    const candidatePrefixes = this.buildMapFromCandidatePrefixes(mapFromAncestors);
      const matchedPrefix = candidatePrefixes
      .sort((left, right) => right.length - left.length)
      .find((prefix) => sourcePath == prefix || sourcePath.startsWith(`${prefix}.`));

    if (matchedPrefix) {
      if (sourcePath == matchedPrefix) {
        return '$';
      }

      const relativeSourcePath = sourcePath.slice(matchedPrefix.length + 1);
      const contextualSourcePath = this.stripTargetObjectContext(
        nodes,
        targetNode,
        mapFromAncestors[mapFromAncestors.length - 1]?.id ?? null,
        relativeSourcePath
      );

      return contextualSourcePath ? `$.${contextualSourcePath}` : '$';
    }

    return sourcePath;
  }

  private findMapFromAncestors(nodes: SchemaNodeDraft[], node: SchemaNodeDraft): SchemaNodeDraft[] {
    const ancestors: SchemaNodeDraft[] = [];
    let currentParentId = node.parentId;

    while (currentParentId) {
      const parent = this.findNode(nodes, currentParentId);
      if (!parent) {
        return ancestors;
      }

      if (parent.kind == 'array' && parent.mapFrom?.sourcePaths?.some(Boolean)) {
        ancestors.unshift(parent);
      }

      currentParentId = parent.parentId;
    }

    return ancestors;
  }

  private buildMapFromCandidatePrefixes(ancestors: SchemaNodeDraft[]): string[] {
    let prefixes: string[] = [];

    ancestors.forEach((ancestor) => {
      const sourcePaths = ancestor.mapFrom?.sourcePaths?.filter(Boolean) ?? [];
      if (sourcePaths.length == 0) {
        return;
      }

      if (prefixes.length == 0) {
        prefixes = sourcePaths.map((path) => this.ensureIndexedCollectionPath(path));
        return;
      }

      const nextPrefixes = new Set<string>();
      sourcePaths.forEach((path) => {
        nextPrefixes.add(this.ensureIndexedCollectionPath(path));

        const normalizedSegment = this.stripDollarPrefix(path);
        prefixes.forEach((prefix) => {
          nextPrefixes.add(this.ensureIndexedCollectionPath(`${prefix}.${normalizedSegment}`));
        });
      });

      prefixes = Array.from(nextPrefixes);
    });

    return prefixes;
  }

  private stripTargetObjectContext(
    nodes: SchemaNodeDraft[],
    targetNode: SchemaNodeDraft,
    nearestMapFromAncestorId: string | null,
    relativeSourcePath: string
  ): string {
    if (!nearestMapFromAncestorId) {
      return relativeSourcePath;
    }

    const objectContextSegments = this.buildTargetObjectContextSegments(nodes, targetNode, nearestMapFromAncestorId);
    if (objectContextSegments.length == 0) {
      return relativeSourcePath;
    }

    const candidates = Array.from({ length: objectContextSegments.length }, (_, index) =>
      objectContextSegments.slice(index).join('.')
    );

    for (const candidate of candidates) {
      if (relativeSourcePath == candidate) {
        return '';
      }

      if (relativeSourcePath.startsWith(`${candidate}.`)) {
        return relativeSourcePath.slice(candidate.length + 1);
      }
    }

    return relativeSourcePath;
  }

  private buildTargetObjectContextSegments(
    nodes: SchemaNodeDraft[],
    targetNode: SchemaNodeDraft,
    nearestMapFromAncestorId: string
  ): string[] {
    const segments: string[] = [];
    let currentNodeId =
      targetNode.kind == 'object' && !targetNode.itemModel
        ? targetNode.id
        : targetNode.parentId;

    while (currentNodeId && currentNodeId != nearestMapFromAncestorId) {
      const currentNode = this.findNode(nodes, currentNodeId);
      if (!currentNode) {
        break;
      }

      if (currentNode.kind == 'object' && !currentNode.itemModel) {
        segments.unshift(currentNode.key);
      }

      currentNodeId = currentNode.parentId;
    }

    return segments;
  }

  private ensureIndexedCollectionPath(path: string): string {
    return path.endsWith('[0]') ? path : `${path}[0]`;
  }

  private stripDollarPrefix(path: string): string {
    return path.replace(/^\$\./, '').replace(/^\$/, '');
  }

  private createChildNode(
    scope: FieldScope,
    parent: SchemaNodeDraft,
    kind: 'field' | 'object' | 'array',
    key: string,
    id: string
  ): SchemaNodeDraft {
    const aliasPath = parent.aliasPath ? `${parent.aliasPath}.${key}` : key;
    const displayPrefix = parent.displayPath == 'origem' || parent.displayPath == 'destino' ? '' : `${parent.displayPath}.`;
    const path = parent.path == '$' ? `$.${key}` : `${parent.path}.${key}`;
    const node: SchemaNodeDraft = {
      id,
      scope,
      key,
      label: key,
      path,
      aliasPath,
      displayPath: `${displayPrefix}${key}`,
      kind,
      type: kind == 'field' ? 'string' : kind,
      nullable: false,
      parentId: parent.id,
      children: [],
      expanded: true,
      manual: true,
      itemModel: false,
      binding: scope == 'target' && kind == 'field' ? this.createBinding('unmapped') : undefined
    };

    if (kind == 'array') {
      node.children.push({
        id: `${id}.item`,
        scope,
        key: 'item',
        label: '[item]',
        path: `${path}[0]`,
        aliasPath,
        displayPath: `${node.displayPath}[item]`,
        kind: 'object',
        type: 'object',
        nullable: false,
        parentId: node.id,
        children: [],
        expanded: true,
        manual: true,
        itemModel: true
      });
    }

    return node;
  }

  private createBinding(mode: TargetBindingMode): TargetBindingDraft {
    return {
      mode,
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
        returnType: 'string'
      }
    };
  }

  private createFormatRule(index: number): ConcatFormatDraft {
    return {
      id: `format-${index}-${Math.random().toString(36).slice(2, 8)}`,
      pad: 'left',
      length: 0,
      char: '0'
    };
  }

  private describeBinding(binding: TargetBindingDraft): string {
    switch (binding.mode) {
      case 'alias':
        return binding.sourcePaths[0] || 'Alias sem origem';
      case 'concat':
        return binding.sourcePaths.filter(Boolean).join(binding.separator || ' + ');
      case 'defaultLiteral':
        return `Default fixo: ${binding.defaultValue || '(vazio)'}`;
      case 'defaultSource':
        return `Default da origem: ${binding.defaultSourcePath || 'nao definido'}`;
      case 'eval':
        return `Eval: ${binding.evalExpression || 'sem expressao'}`;
      case 'script':
        return `Script ${binding.script?.language ?? 'java'}: ${binding.script?.source ? 'configurado' : 'vazio'}`;
      case 'rule':
        return 'Gerado por eval/script visual';
      default:
        return 'Sem mapeamento';
    }
  }

  private removeNodeRecursive(nodes: SchemaNodeDraft[], nodeId: string): SchemaNodeDraft[] {
    return nodes
      .filter((node) => node.id != nodeId)
      .map((node) => ({
        ...node,
        children: this.removeNodeRecursive(node.children, nodeId)
      }));
  }

  private rebuildSubtreePaths(node: SchemaNodeDraft, parent: SchemaNodeDraft): void {
    if (node.itemModel) {
      node.label = '[item]';
      node.path = `${parent.path}[0]`;
      node.aliasPath = parent.aliasPath;
      node.displayPath = `${parent.displayPath}[item]`;
    } else {
      node.label = node.key;
      node.path = parent.path == '$' ? `$.${node.key}` : `${parent.path}.${node.key}`;
      node.aliasPath = parent.aliasPath ? `${parent.aliasPath}.${node.key}` : node.key;
      const base = parent.displayPath == 'origem' || parent.displayPath == 'destino' ? '' : `${parent.displayPath}.`;
      node.displayPath = `${base}${node.key}`;
    }

    node.children.forEach((child) => this.rebuildSubtreePaths(child, node));
  }
}
