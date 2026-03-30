import type { SchemaNodeDraft, TargetBindingDraft } from '../../core/models/mapperModels';

type BindingMode = TargetBindingDraft['mode'];

function cloneNode(node: SchemaNodeDraft): SchemaNodeDraft {
  return {
    ...node,
    binding: node.binding
      ? {
          ...node.binding,
          sourcePaths: [...node.binding.sourcePaths],
          aliasStrategy: node.binding.aliasStrategy ?? 'fallback',
          separator: node.binding.separator ?? '',
          formatters: (node.binding.formatters ?? []).map((formatter) => ({ ...formatter })),
          advancedExpression: node.binding.advancedExpression ?? '',
          script: node.binding.script ? { ...node.binding.script } : undefined
        }
      : undefined,
    mapFrom: node.mapFrom ? { sourcePaths: [...node.mapFrom.sourcePaths] } : undefined,
    children: node.children.map(cloneNode)
  };
}

function createBinding(node: SchemaNodeDraft, mode: BindingMode = 'unmapped'): TargetBindingDraft {
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
    script: {
      language: 'java',
      source: '',
      returnType: node.type
    }
  };
}

function updateNode(nodes: SchemaNodeDraft[], nodeId: string, updater: (node: SchemaNodeDraft) => void): SchemaNodeDraft[] {
  const cloned = nodes.map(cloneNode);

  const walk = (items: SchemaNodeDraft[]): boolean => {
    for (const item of items) {
      if (item.id === nodeId) {
        updater(item);
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

export function setBindingMode(nodes: SchemaNodeDraft[], nodeId: string, mode: BindingMode): SchemaNodeDraft[] {
  return updateNode(nodes, nodeId, (node) => {
    if (node.kind !== 'field') {
      return;
    }

    const current = node.binding
      ? {
          ...node.binding,
          sourcePaths: [...node.binding.sourcePaths],
          aliasStrategy: node.binding.aliasStrategy ?? 'fallback',
          separator: node.binding.separator ?? '',
          formatters: (node.binding.formatters ?? []).map((formatter) => ({ ...formatter })),
          advancedExpression: node.binding.advancedExpression ?? '',
          script: node.binding.script ? { ...node.binding.script } : undefined
        }
      : createBinding(node);
    current.mode = mode;

    if (mode === 'alias' && current.sourcePaths.length === 0) {
      current.sourcePaths = [''];
    }

    if (mode === 'concat' && current.sourcePaths.length === 0) {
      current.sourcePaths = [''];
    }

    if (mode !== 'defaultLiteral') {
      current.defaultValue = '';
    }

    if (mode !== 'defaultSource') {
      current.defaultSourcePath = '';
    }

    if (mode !== 'concat') {
      current.separator = '';
      current.formatters = [];
    }

    if (mode !== 'eval') {
      current.evalExpression = '';
      current.evalType = undefined;
    }

    if (mode === 'unmapped') {
      current.advancedExpression = '';
    }

    if (mode !== 'script') {
      current.script = {
        language: current.script?.language ?? 'java',
        source: current.script?.source ?? '',
        returnType: node.type
      };
    }

    if (mode === 'unmapped') {
      node.binding = createBinding(node, 'unmapped');
      return;
    }

    node.binding = current;
  });
}

export function setAliasSource(nodes: SchemaNodeDraft[], nodeId: string, sourcePath: string): SchemaNodeDraft[] {
  return updateNode(nodes, nodeId, (node) => {
    if (node.kind !== 'field') return;
    node.binding ??= createBinding(node, 'alias');
    node.binding.mode = 'alias';
    node.binding.aliasStrategy = 'fallback';
    node.binding.sourcePaths = sourcePath ? [sourcePath] : [];
  });
}

export function addAliasFallback(nodes: SchemaNodeDraft[], nodeId: string, sourcePath: string): SchemaNodeDraft[] {
  return updateNode(nodes, nodeId, (node) => {
    if (node.kind !== 'field' || !sourcePath) return;
    node.binding ??= createBinding(node, 'alias');
    node.binding.mode = 'alias';
    node.binding.aliasStrategy = 'fallback';
    const next = node.binding.sourcePaths.filter(Boolean);
    if (!next.includes(sourcePath)) {
      next.push(sourcePath);
    }
    node.binding.sourcePaths = next;
  });
}

export function replaceAliasFallback(nodes: SchemaNodeDraft[], nodeId: string, index: number, sourcePath: string): SchemaNodeDraft[] {
  return updateNode(nodes, nodeId, (node) => {
    if (node.kind !== 'field' || !node.binding || index < 0) return;
    node.binding.mode = 'alias';
    node.binding.aliasStrategy = 'fallback';
    const next = [...node.binding.sourcePaths];
    if (index < next.length) {
      next[index] = sourcePath;
      node.binding.sourcePaths = next.filter(Boolean);
    }
  });
}

export function removeAliasFallback(nodes: SchemaNodeDraft[], nodeId: string, index: number): SchemaNodeDraft[] {
  return updateNode(nodes, nodeId, (node) => {
    if (node.kind !== 'field' || !node.binding || index < 0) return;
    node.binding.sourcePaths = node.binding.sourcePaths.filter((_, currentIndex) => currentIndex !== index);
    if (node.binding.sourcePaths.length === 0) {
      node.binding = createBinding(node, 'unmapped');
    }
  });
}

export function updateAliasStrategy(nodes: SchemaNodeDraft[], nodeId: string, strategy: 'first' | 'fallback'): SchemaNodeDraft[] {
  return updateNode(nodes, nodeId, (node) => {
    if (node.kind !== 'field') return;
    node.binding ??= createBinding(node, 'alias');
    node.binding.mode = 'alias';
    node.binding.aliasStrategy = strategy;
  });
}

export function addConcatSource(nodes: SchemaNodeDraft[], nodeId: string, sourcePath: string): SchemaNodeDraft[] {
  return updateNode(nodes, nodeId, (node) => {
    if (node.kind !== 'field' || !sourcePath) return;
    node.binding ??= createBinding(node, 'concat');
    node.binding.mode = 'concat';
    const next = node.binding.sourcePaths.filter(Boolean);
    if (!next.includes(sourcePath)) {
      next.push(sourcePath);
    }
    node.binding.sourcePaths = next;
  });
}

export function removeConcatSource(nodes: SchemaNodeDraft[], nodeId: string, sourcePath: string): SchemaNodeDraft[] {
  return updateNode(nodes, nodeId, (node) => {
    if (node.kind !== 'field' || !node.binding) return;
    const next = node.binding.sourcePaths.filter((item) => item !== sourcePath);
    node.binding.sourcePaths = next;
    node.binding.mode = next.length > 1 ? 'concat' : next.length === 1 ? 'alias' : 'unmapped';
  });
}

export function moveConcatSource(
  nodes: SchemaNodeDraft[],
  nodeId: string,
  index: number,
  direction: -1 | 1
): SchemaNodeDraft[] {
  return updateNode(nodes, nodeId, (node) => {
    if (node.kind !== 'field' || !node.binding) return;
    const nextIndex = index + direction;
    const currentPaths = [...node.binding.sourcePaths];
    if (index < 0 || nextIndex < 0 || index >= currentPaths.length || nextIndex >= currentPaths.length) {
      return;
    }

    const [moved] = currentPaths.splice(index, 1);
    currentPaths.splice(nextIndex, 0, moved);
    node.binding.sourcePaths = currentPaths;
  });
}

export function updateConcatSeparator(nodes: SchemaNodeDraft[], nodeId: string, separator: string): SchemaNodeDraft[] {
  return updateNode(nodes, nodeId, (node) => {
    if (node.kind !== 'field') return;
    node.binding ??= createBinding(node, 'concat');
    node.binding.mode = 'concat';
    node.binding.separator = separator;
  });
}

export function updateConcatFormat(
  nodes: SchemaNodeDraft[],
  nodeId: string,
  index: number,
  patch: Partial<{ pad: 'left' | 'right'; length: number; char: string }>
): SchemaNodeDraft[] {
  return updateNode(nodes, nodeId, (node) => {
    if (node.kind !== 'field') return;
    node.binding ??= createBinding(node, 'concat');
    node.binding.mode = 'concat';
    const current = node.binding.formatters[index] ?? { id: `fmt-${index}`, pad: 'left' as const, length: 0, char: '0' };
    node.binding.formatters[index] = { ...current, ...patch };
  });
}

export function clearConcatFormat(nodes: SchemaNodeDraft[], nodeId: string, index: number): SchemaNodeDraft[] {
  return updateNode(nodes, nodeId, (node) => {
    if (node.kind !== 'field' || !node.binding) return;
    node.binding.formatters[index] = { id: `fmt-${index}`, pad: 'left', length: 0, char: '0' };
  });
}

export function setDefaultLiteral(nodes: SchemaNodeDraft[], nodeId: string, value: string): SchemaNodeDraft[] {
  return updateNode(nodes, nodeId, (node) => {
    if (node.kind !== 'field') return;
    node.binding ??= createBinding(node, 'defaultLiteral');
    node.binding.mode = 'defaultLiteral';
    node.binding.defaultValue = value;
  });
}

export function setDefaultSource(nodes: SchemaNodeDraft[], nodeId: string, sourcePath: string): SchemaNodeDraft[] {
  return updateNode(nodes, nodeId, (node) => {
    if (node.kind !== 'field') return;
    node.binding ??= createBinding(node, 'defaultSource');
    node.binding.mode = 'defaultSource';
    node.binding.defaultSourcePath = sourcePath;
  });
}

export function setEvalExpression(
  nodes: SchemaNodeDraft[],
  nodeId: string,
  expression: string,
  evalType?: 'script'
): SchemaNodeDraft[] {
  return updateNode(nodes, nodeId, (node) => {
    if (node.kind !== 'field') return;
    node.binding ??= createBinding(node, 'eval');
    node.binding.mode = 'eval';
    node.binding.evalExpression = expression;
    node.binding.evalType = evalType;
  });
}

export function setAdvancedExpression(nodes: SchemaNodeDraft[], nodeId: string, expression: string): SchemaNodeDraft[] {
  return updateNode(nodes, nodeId, (node) => {
    if (node.kind !== 'field') return;
    node.binding ??= createBinding(node, node.binding?.mode ?? 'alias');
    node.binding.advancedExpression = expression;
  });
}

export function setScriptBinding(
  nodes: SchemaNodeDraft[],
  nodeId: string,
  patch: Partial<NonNullable<TargetBindingDraft['script']>>
): SchemaNodeDraft[] {
  return updateNode(nodes, nodeId, (node) => {
    if (node.kind !== 'field') return;
    node.binding ??= createBinding(node, 'script');
    node.binding.mode = 'script';
    node.binding.script = {
      language: 'java',
      source: '',
      returnType: node.type,
      ...node.binding.script,
      ...patch
    };
  });
}

export function setMapFromSource(nodes: SchemaNodeDraft[], nodeId: string, sourcePath: string): SchemaNodeDraft[] {
  return updateNode(nodes, nodeId, (node) => {
    if (node.kind === 'field') return;
    node.mapFrom = { sourcePaths: sourcePath ? [sourcePath] : [] };
  });
}

export function detectCodeLanguage(value: string): 'javascript' | 'java' | 'python' {
  const normalized = value.replace(/\\r\\n|\\n|\\r/g, '\n');
  const trimmed = normalized.trim();

  if (
    /\bdef\b|\bNone\b|\belif\b|\bTrue\b|\bFalse\b|\bif\s+.+\s+else\b|:\s*(\n|$)|\breturn\b/m.test(trimmed) &&
    !/[{};]/.test(trimmed)
  ) {
    return 'python';
  }

  if (
    /\bString\s+\w+\s*=|\bBigDecimal\b|\bpublic\b|\bprivate\b|\bprotected\b|get[A-Z]\w+\(|new\s+[A-Z]\w+\(|System\./.test(trimmed)
  ) {
    return 'java';
  }

  return 'javascript';
}

export function shouldPersistEvalAsScript(value: string): boolean {
  const normalized = value.replace(/\\r\\n|\\n|\\r/g, '\n').trim();
  if (!normalized) {
    return false;
  }

  const looksDeclarativeTernary =
    !normalized.includes('\n') &&
    !/[{};]/.test(normalized) &&
    !/\breturn\b/.test(normalized) &&
    (/^\s*.+\?.+:.+$/.test(normalized) || /^\s*.+\sif\s.+\selse\s.+$/.test(normalized));

  if (looksDeclarativeTernary) {
    return false;
  }

  return (
    normalized.includes('\n') ||
    /\breturn\b/.test(normalized) ||
    /\bconst\b|\blet\b|\bvar\b|\bfunction\b|\bclass\b|\bfor\b|\bwhile\b|\btry\b|\bcatch\b/.test(normalized) ||
    /\bdef\b|\bimport\b|\bfrom\b.+\bimport\b|\bif\s+.+\s+else\b/.test(normalized) ||
    /\bString\s+\w+\s*=|\bBigDecimal\b|get[A-Z]\w+\(|System\./.test(normalized) ||
    /^\s*\w+\s*=/.test(normalized) ||
    /[{};]/.test(normalized)
  );
}
