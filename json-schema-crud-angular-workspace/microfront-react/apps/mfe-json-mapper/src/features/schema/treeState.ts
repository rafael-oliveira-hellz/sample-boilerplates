import type { SchemaNodeDraft } from '../../core/models/mapperModels';

export function findNodeById(nodes: SchemaNodeDraft[], nodeId: string): SchemaNodeDraft | null {
  for (const node of nodes) {
    if (node.id === nodeId) return node;
    const child = findNodeById(node.children, nodeId);
    if (child) return child;
  }
  return null;
}

export function flattenLeafNodes(nodes: SchemaNodeDraft[]): SchemaNodeDraft[] {
  const items: SchemaNodeDraft[] = [];
  const walk = (node: SchemaNodeDraft): void => {
    if (node.kind === 'field') items.push(node);
    node.children.forEach(walk);
  };
  nodes.forEach(walk);
  return items;
}

export function flattenNodes(nodes: SchemaNodeDraft[]): SchemaNodeDraft[] {
  const items: SchemaNodeDraft[] = [];
  const walk = (node: SchemaNodeDraft): void => {
    if (node.kind !== 'root') items.push(node);
    node.children.forEach(walk);
  };
  nodes.forEach(walk);
  return items;
}

export function toggleNodeExpanded(nodes: SchemaNodeDraft[], nodeId: string): SchemaNodeDraft[] {
  const mutate = (node: SchemaNodeDraft): SchemaNodeDraft => ({
    ...node,
    expanded: node.id === nodeId ? !node.expanded : node.expanded,
    children: node.children.map(mutate)
  });

  return nodes.map(mutate);
}
