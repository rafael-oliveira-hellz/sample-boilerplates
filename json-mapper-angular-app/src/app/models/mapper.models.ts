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

export type TargetBindingMode =
  | 'unmapped'
  | 'alias'
  | 'concat'
  | 'defaultLiteral'
  | 'defaultSource'
  | 'eval'
  | 'script'
  | 'rule';

export interface MapperField {
  id: string;
  scope: FieldScope;
  path: string;
  xPath: string;
  alias: string;
  type: string;
  manual: boolean;
  mode?: 'payload' | 'json-schema' | 'target-schema';
  metadata?: Record<string, unknown>;
}

export interface MappingLink {
  id: string;
  sourceFieldId: string;
  targetFieldId: string;
  sourcePath: string;
  targetPath: string;
  alias: string;
  xPath: string;
  transformExpression: string;
}

export type RuleOperator =
  | '=='
  | '!='
  | '>'
  | '>='
  | '<'
  | '<='
  | 'contains'
  | 'exists';

export interface RuleCondition {
  id: string;
  scope: FieldScope;
  fieldPath: string;
  operator: RuleOperator;
  value: string;
}

export type RuleActionType = 'setLiteral' | 'copyField' | 'setExpression';
export type RuleActionApplicationMode = 'replace' | 'fallback' | 'whenEmpty';

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

export interface ManualFieldDraft {
  scope: FieldScope;
  path: string;
  type: string;
}

export interface ConcatFormatDraft {
  id: string;
  pad: 'left' | 'right';
  length: number;
  char: string;
}

export interface ScriptDraft {
  language: 'java' | 'javascript' | 'python';
  source: string;
  returnType: string;
}

export interface MapFromDraft {
  sourcePaths: string[];
  aliasStrategy: 'first' | 'fallback';
}

export interface TargetBindingDraft {
  mode: TargetBindingMode;
  sourcePaths: string[];
  aliasStrategy?: 'first' | 'fallback';
  separator: string;
  formatters: ConcatFormatDraft[];
  defaultValue: string;
  defaultSourcePath: string;
  advancedExpression: string;
  evalExpression?: string;
  evalType?: 'script';
  script?: ScriptDraft;
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
  description?: string;
  metadata?: Record<string, unknown>;
  binding?: TargetBindingDraft;
  mapFrom?: MapFromDraft;
}

export interface MappingDraft {
  id: string;
  targetNodeId: string;
  targetPath: string;
  targetLabel: string;
  targetType: string;
  mode: TargetBindingMode;
  sourcePaths: string[];
  summary: string;
}

export interface EditorDocument {
  version: 'v2';
  sourceTree: SchemaNodeDraft[];
  targetTree: SchemaNodeDraft[];
  selectedSourceNodeId: string;
  selectedTargetNodeId: string;
}

export interface PersistenceMetadataDraft {
  codigoParceiro: number | null;
  eventoParceiro: string;
  dataInicioVigencia: string;
  tipoSchema: 'origem' | 'destino';
  versaoSchema: string;
  schemaStorageField: 'schema_origem' | 'schema_destino';
}

export interface EventTypeResponse {
  id: string;
  name: string;
  description: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SpringPageResponse<T> {
  items?: T[];
  content?: T[];
  totalItems?: number;
  totalElements?: number;
  totalPages?: number;
  size?: number;
  number?: number;
  page?: number;
  hasNext?: boolean;
  hasPrevious?: boolean;
}

export interface PersistedMapperDocument {
  id?: string;
  codigo_parceiro: number;
  tipo_schema: 'origem' | 'destino';
  versao_schema: string;
  id_evento: string;
  data_inicio_vigencia: string;
  schema_origem: Record<string, unknown>;
  schema_destino: Record<string, unknown>;
}

export interface MapperConfigV1 {
  sourceJsonText: string;
  targetJsonText: string;
  sourceSchema: MapperField[];
  targetSchema: MapperField[];
  mappings: MappingLink[];
  rules: MappingRule[];
}

export interface MapperConfigV2 extends MapperConfigV1 {
  version: 'v2';
  sourceSchemaRaw: string;
  targetSchemaRaw: string;
  editorDraft: EditorDocument;
  generatedOutputSchema: Record<string, unknown>;
  persistenceMetadata: PersistenceMetadataDraft;
  persistenceDocument: PersistedMapperDocument;
  validationErrors: string[];
  metadata: {
    schemaVersion: 2;
    generatedAt: string;
  };
}

export type MapperConfig = MapperConfigV1 | MapperConfigV2;

export interface SavedConfigResponse extends PersistedMapperDocument {
  fileName?: string;
  savedAt?: string;
  config?: MapperConfig;
}
