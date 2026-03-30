import { Injectable } from '@angular/core';
import {
  ConcatFormatDraft,
  FieldScope,
  MappingDraft,
  MappingRule,
  RuleAction,
  RuleCondition,
  SchemaNodeDraft,
  TargetBindingDraft,
  TargetBindingMode
} from '../../../core/models';
import { deepClone, toAlias } from '../../../core/utils';

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
      const created = this.createChildNode(
        'target',
        container,
        'field',
        toAlias(droppedSourcePath),
        `${container.id}.${toAlias(droppedSourcePath)}`
      );
      created.binding = this.createBinding('alias');
      created.binding.sourcePaths = [droppedSourcePath];
      container.children.push(created);
      container.expanded = true;
      finalTarget = created;
    }

    finalTarget.binding ??= this.createBinding('alias');
    const droppedSourcePath = this.resolveDroppedSourcePath(cloned, finalTarget, sourcePath);

    if (
      finalTarget.binding.mode == 'unmapped' ||
      finalTarget.binding.mode == 'defaultLiteral' ||
      finalTarget.binding.mode == 'defaultSource'
    ) {
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

  summarizeMappings(nodes: SchemaNodeDraft[]): MappingDraft[] {
    return this.listMappedTargets(nodes);
  }

  expandAll(nodes: SchemaNodeDraft[]): SchemaNodeDraft[] {
    const cloned = deepClone(nodes);
    const walk = (items: SchemaNodeDraft[]) => items.forEach((item) => {
      item.expanded = true;
      walk(item.children);
    });
    walk(cloned);
    return cloned;
  }

  collapseAll(nodes: SchemaNodeDraft[]): SchemaNodeDraft[] {
    const cloned = deepClone(nodes);
    const walk = (items: SchemaNodeDraft[]) => items.forEach((item) => {
      if (item.kind != 'field') {
        item.expanded = false;
      }
      walk(item.children);
    });
    walk(cloned);
    return cloned;
  }

  dropSourcePath(nodes: SchemaNodeDraft[], _sourceTree: SchemaNodeDraft[], sourcePath: string, targetNodeId: string): SchemaNodeDraft[] {
    return this.bindSourceDrop(nodes, targetNodeId, sourcePath).tree;
  }

  updateBindingMode(nodes: SchemaNodeDraft[], nodeId: string, mode: TargetBindingMode): SchemaNodeDraft[] {
    return this.setBindingMode(nodes, nodeId, mode);
  }

  updateBindingSourcePath(nodes: SchemaNodeDraft[], nodeId: string, sourcePath: string): SchemaNodeDraft[] {
    return this.updateBinding(nodes, nodeId, (binding) => {
      binding.mode = 'alias';
      binding.sourcePaths = sourcePath ? [sourcePath] : [];
    });
  }

  addConcatSource(nodes: SchemaNodeDraft[], nodeId: string, sourcePath: string): SchemaNodeDraft[] {
    return this.updateBinding(nodes, nodeId, (binding) => {
      binding.mode = 'concat';
      if (sourcePath && !binding.sourcePaths.includes(sourcePath)) {
        binding.sourcePaths = [...binding.sourcePaths.filter(Boolean), sourcePath];
      }
    });
  }

  removeConcatSource(nodes: SchemaNodeDraft[], nodeId: string, index: number): SchemaNodeDraft[] {
    return this.updateBinding(nodes, nodeId, (binding) => {
      const next = binding.sourcePaths.filter((_, currentIndex) => currentIndex != index);
      binding.sourcePaths = next;
      if (next.length <= 1) {
        binding.mode = next.length == 1 ? 'alias' : 'unmapped';
      }
    });
  }

  reorderConcatSource(nodes: SchemaNodeDraft[], nodeId: string, previousIndex: number, currentIndex: number): SchemaNodeDraft[] {
    return this.updateBinding(nodes, nodeId, (binding) => {
      const items = [...binding.sourcePaths];
      if (previousIndex < 0 || previousIndex >= items.length) {
        return;
      }

      const safeCurrentIndex = Math.max(0, Math.min(items.length - 1, currentIndex));
      const [moved] = items.splice(previousIndex, 1);
      items.splice(safeCurrentIndex, 0, moved);
      binding.sourcePaths = items;
    });
  }

  updateConcatSeparator(nodes: SchemaNodeDraft[], nodeId: string, separator: string): SchemaNodeDraft[] {
    return this.updateBinding(nodes, nodeId, (binding) => {
      binding.mode = 'concat';
      binding.separator = separator;
    });
  }

  updateDefaultLiteral(nodes: SchemaNodeDraft[], nodeId: string, value: string): SchemaNodeDraft[] {
    return this.updateBinding(nodes, nodeId, (binding) => {
      binding.mode = 'defaultLiteral';
      binding.defaultValue = value;
    });
  }

  updateDefaultSource(nodes: SchemaNodeDraft[], nodeId: string, sourcePath: string): SchemaNodeDraft[] {
    return this.updateBinding(nodes, nodeId, (binding) => {
      binding.mode = 'defaultSource';
      binding.defaultSourcePath = sourcePath;
    });
  }

  updateEvalExpression(nodes: SchemaNodeDraft[], nodeId: string, expression: string): SchemaNodeDraft[] {
    return this.updateBinding(nodes, nodeId, (binding) => {
      binding.mode = 'eval';
      binding.evalExpression = expression;
      binding.evalType = expression.trim() ? binding.evalType : undefined;
    });
  }

  updateScript(
    nodes: SchemaNodeDraft[],
    nodeId: string,
    language: 'java' | 'javascript' | 'python',
    source: string,
    returnType: string
  ): SchemaNodeDraft[] {
    return this.updateBinding(nodes, nodeId, (binding) => {
      binding.mode = 'script';
      binding.script = {
        language,
        source,
        returnType
      };
    });
  }

  updateAdvancedExpression(nodes: SchemaNodeDraft[], nodeId: string, expression: string): SchemaNodeDraft[] {
    return this.updateBinding(nodes, nodeId, (binding) => {
      binding.advancedExpression = expression;
    });
  }

  clearTargetFieldConfig(nodes: SchemaNodeDraft[], nodeId: string): SchemaNodeDraft[] {
    return this.updateBinding(nodes, nodeId, (binding) => {
      Object.assign(binding, this.createBinding('unmapped'));
    });
  }

  updateMapFrom(nodes: SchemaNodeDraft[], _sourceTree: SchemaNodeDraft[], nodeId: string, sourcePath: string): SchemaNodeDraft[] {
    return this.updateNode(nodes, nodeId, (node) => {
      if (node.kind == 'field') {
        return;
      }

      node.mapFrom = {
        sourcePaths: sourcePath ? [sourcePath] : [],
        aliasStrategy: 'fallback'
      };
    });
  }

  clearMapFrom(nodes: SchemaNodeDraft[], nodeId: string): SchemaNodeDraft[] {
    return this.updateNode(nodes, nodeId, (node) => {
      if (!node.mapFrom) {
        return;
      }

      node.mapFrom.sourcePaths = [];
    });
  }

  createRule(rules: MappingRule[], selectedTargetNodeId: string): MappingRule[] {
    const nextRuleId = `rule-${rules.length + 1}`;
    const defaultFieldPath = selectedTargetNodeId || '$';

    return [
      ...rules,
      {
        id: nextRuleId,
        name: `Nova regra ${rules.length + 1}`,
        matchMode: 'all',
        conditions: [
          {
            id: `${nextRuleId}-condition-1`,
            scope: 'source',
            fieldPath: '$',
            operator: '==',
            value: ''
          }
        ],
        actions: [
          {
            id: `${nextRuleId}-action-1`,
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

  removeRule(rules: MappingRule[], ruleId: string): MappingRule[] {
    return rules.filter((rule) => rule.id != ruleId);
  }

  updateRuleName(rules: MappingRule[], ruleId: string, name: string): MappingRule[] {
    return rules.map((rule) => rule.id == ruleId ? { ...rule, name } : rule);
  }

  updateRuleMatchMode(rules: MappingRule[], ruleId: string, matchMode: 'all' | 'any'): MappingRule[] {
    return rules.map((rule) => rule.id == ruleId ? { ...rule, matchMode } : rule);
  }

  addRuleCondition(rules: MappingRule[], ruleId: string): MappingRule[] {
    return rules.map((rule) =>
      rule.id == ruleId
        ? {
            ...rule,
            conditions: [
              ...rule.conditions,
              {
                id: `${ruleId}-condition-${rule.conditions.length + 1}`,
                scope: 'source',
                fieldPath: '$',
                operator: '==',
                value: ''
              }
            ]
          }
        : rule
    );
  }

  removeRuleCondition(rules: MappingRule[], ruleId: string, conditionId: string): MappingRule[] {
    return rules.map((rule) =>
      rule.id == ruleId
        ? { ...rule, conditions: rule.conditions.filter((condition) => condition.id != conditionId) }
        : rule
    );
  }

  updateRuleConditionScope(rules: MappingRule[], ruleId: string, conditionId: string, scope: 'source' | 'target'): MappingRule[] {
    return this.updateRuleCondition(rules, ruleId, conditionId, (condition) => ({ ...condition, scope }));
  }

  updateRuleConditionField(rules: MappingRule[], ruleId: string, conditionId: string, fieldPath: string): MappingRule[] {
    return this.updateRuleCondition(rules, ruleId, conditionId, (condition) => ({ ...condition, fieldPath }));
  }

  updateRuleConditionOperator(rules: MappingRule[], ruleId: string, conditionId: string, operator: RuleCondition['operator']): MappingRule[] {
    return this.updateRuleCondition(rules, ruleId, conditionId, (condition) => ({ ...condition, operator }));
  }

  updateRuleConditionValue(rules: MappingRule[], ruleId: string, conditionId: string, value: string): MappingRule[] {
    return this.updateRuleCondition(rules, ruleId, conditionId, (condition) => ({ ...condition, value }));
  }

  addRuleAction(rules: MappingRule[], ruleId: string, selectedTargetNodeId: string): MappingRule[] {
    return rules.map((rule) =>
      rule.id == ruleId
        ? {
            ...rule,
            actions: [
              ...rule.actions,
              {
                id: `${ruleId}-action-${rule.actions.length + 1}`,
                scope: 'target',
                fieldPath: selectedTargetNodeId || '$',
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

  removeRuleAction(rules: MappingRule[], ruleId: string, actionId: string): MappingRule[] {
    return rules.map((rule) =>
      rule.id == ruleId
        ? { ...rule, actions: rule.actions.filter((action) => action.id != actionId) }
        : rule
    );
  }

  updateRuleActionScope(rules: MappingRule[], ruleId: string, actionId: string, scope: 'source' | 'target'): MappingRule[] {
    return this.updateRuleAction(rules, ruleId, actionId, (action) => ({ ...action, scope }));
  }

  updateRuleActionField(rules: MappingRule[], ruleId: string, actionId: string, fieldPath: string): MappingRule[] {
    return this.updateRuleAction(rules, ruleId, actionId, (action) => ({ ...action, fieldPath }));
  }

  updateRuleActionType(rules: MappingRule[], ruleId: string, actionId: string, type: RuleAction['type']): MappingRule[] {
    return this.updateRuleAction(rules, ruleId, actionId, (action) => ({ ...action, type }));
  }

  updateRuleActionValue(rules: MappingRule[], ruleId: string, actionId: string, value: string): MappingRule[] {
    return this.updateRuleAction(rules, ruleId, actionId, (action) => ({ ...action, value }));
  }

  updateRuleActionSourceScope(rules: MappingRule[], ruleId: string, actionId: string, sourceScope: 'source' | 'target'): MappingRule[] {
    return this.updateRuleAction(rules, ruleId, actionId, (action) => ({ ...action, sourceScope }));
  }

  updateRuleActionSourceField(rules: MappingRule[], ruleId: string, actionId: string, sourceFieldPath: string): MappingRule[] {
    return this.updateRuleAction(rules, ruleId, actionId, (action) => ({ ...action, sourceFieldPath }));
  }

  updateRuleActionExpression(rules: MappingRule[], ruleId: string, actionId: string, expression: string): MappingRule[] {
    return this.updateRuleAction(rules, ruleId, actionId, (action) => ({ ...action, expression }));
  }

  private updateRuleCondition(
    rules: MappingRule[],
    ruleId: string,
    conditionId: string,
    updater: (condition: RuleCondition) => RuleCondition
  ): MappingRule[] {
    return rules.map((rule) =>
      rule.id == ruleId
        ? {
            ...rule,
            conditions: rule.conditions.map((condition) => condition.id == conditionId ? updater(condition) : condition)
          }
        : rule
    );
  }

  private updateRuleAction(
    rules: MappingRule[],
    ruleId: string,
    actionId: string,
    updater: (action: RuleAction) => RuleAction
  ): MappingRule[] {
    return rules.map((rule) =>
      rule.id == ruleId
        ? {
            ...rule,
            actions: rule.actions.map((action) => action.id == actionId ? updater(action) : action)
          }
        : rule
    );
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

    if (!matchedPrefix) {
      return sourcePath;
    }

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
