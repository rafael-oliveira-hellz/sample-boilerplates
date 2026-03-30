export type FieldScope = 'source' | 'target';
export type SchemaNodeKind = 'root' | 'object' | 'array' | 'field';

export interface TypeOptionGroup {
  label: string;
  options: Array<{
    value: string;
    label: string;
  }>;
}

export const PROGRAMMING_TYPE_OPTION_GROUPS: TypeOptionGroup[] = [
  {
    label: 'Primitivos',
    options: [
      { value: 'string', label: 'string' },
      { value: 'integer', label: 'integer' },
      { value: 'number', label: 'number' },
      { value: 'long', label: 'long' },
      { value: 'float', label: 'float' },
      { value: 'double', label: 'double' },
      { value: 'decimal', label: 'decimal' },
      { value: 'boolean', label: 'boolean' }
    ]
  },
  {
    label: 'Data e identificadores',
    options: [
      { value: 'date', label: 'date' },
      { value: 'datetime', label: 'datetime' },
      { value: 'time', label: 'time' },
      { value: 'uuid', label: 'uuid' }
    ]
  },
  {
    label: 'Complexos',
    options: [
      { value: 'object', label: 'object' },
      { value: 'array', label: 'array' },
      { value: 'map', label: 'map' },
      { value: 'enum', label: 'enum' }
    ]
  }
];

export interface TargetBindingDraft {
  mode: 'unmapped' | 'alias' | 'concat' | 'defaultLiteral' | 'defaultSource' | 'eval' | 'script' | 'rule';
  sourcePaths: string[];
  aliasStrategy?: 'first' | 'fallback';
  separator: string;
  formatters: Array<{
    id: string;
    pad: 'left' | 'right';
    length: number;
    char: string;
  }>;
  defaultValue: string;
  defaultSourcePath: string;
  advancedExpression: string;
  evalExpression: string;
  evalType?: 'script';
  script?: {
    language: 'java' | 'javascript' | 'python';
    source: string;
    returnType: string;
  };
}

export type RuleOperator = '==' | '!=' | '>' | '>=' | '<' | '<=' | 'contains' | 'exists';
export type RuleActionType = 'setLiteral' | 'copyField' | 'setExpression';
export type RuleActionApplicationMode = 'replace' | 'fallback' | 'whenEmpty';

export interface RuleCondition {
  id: string;
  scope: FieldScope;
  fieldPath: string;
  operator: RuleOperator;
  value: string;
}

export interface RuleAction {
  id: string;
  scope: FieldScope;
  fieldPath: string;
  type: RuleActionType;
  applicationMode?: RuleActionApplicationMode;
  value: string;
  sourceScope: FieldScope;
  sourceFieldPath: string;
  expression: string;
}

export interface MappingRule {
  id: string;
  name: string;
  matchMode?: 'all' | 'any';
  conditions: RuleCondition[];
  actions: RuleAction[];
}

export interface MapFromDraft {
  sourcePaths: string[];
}

export interface SchemaNodeDraft {
  id: string;
  scope: FieldScope;
  key: string;
  label: string;
  path: string;
  aliasPath: string;
  displayPath: string;
  kind: SchemaNodeKind;
  type: string;
  nullable?: boolean;
  parentId: string | null;
  children: SchemaNodeDraft[];
  expanded: boolean;
  manual: boolean;
  itemModel: boolean;
  metadata?: Record<string, unknown>;
  binding?: TargetBindingDraft;
  mapFrom?: MapFromDraft;
}

export interface ImportedFileSummary {
  name: string;
  mimeType: string;
  extension: string;
  sizeLabel: string;
}

export interface SchemaPanelState {
  rawJsonText: string;
  technicalMode: boolean;
  search: string;
  selectedNodeId: string;
  error: string;
  importedFile: ImportedFileSummary | null;
}
