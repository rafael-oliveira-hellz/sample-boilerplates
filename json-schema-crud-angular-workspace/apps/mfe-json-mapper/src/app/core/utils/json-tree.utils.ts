export type JsonNode = {
  key: string;
  path: string;
  type: 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null';
  value?: string;
  preview?: string;
  children?: JsonNode[];
  size?: number;
};

export function buildJsonTree(content: string): JsonNode | null {
  if (!content.trim()) {
    return null;
  }

  try {
    return buildJsonNode('root', '$', JSON.parse(content));
  } catch {
    return null;
  }
}

export function walkJsonTree(node: JsonNode, visitor: (node: JsonNode) => void): void {
  visitor(node);
  node.children?.forEach((child) => walkJsonTree(child, visitor));
}

function buildJsonNode(key: string, path: string, value: unknown): JsonNode {
  if (Array.isArray(value)) {
    return {
      key,
      path,
      type: 'array',
      size: value.length,
      preview: value.length == 0 ? '[]' : `[${value.length} item(ns)]`,
      children: value.map((item, index) => buildJsonNode(String(index), `${path}[${index}]`, item))
    };
  }

  if (value === null) {
    return {
      key,
      path,
      type: 'null',
      value: 'null'
    };
  }

  if (typeof value == 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    return {
      key,
      path,
      type: 'object',
      size: entries.length,
      preview: entries.length == 0 ? '{}' : `{${entries.length} chave(s)}`,
      children: entries.map(([childKey, childValue]) => buildJsonNode(childKey, `${path}.${childKey}`, childValue))
    };
  }

  if (typeof value == 'string') {
    return {
      key,
      path,
      type: 'string',
      value: `"${value}"`
    };
  }

  if (typeof value == 'number') {
    return {
      key,
      path,
      type: 'number',
      value: String(value)
    };
  }

  if (typeof value == 'boolean') {
    return {
      key,
      path,
      type: 'boolean',
      value: value ? 'true' : 'false'
    };
  }

  return {
    key,
    path,
    type: 'string',
    value: String(value)
  };
}
