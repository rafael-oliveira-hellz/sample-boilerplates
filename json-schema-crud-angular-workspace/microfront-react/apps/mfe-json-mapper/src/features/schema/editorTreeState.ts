import type { FieldScope, SchemaNodeDraft, TargetBindingDraft } from '../../core/models/mapperModels';
import { findNodeById } from './treeState';

type TargetBindingMode = TargetBindingDraft['mode'];

function cloneNode(node: SchemaNodeDraft): SchemaNodeDraft {
  return {
    ...node,
    binding: node.binding
      ? {
          ...node.binding,
          sourcePaths: [...node.binding.sourcePaths],
          script: node.binding.script ? { ...node.binding.script } : undefined
        }
      : undefined,
    mapFrom: node.mapFrom ? { sourcePaths: [...node.mapFrom.sourcePaths] } : undefined,
    children: node.children.map(cloneNode)
  };
}

function cloneTree(nodes: SchemaNodeDraft[]): SchemaNodeDraft[] {
  return nodes.map(cloneNode);
}

function createBinding(node: SchemaNodeDraft, mode: TargetBindingMode = 'unmapped'): TargetBindingDraft {
  return {
    mode,
    sourcePaths: [],
    defaultValue: '',
    defaultSourcePath: '',
    evalExpression: '',
    script: {
      language: 'java',
      source: '',
      returnType: node.type
    }
  };
}

function updateNode(
  nodes: SchemaNodeDraft[],
  nodeId: string,
  updater: (node: SchemaNodeDraft, siblings: SchemaNodeDraft[]) => void
): SchemaNodeDraft[] {
  const cloned = cloneTree(nodes);

  const walk = (items: SchemaNodeDraft[]): boolean => {
    for (const item of items) {
      if (item.id === nodeId) {
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

export function setAllExpanded(nodes: SchemaNodeDraft[], expanded: boolean): SchemaNodeDraft[] {
  const walk = (items: SchemaNodeDraft[]): SchemaNodeDraft[] =>
    items.map((node) => ({
      ...cloneNode(node),
      expanded,
      children: walk(node.children)
    }));

  return walk(nodes);
}

function resolveContainerForInsert(nodes: SchemaNodeDraft[], selected: SchemaNodeDraft): SchemaNodeDraft {
  if (selected.kind === 'field') {
    return selected.parentId ? findNodeById(nodes, selected.parentId) ?? nodes[0] : nodes[0];
  }

  if (selected.kind === 'array') {
    const item = selected.children.find((child) => child.itemModel);
    if (item) {
      return item;
    }
  }

  return selected;
}

function toAlias(sourcePath: string): string {
  return sourcePath.replace(/^\$\./, '').replace(/\[0\]/g, '').split('.').filter(Boolean).at(-1) ?? 'novoCampo';
}

function createChildNode(
  scope: FieldScope,
  parent: SchemaNodeDraft,
  kind: 'field' | 'object' | 'array',
  key: string,
  id: string
): SchemaNodeDraft {
  const aliasPath = parent.aliasPath ? `${parent.aliasPath}.${key}` : key;
  const displayPrefix = parent.displayPath === 'origem' || parent.displayPath === 'destino' ? '' : `${parent.displayPath}.`;
  const path = parent.path === '$' ? `$.${key}` : `${parent.path}.${key}`;

  const node: SchemaNodeDraft = {
    id,
    scope,
    key,
    label: key,
    path,
    aliasPath,
    displayPath: `${displayPrefix}${key}`,
    kind,
    type: kind === 'field' ? 'string' : kind,
    nullable: false,
    parentId: parent.id,
    children: [],
    expanded: true,
    manual: true,
    itemModel: false,
    binding: scope === 'target' && kind === 'field' ? undefined : undefined
  };

  if (scope === 'target' && kind === 'field') {
    node.binding = createBinding(node, 'unmapped');
  }

  if (kind === 'array') {
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

export function addNode(
  nodes: SchemaNodeDraft[],
  scope: FieldScope,
  selectedNodeId: string,
  kind: 'field' | 'object' | 'array'
): { tree: SchemaNodeDraft[]; createdNodeId: string } {
  const cloned = cloneTree(nodes);
  const selected = findNodeById(cloned, selectedNodeId) ?? cloned[0];
  const container = resolveContainerForInsert(cloned, selected);
  const siblingCount = container.children.length + 1;
  const keyBase = kind === 'field' ? 'novoCampo' : kind === 'array' ? 'novaLista' : 'novoObjeto';
  const key = `${keyBase}${siblingCount}`;
  const nodeId = `${container.id}.${key}`;
  const child = createChildNode(scope, container, kind, key, nodeId);

  container.children.push(child);
  container.expanded = true;

  return { tree: cloned, createdNodeId: child.id };
}

function removeNodeRecursive(nodes: SchemaNodeDraft[], nodeId: string): SchemaNodeDraft[] {
  return nodes
    .filter((node) => node.id !== nodeId)
    .map((node) => ({
      ...node,
      children: removeNodeRecursive(node.children, nodeId)
    }));
}

export function removeNode(
  nodes: SchemaNodeDraft[],
  nodeId: string
): { tree: SchemaNodeDraft[]; nextSelectedNodeId: string } {
  if (nodeId.endsWith('-root')) {
    return { tree: nodes, nextSelectedNodeId: nodeId };
  }

  const nextTree = removeNodeRecursive(cloneTree(nodes), nodeId);
  const fallback = nodeId.startsWith('source') ? 'source-root' : 'target-root';
  return { tree: nextTree, nextSelectedNodeId: fallback };
}

function rebuildSubtreePaths(node: SchemaNodeDraft, parent: SchemaNodeDraft): void {
  if (node.itemModel) {
    node.label = '[item]';
    node.path = `${parent.path}[0]`;
    node.aliasPath = parent.aliasPath;
    node.displayPath = `${parent.displayPath}[item]`;
  } else {
    node.label = node.key;
    node.path = parent.path === '$' ? `$.${node.key}` : `${parent.path}.${node.key}`;
    node.aliasPath = parent.aliasPath ? `${parent.aliasPath}.${node.key}` : node.key;
    const base = parent.displayPath === 'origem' || parent.displayPath === 'destino' ? '' : `${parent.displayPath}.`;
    node.displayPath = `${base}${node.key}`;
  }

  node.children.forEach((child) => rebuildSubtreePaths(child, node));
}

export function renameNode(nodes: SchemaNodeDraft[], nodeId: string, nextKey: string): SchemaNodeDraft[] {
  const normalizedKey = nextKey.trim();
  if (!normalizedKey) {
    return nodes;
  }

  const cloned = cloneTree(nodes);
  const node = findNodeById(cloned, nodeId);
  if (!node || node.kind === 'root' || node.itemModel) {
    return nodes;
  }

  node.key = normalizedKey;
  node.label = normalizedKey;

  const parent = node.parentId ? findNodeById(cloned, node.parentId) : null;
  if (!parent) {
    return cloned;
  }

  rebuildSubtreePaths(node, parent);
  return cloned;
}

export function updateNodeType(nodes: SchemaNodeDraft[], nodeId: string, nextType: string): SchemaNodeDraft[] {
  const normalizedType = nextType.trim();
  if (!normalizedType) {
    return nodes;
  }

  const cloned = cloneTree(nodes);
  const node = findNodeById(cloned, nodeId);
  if (!node || node.kind !== 'field') {
    return nodes;
  }

  node.type = normalizedType;
  if (node.binding?.script) {
    node.binding.script.returnType = normalizedType;
  }
  return cloned;
}

export function updateNodeNullable(nodes: SchemaNodeDraft[], nodeId: string, nullable: boolean): SchemaNodeDraft[] {
  const cloned = cloneTree(nodes);
  const node = findNodeById(cloned, nodeId);
  if (!node || node.kind === 'root') {
    return nodes;
  }
  node.nullable = nullable;
  return cloned;
}

function findMapFromAncestors(nodes: SchemaNodeDraft[], node: SchemaNodeDraft): SchemaNodeDraft[] {
  const ancestors: SchemaNodeDraft[] = [];
  let currentParentId = node.parentId;

  while (currentParentId) {
    const parent = findNodeById(nodes, currentParentId);
    if (!parent) {
      return ancestors;
    }

    if (parent.kind === 'array' && parent.mapFrom?.sourcePaths?.some(Boolean)) {
      ancestors.unshift(parent);
    }

    currentParentId = parent.parentId;
  }

  return ancestors;
}

function ensureIndexedCollectionPath(path: string): string {
  return path.endsWith('[0]') ? path : `${path}[0]`;
}

function stripDollarPrefix(path: string): string {
  return path.replace(/^\$\./, '').replace(/^\$/, '');
}

function buildMapFromCandidatePrefixes(ancestors: SchemaNodeDraft[]): string[] {
  let prefixes: string[] = [];

  ancestors.forEach((ancestor) => {
    const sourcePaths = ancestor.mapFrom?.sourcePaths?.filter(Boolean) ?? [];
    if (sourcePaths.length === 0) {
      return;
    }

    if (prefixes.length === 0) {
      prefixes = sourcePaths.map((path) => ensureIndexedCollectionPath(path));
      return;
    }

    const nextPrefixes = new Set<string>();
    sourcePaths.forEach((path) => {
      nextPrefixes.add(ensureIndexedCollectionPath(path));
      const normalizedSegment = stripDollarPrefix(path);
      prefixes.forEach((prefix) => {
        nextPrefixes.add(ensureIndexedCollectionPath(`${prefix}.${normalizedSegment}`));
      });
    });

    prefixes = Array.from(nextPrefixes);
  });

  return prefixes;
}

function buildTargetObjectContextSegments(
  nodes: SchemaNodeDraft[],
  targetNode: SchemaNodeDraft,
  nearestMapFromAncestorId: string
): string[] {
  const segments: string[] = [];
  let currentNodeId =
    targetNode.kind === 'object' && !targetNode.itemModel ? targetNode.id : targetNode.parentId;

  while (currentNodeId && currentNodeId !== nearestMapFromAncestorId) {
    const currentNode = findNodeById(nodes, currentNodeId);
    if (!currentNode) {
      break;
    }

    if (currentNode.kind === 'object' && !currentNode.itemModel) {
      segments.unshift(currentNode.key);
    }

    currentNodeId = currentNode.parentId;
  }

  return segments;
}

function stripTargetObjectContext(
  nodes: SchemaNodeDraft[],
  targetNode: SchemaNodeDraft,
  nearestMapFromAncestorId: string | null,
  relativeSourcePath: string
): string {
  if (!nearestMapFromAncestorId) {
    return relativeSourcePath;
  }

  const objectContextSegments = buildTargetObjectContextSegments(nodes, targetNode, nearestMapFromAncestorId);
  if (objectContextSegments.length === 0) {
    return relativeSourcePath;
  }

  const candidates = Array.from({ length: objectContextSegments.length }, (_, index) =>
    objectContextSegments.slice(index).join('.')
  );

  for (const candidate of candidates) {
    if (relativeSourcePath === candidate) {
      return '';
    }

    if (relativeSourcePath.startsWith(`${candidate}.`)) {
      return relativeSourcePath.slice(candidate.length + 1);
    }
  }

  return relativeSourcePath;
}

export function resolveDroppedSourcePath(nodes: SchemaNodeDraft[], targetNode: SchemaNodeDraft, sourcePath: string): string {
  const mapFromAncestors = findMapFromAncestors(nodes, targetNode);
  if (mapFromAncestors.length === 0) {
    return sourcePath;
  }

  const candidatePrefixes = buildMapFromCandidatePrefixes(mapFromAncestors);
  const matchedPrefix = candidatePrefixes
    .sort((left, right) => right.length - left.length)
    .find((prefix) => sourcePath === prefix || sourcePath.startsWith(`${prefix}.`));

  if (matchedPrefix) {
    if (sourcePath === matchedPrefix) {
      return '$';
    }

    const relativeSourcePath = sourcePath.slice(matchedPrefix.length + 1);
    const contextual = stripTargetObjectContext(
      nodes,
      targetNode,
      mapFromAncestors[mapFromAncestors.length - 1]?.id ?? null,
      relativeSourcePath
    );

    return contextual ? `$.${contextual}` : '$';
  }

  return sourcePath;
}

export function bindSourceDrop(
  nodes: SchemaNodeDraft[],
  targetNodeId: string,
  sourcePath: string
): { tree: SchemaNodeDraft[]; targetNodeId: string } {
  const cloned = cloneTree(nodes);
  const targetNode = findNodeById(cloned, targetNodeId);
  if (!targetNode) {
    return { tree: nodes, targetNodeId };
  }

  let finalTarget = targetNode;
  if (targetNode.kind !== 'field') {
    const container = resolveContainerForInsert(cloned, targetNode);
    const droppedSourcePath = resolveDroppedSourcePath(cloned, container, sourcePath);
    const alias = toAlias(droppedSourcePath);
    const created = createChildNode('target', container, 'field', alias, `${container.id}.${alias}`);
    created.binding = createBinding(created, 'alias');
    created.binding.sourcePaths = [droppedSourcePath];
    container.children.push(created);
    container.expanded = true;
    finalTarget = created;
  }

  finalTarget.binding ??= createBinding(finalTarget, 'alias');
  const droppedSourcePath = resolveDroppedSourcePath(cloned, finalTarget, sourcePath);

  if (
    finalTarget.binding.mode === 'unmapped' ||
    finalTarget.binding.mode === 'defaultLiteral' ||
    finalTarget.binding.mode === 'defaultSource'
  ) {
    finalTarget.binding.mode = 'alias';
    finalTarget.binding.sourcePaths = [droppedSourcePath];
    finalTarget.binding.defaultSourcePath = '';
    finalTarget.binding.defaultValue = '';
    return { tree: cloned, targetNodeId: finalTarget.id };
  }

  if (finalTarget.binding.mode === 'alias') {
    if (!finalTarget.binding.sourcePaths.includes(droppedSourcePath)) {
      finalTarget.binding.mode = 'concat';
      finalTarget.binding.sourcePaths = [...finalTarget.binding.sourcePaths, droppedSourcePath];
    }
    return { tree: cloned, targetNodeId: finalTarget.id };
  }

  if (finalTarget.binding.mode === 'concat' && !finalTarget.binding.sourcePaths.includes(droppedSourcePath)) {
    finalTarget.binding.sourcePaths = [...finalTarget.binding.sourcePaths, droppedSourcePath];
  }

  return { tree: cloned, targetNodeId: finalTarget.id };
}
