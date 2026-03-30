import { Injectable, computed, inject, signal } from '@angular/core';
import { ConfigApiService } from '@app/services/config-api.service';
import { MappingEditorService } from '@app/services/mapping-editor.service';
import { SchemaGeneratorService } from '@app/services/schema-generator.service';
import { SchemaImportService } from '@app/services/schema-import.service';
import {
    EventTypeResponse,
    EditorDocument,
    MapperConfig,
    MapperConfigV1,
    MapperConfigV2,
    MapperField,
    MappingDraft,
    MappingLink,
    MappingRule,
    PersistenceMetadataDraft,
    RuleAction,
    RuleCondition,
    RuleOperator,
    SavedConfigResponse,
    SchemaNodeDraft,
    TargetBindingMode
} from '@models/mapper.models';
import { rankSuggestedSources, toXPath } from '@utils/mapper.utils';
import { catchError, of } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class MapperFacadeService {
  private readonly configApi = inject(ConfigApiService);
  private readonly schemaImport = inject(SchemaImportService);
  private readonly mappingEditor = inject(MappingEditorService);
  private readonly schemaGenerator = inject(SchemaGeneratorService);

  readonly operators: RuleOperator[] = ['==', '!=', '>', '>=', '<', '<=', 'contains', 'exists'];
  readonly bindingModes: Array<{ id: TargetBindingMode; label: string }> = [
    { id: 'alias', label: 'Alias' },
    { id: 'concat', label: 'Concat' },
    { id: 'defaultLiteral', label: 'Default fixo' },
    { id: 'defaultSource', label: 'Default da origem' },
    { id: 'eval', label: 'Eval' },
    { id: 'script', label: 'Script' }
  ];

  readonly sourceJsonText = signal('');
  readonly targetJsonText = signal('');
  readonly persistenceMetadata = signal<PersistenceMetadataDraft>({
    codigoParceiro: 1001,
    eventoParceiro: '',
    dataInicioVigencia: '',
    tipoSchema: 'destino',
    versaoSchema: 'v1',
    schemaStorageField: 'schema_destino'
  });
  readonly sourceSchemaUri = signal('https://json-schema.org/draft/2020-12/schema');
  readonly targetSchemaUri = signal('http://json-schema.org/draft-04/schema#');

  readonly sourceTree = signal<SchemaNodeDraft[]>(this.schemaImport.createEmptyTree('source'));
  readonly targetTree = signal<SchemaNodeDraft[]>(this.schemaImport.createEmptyTree('target'));
  readonly selectedSourceNodeId = signal('');
  readonly selectedTargetNodeId = signal('');
  readonly dragSourcePath = signal('');

  readonly rules = signal<MappingRule[]>([]);
  readonly sourceError = signal('');
  readonly targetError = signal('');
  readonly saveStatus = signal('');
  readonly saveError = signal('');
  readonly lastSavedResponse = signal<SavedConfigResponse | null>(null);
  readonly isSaving = signal(false);
  readonly isLoadingLatest = signal(false);
  readonly isLoadingEventTypes = signal(false);
  readonly eventTypes = signal<EventTypeResponse[]>([]);
  readonly eventTypesError = signal('');
  readonly eventTypesPage = signal(0);
  readonly eventTypesHasNext = signal(false);
  readonly eventTypeSearchTerm = signal('');
  readonly eventTypeQuery = signal('');

  readonly sourceFields = computed<MapperField[]>(() =>
    this.schemaImport.flattenFields(this.sourceTree(), 'source')
  );
  readonly targetFields = computed<MapperField[]>(() =>
    this.schemaImport.flattenFields(this.targetTree(), 'target')
  );
  readonly sourceLeafOptions = computed(() => this.schemaImport.flattenLeafNodes(this.sourceTree()));
  readonly sourceNodeOptions = computed(() => this.schemaImport.flattenNodes(this.sourceTree()));
  readonly targetLeafOptions = computed(() => this.schemaImport.flattenLeafNodes(this.targetTree()));
  readonly mappedTargets = computed<MappingDraft[]>(() =>
    this.mappingEditor.listMappedTargets(this.targetTree())
  );
  readonly mappedTargetIds = computed(() => new Set(this.mappedTargets().map((item) => item.targetNodeId)));
  readonly emptyTargetIds = computed(
    () =>
      new Set(
        this.targetLeafOptions()
          .filter((node) => this.isEmptyTarget(node))
          .map((node) => node.id)
      )
  );
  readonly ruleTargetIds = computed(
    () =>
      new Set(
        this.targetLeafOptions()
          .filter((node) =>
            this.rules().some((rule) =>
              rule.actions.some((action) => action.scope == 'target' && action.fieldPath == node.path)
            )
          )
          .map((node) => node.id)
      )
  );
  readonly errorTargetIds = computed(
    () =>
      new Set(
        this.targetLeafOptions()
          .filter((node) => this.hasValidationIssue(node))
          .map((node) => node.id)
      )
  );
  readonly mappings = computed<MappingLink[]>(() =>
    this.mappedTargets().map((mapping) => ({
      id: mapping.id,
      sourceFieldId: `source:${mapping.sourcePaths[0] ?? '$'}`,
      targetFieldId: `target:${mapping.targetPath}`,
      sourcePath: mapping.sourcePaths[0] ?? '$',
      targetPath: this.selectedTargetNode()?.path ?? '$',
      alias: mapping.targetLabel,
      xPath: toXPath(this.findTargetNode(mapping.targetNodeId)?.path ?? '$'),
      transformExpression:
        this.findTargetNode(mapping.targetNodeId)?.binding?.advancedExpression ?? ''
    }))
  );

  readonly selectedSourceNode = computed(
    () => this.findNode(this.sourceTree(), this.selectedSourceNodeId()) ?? this.sourceTree()[0] ?? null
  );
  readonly selectedTargetNode = computed(
    () => this.findNode(this.targetTree(), this.selectedTargetNodeId()) ?? this.targetTree()[0] ?? null
  );
  readonly selectedTargetRuleCount = computed(() => {
    const selected = this.selectedTargetNode();
    if (!selected || selected.kind != 'field') {
      return 0;
    }

    return this.rules().filter((rule) =>
      rule.actions.some((action) => action.scope == 'target' && action.fieldPath == selected.path)
    ).length;
  });
  readonly selectedTargetHasVisualRule = computed(() => this.selectedTargetRuleCount() > 0);
  readonly selectedMapping = computed<MappingLink | null>(() => {
    const selected = this.selectedTargetNode();
    if (!selected || selected.kind != 'field' || !selected.binding || selected.binding.mode == 'unmapped') {
      return null;
    }

    return {
      id: selected.id,
      sourceFieldId: `source:${selected.binding.sourcePaths[0] ?? '$'}`,
      targetFieldId: `target:${selected.path}`,
      sourcePath: selected.binding.sourcePaths[0] ?? '$',
      targetPath: selected.path,
      alias: selected.label,
      xPath: toXPath(selected.path),
      transformExpression: selected.binding.advancedExpression
    };
  });

  readonly validationErrors = computed(() => this.schemaGenerator.collectValidationErrors(this.targetTree(), this.rules()));
  readonly reviewCounts = computed(() => ({
    empty: this.targetLeafOptions().filter((node) => this.isEmptyTarget(node)).length,
    rule: this.ruleTargetIds().size,
    error: this.targetLeafOptions().filter((node) => this.hasValidationIssue(node)).length
  }));
  readonly generatedOutputSchema = computed(() =>
    this.schemaGenerator.generateTargetSchema(this.targetTree(), this.rules(), this.targetSchemaUri())
  );
  readonly generatedSourceSchema = computed(() =>
    this.schemaGenerator.generateSourceSchema(this.sourceTree(), this.sourceSchemaUri())
  );
  readonly generatedTargetSchemaText = computed(() =>
    JSON.stringify(this.generatedOutputSchema(), null, 2)
  );
  readonly previewJson = computed(() => {
    try {
      return this.schemaGenerator.buildPreviewPayload(
        this.sourceJsonText(),
        this.targetTree(),
        this.rules(),
        this.targetSchemaUri()
      );
    } catch (error) {
      return JSON.stringify(
        {
          error: 'Falha ao gerar preview',
          detail: error instanceof Error ? error.message : 'Erro inesperado'
        },
        null,
        2
      );
    }
  });
  readonly editorDocument = computed<EditorDocument>(() => ({
    version: 'v2',
    sourceTree: this.sourceTree(),
    targetTree: this.targetTree(),
    selectedSourceNodeId: this.selectedSourceNodeId(),
    selectedTargetNodeId: this.selectedTargetNodeId()
  }));
  readonly persistenceDocument = computed(() => {
    const metadata = this.persistenceMetadata();
    const sourceSchema = this.resolvePersistedSchema(this.sourceJsonText(), this.generatedSourceSchema());
    const targetSchema = this.generatedOutputSchema();

    return {
      codigo_parceiro: metadata.codigoParceiro ?? 0,
      tipo_schema: metadata.tipoSchema,
      versao_schema: metadata.versaoSchema,
      id_evento: metadata.eventoParceiro,
      data_inicio_vigencia: this.normalizeStartDate(metadata.dataInicioVigencia),
      schema_origem: sourceSchema,
      schema_destino: targetSchema
    };
  });
  readonly persistenceDocumentJson = computed(() => JSON.stringify(this.persistenceDocument(), null, 2));
  readonly selectedEventTypeLabel = computed(() => {
    const selectedEventTypeId = this.persistenceMetadata().eventoParceiro;
    if (!selectedEventTypeId) {
      return '';
    }

    return this.eventTypes().find((option) => option.id == selectedEventTypeId)?.name ?? selectedEventTypeId;
  });
  readonly eventTypeOptions = computed(() => {
    const options = this.eventTypes();
    const selectedEventTypeId = this.persistenceMetadata().eventoParceiro;

    if (!selectedEventTypeId || options.some((option) => option.id == selectedEventTypeId)) {
      return options;
    }

    return [
      {
        id: selectedEventTypeId,
        name: this.selectedEventTypeLabel(),
        description: '',
        active: true,
        createdAt: '',
        updatedAt: ''
      },
      ...options
    ];
  });
  readonly exportFileBase = computed(() => {
    const metadata = this.persistenceMetadata();
    return [
      metadata.codigoParceiro,
      metadata.eventoParceiro,
      metadata.dataInicioVigencia,
      metadata.tipoSchema,
      metadata.versaoSchema
    ]
      .map((part) => String(part ?? '').trim())
      .filter(Boolean)
      .join('_');
  });
  readonly exportedConfig = computed(() => JSON.stringify(this.buildConfig(), null, 2));
  readonly usedSourcePaths = computed(() => {
    const paths = new Set<string>();

    this.mappedTargets().forEach((mapping) => {
      mapping.sourcePaths.filter(Boolean).forEach((path) => paths.add(path));
    });

    this.rules().forEach((rule) => {
      rule.conditions.forEach((condition) => {
        if (condition.scope == 'source') {
          paths.add(condition.fieldPath);
        }
      });
      rule.actions.forEach((action) => {
        if (action.sourceScope == 'source') {
          paths.add(action.sourceFieldPath);
        }
      });
    });

    return paths;
  });

  constructor() {
    this.selectedSourceNodeId.set(this.sourceTree()[0]?.id ?? '');
    this.selectedTargetNodeId.set(this.targetTree()[0]?.id ?? '');
  }

  updateSourceJsonText(value: string): void {
    this.sourceJsonText.set(value);
  }

  updateTargetJsonText(value: string): void {
    this.targetJsonText.set(value);
  }

  importSourceSchemaFromText(value: string): void {
    this.sourceJsonText.set(value);
    this.importSourceSchema();
  }

  importTargetSchemaFromText(value: string): void {
    this.targetJsonText.set(value);
    this.importTargetSchema();
  }

  updatePersistenceMetadata(patch: Partial<PersistenceMetadataDraft>): void {
    const normalizedPatch = { ...patch };
    if (normalizedPatch.codigoParceiro !== undefined) {
      normalizedPatch.codigoParceiro =
        typeof normalizedPatch.codigoParceiro == 'number' && Number.isInteger(normalizedPatch.codigoParceiro)
          ? normalizedPatch.codigoParceiro
          : null;
    }
    if (normalizedPatch.tipoSchema && !normalizedPatch.schemaStorageField) {
      normalizedPatch.schemaStorageField = normalizedPatch.tipoSchema == 'destino'
        ? 'schema_destino'
        : 'schema_origem';
    }

    this.persistenceMetadata.update((current) => ({
      ...current,
      ...normalizedPatch
    }));
  }

  loadEventTypes(): void {
    this.eventTypeQuery.set('');
    this.fetchEventTypes(1, true);
  }

  loadMoreEventTypes(): void {
    if (!this.eventTypesHasNext() || this.isLoadingEventTypes()) {
      return;
    }

    this.fetchEventTypes(this.eventTypesPage() + 1, false);
  }

  updateEventTypeSearchTerm(value: string): void {
    this.eventTypeSearchTerm.set(value);
  }

  searchEventTypes(): void {
    this.eventTypeQuery.set(this.eventTypeSearchTerm().trim());
    this.fetchEventTypes(1, true);
  }

  selectEventType(id: string): void {
    this.updatePersistenceMetadata({ eventoParceiro: id });
    const selectedOption = this.eventTypes().find((option) => option.id == id);
    this.eventTypeSearchTerm.set(selectedOption?.name ?? '');
  }

  private fetchEventTypes(page: number, reset: boolean): void {
    this.isLoadingEventTypes.set(true);
    if (reset) {
      this.eventTypesError.set('');
    }

    this.configApi.loadEventTypes(page, 100, this.eventTypeQuery())
      .pipe(
        catchError((error) => {
          const message =
            typeof error?.error?.message == 'string' && error.error.message.trim()
              ? error.error.message.trim()
              : 'Nao foi possivel carregar os eventos.';
          if (reset) {
            this.eventTypes.set([]);
            this.eventTypesPage.set(0);
            this.eventTypesHasNext.set(false);
          }
          this.eventTypesError.set(message);
          this.isLoadingEventTypes.set(false);
          return of({
            items: [] as EventTypeResponse[],
            page: reset ? 1 : this.eventTypesPage(),
            hasNext: false
          });
        })
      )
      .subscribe((response) => {
        const nextItems = Array.isArray(response.items) ? response.items : [];
        this.eventTypes.update((current) => {
          const baseItems = reset ? [] : current;
          const mergedItems = [...baseItems];
          nextItems.forEach((item) => {
            if (!mergedItems.some((currentItem) => currentItem.id == item.id)) {
              mergedItems.push(item);
            }
          });
          return mergedItems;
        });
        this.eventTypesPage.set(typeof response.page == 'number' ? response.page : page);
        this.eventTypesHasNext.set(response.hasNext === true);
        if (!this.eventTypeSearchTerm().trim()) {
          this.eventTypeSearchTerm.set(this.selectedEventTypeLabel());
        }
        this.isLoadingEventTypes.set(false);
      });
  }

  importSourceSchema(): void {
    if (!this.sourceJsonText().trim()) {
      this.sourceError.set('');
      const emptyTree = this.schemaImport.createEmptyTree('source');
      this.sourceTree.set(emptyTree);
      this.selectedSourceNodeId.set(emptyTree[0]?.id ?? '');
      return;
    }

    try {
      this.sourceError.set('');
      const parsed = this.schemaImport.parseJsonText(this.sourceJsonText());
      this.sourceSchemaUri.set(parsed.schemaUri || this.sourceSchemaUri());
      const tree = this.schemaImport.importSourceTree(parsed.raw);
      this.sourceTree.set(tree);
      this.selectedSourceNodeId.set(tree[0]?.id ?? '');
      this.syncSourceText();
    } catch (error) {
      this.sourceError.set(error instanceof Error ? error.message : 'Falha ao importar origem.');
    }
  }

  importTargetSchema(): void {
    if (!this.targetJsonText().trim()) {
      this.targetError.set('');
      const emptyTree = this.schemaImport.createEmptyTree('target');
      this.targetTree.set(emptyTree);
      this.selectedTargetNodeId.set(emptyTree[0]?.id ?? '');
      return;
    }

    try {
      this.targetError.set('');
      const parsed = this.schemaImport.parseJsonText(this.targetJsonText());
      this.targetSchemaUri.set(parsed.schemaUri || this.targetSchemaUri());
      const tree = this.schemaImport.importTargetTree(parsed.raw);
      this.targetTree.set(tree);
      this.selectedTargetNodeId.set(tree[0]?.id ?? '');
      this.syncTargetText();
    } catch (error) {
      this.targetError.set(error instanceof Error ? error.message : 'Falha ao importar destino.');
    }
  }

  selectSourceNode(nodeId: string): void {
    this.selectedSourceNodeId.set(nodeId);
  }

  selectTargetNode(nodeId: string): void {
    this.selectedTargetNodeId.set(nodeId);
  }

  toggleSourceNode(nodeId: string): void {
    this.sourceTree.set(this.mappingEditor.toggleExpanded(this.sourceTree(), nodeId));
  }

  toggleTargetNode(nodeId: string): void {
    this.targetTree.set(this.mappingEditor.toggleExpanded(this.targetTree(), nodeId));
    this.syncTargetText();
  }

  expandAllSourceNodes(): void {
    this.sourceTree.set(this.setExpandedState(this.sourceTree(), true));
  }

  collapseAllSourceNodes(): void {
    this.sourceTree.set(this.setExpandedState(this.sourceTree(), false));
  }

  expandAllTargetNodes(): void {
    this.targetTree.set(this.setExpandedState(this.targetTree(), true));
  }

  collapseAllTargetNodes(): void {
    this.targetTree.set(this.setExpandedState(this.targetTree(), false));
    this.syncTargetText();
  }

  addSourceNode(kind: 'field' | 'object' | 'array'): void {
    const result = this.mappingEditor.addNode(
      this.sourceTree(),
      'source',
      this.selectedSourceNodeId() || this.sourceTree()[0]?.id || '',
      kind
    );
    this.sourceTree.set(result.tree);
    this.selectedSourceNodeId.set(result.createdNodeId);
    this.syncSourceText();
  }

  addTargetNode(kind: 'field' | 'object' | 'array'): void {
    const result = this.mappingEditor.addNode(
      this.targetTree(),
      'target',
      this.selectedTargetNodeId() || this.targetTree()[0]?.id || '',
      kind
    );
    this.targetTree.set(result.tree);
    this.selectedTargetNodeId.set(result.createdNodeId);
    this.syncTargetText();
  }

  renameSourceNode(value: string): void {
    this.sourceTree.set(this.mappingEditor.renameNode(this.sourceTree(), this.selectedSourceNodeId(), value));
    this.syncSourceText();
  }

  updateSourceNodeType(value: string): void {
    this.sourceTree.set(this.mappingEditor.updateNodeType(this.sourceTree(), this.selectedSourceNodeId(), value));
    this.syncSourceText();
  }

  updateSourceNodeNullable(value: boolean): void {
    this.sourceTree.set(this.mappingEditor.updateNodeNullable(this.sourceTree(), this.selectedSourceNodeId(), value));
    this.syncSourceText();
  }

  renameTargetNode(value: string): void {
    this.targetTree.set(this.mappingEditor.renameNode(this.targetTree(), this.selectedTargetNodeId(), value));
    this.syncTargetText();
  }

  updateTargetNodeType(value: string): void {
    this.targetTree.set(this.mappingEditor.updateNodeType(this.targetTree(), this.selectedTargetNodeId(), value));
    this.syncTargetText();
  }

  updateTargetNodeNullable(value: boolean): void {
    this.targetTree.set(this.mappingEditor.updateNodeNullable(this.targetTree(), this.selectedTargetNodeId(), value));
    this.syncTargetText();
  }

  removeSourceNode(): void {
    const selected = this.selectedSourceNode();
    if (!selected || selected.kind == 'root') {
      return;
    }

    this.sourceTree.set(this.mappingEditor.removeNode(this.sourceTree(), selected.id));
    this.selectedSourceNodeId.set(this.sourceTree()[0]?.id ?? '');
    this.syncSourceText();
  }

  removeTargetNode(): void {
    const selected = this.selectedTargetNode();
    if (!selected || selected.kind == 'root') {
      return;
    }

    this.targetTree.set(this.mappingEditor.removeNode(this.targetTree(), selected.id));
    this.selectedTargetNodeId.set(this.targetTree()[0]?.id ?? '');
    this.syncTargetText();
  }

  startDraggingSource(path: string): void {
    this.dragSourcePath.set(path);
  }

  clearDraggingSource(): void {
    this.dragSourcePath.set('');
  }

  updateSelectedMapFromSource(path: string): void {
    const selected = this.selectedTargetNode();
    if (!selected || selected.kind == 'field') {
      return;
    }

    this.targetTree.set(
      this.mappingEditor.updateNode(this.targetTree(), selected.id, (node) => {
        node.mapFrom ??= {
          sourcePaths: [],
          aliasStrategy: 'fallback'
        };
        node.mapFrom.sourcePaths = path ? [path] : [];
      })
    );
    this.syncTargetText();
  }

  dropOnTargetNode(targetNodeId: string): void {
    if (!this.dragSourcePath()) {
      return;
    }

    const result = this.mappingEditor.bindSourceDrop(this.targetTree(), targetNodeId, this.dragSourcePath());
    this.targetTree.set(result.tree);
    this.selectedTargetNodeId.set(result.targetNodeId);
    this.clearDraggingSource();
    this.syncTargetText();
  }

  setSelectedBindingMode(mode: TargetBindingMode): void {
    const selected = this.selectedTargetNode();
    if (!selected || selected.kind != 'field') {
      return;
    }

    this.targetTree.set(this.mappingEditor.setBindingMode(this.targetTree(), selected.id, mode));
    this.syncTargetText();
  }

  clearSelectedBinding(): void {
    this.setSelectedBindingMode('unmapped');
  }

  navigateReviewQueue(kind: 'empty' | 'rule' | 'error', direction: -1 | 1): void {
    const queue = this.targetLeafOptions().filter((node) => {
      switch (kind) {
        case 'empty':
          return this.isEmptyTarget(node);
        case 'rule':
          return this.ruleTargetIds().has(node.id);
        case 'error':
          return this.hasValidationIssue(node);
      }
    });

    if (queue.length == 0) {
      return;
    }

    const currentIndex = queue.findIndex((node) => node.id == this.selectedTargetNodeId());
    const nextIndex = currentIndex == -1
      ? 0
      : (currentIndex + direction + queue.length) % queue.length;

    this.selectTargetNode(queue[nextIndex].id);
  }

  applySuggestedMappingToSelectedTarget(): void {
    const selected = this.selectedTargetNode();
    if (!selected || selected.kind != 'field') {
      return;
    }

    const suggestion = rankSuggestedSources(selected, this.sourceLeafOptions(), 1)[0]?.source;
    if (!suggestion) {
      return;
    }

    this.targetTree.set(
      this.mappingEditor.updateBinding(this.targetTree(), selected.id, (binding) => {
        binding.mode = 'alias';
        binding.sourcePaths = [suggestion.path];
        binding.defaultValue = '';
        binding.defaultSourcePath = '';
        binding.separator = '';
        binding.formatters = [];
      })
    );
    this.syncTargetText();
  }

  applySuggestedMappingsToEmptyTargets(): void {
    let nextTree = this.targetTree();

    this.targetLeafOptions().forEach((target) => {
      const node = this.mappingEditor.findNode(nextTree, target.id);
      if (!node || node.kind != 'field' || (node.binding && node.binding.mode != 'unmapped')) {
        return;
      }

      const suggestion = rankSuggestedSources(node, this.sourceLeafOptions(), 1)[0]?.source;
      if (!suggestion) {
        return;
      }

      nextTree = this.mappingEditor.updateBinding(nextTree, node.id, (binding) => {
        binding.mode = 'alias';
        binding.sourcePaths = [suggestion.path];
        binding.defaultValue = '';
        binding.defaultSourcePath = '';
        binding.separator = '';
        binding.formatters = [];
      });
    });

    this.targetTree.set(nextTree);
    this.syncTargetText();
  }

  setSelectedAliasSource(path: string): void {
    this.updateSelectedBinding((binding) => {
      binding.mode = 'alias';
      binding.sourcePaths = [path];
    });
  }

  setSelectedDefaultLiteral(value: string): void {
    this.updateSelectedBinding((binding) => {
      binding.mode = 'defaultLiteral';
      binding.defaultValue = value;
    });
  }

  setSelectedDefaultSource(path: string): void {
    this.updateSelectedBinding((binding) => {
      binding.mode = 'defaultSource';
      binding.defaultSourcePath = path;
    });
  }

  updateSelectedEvalExpression(expression: string): void {
    this.updateSelectedBinding((binding) => {
      binding.mode = 'eval';
      binding.evalExpression = expression;
      binding.evalType = this.schemaGenerator.shouldPersistEvalAsScript(expression) ? 'script' : undefined;
    });
  }

  updateSelectedScriptLanguage(language: 'java' | 'javascript' | 'python'): void {
    this.updateSelectedBinding((binding) => {
      binding.mode = 'script';
      binding.script = {
        ...(binding.script ?? { language: 'java', source: '', returnType: this.selectedTargetNode()?.type ?? 'string' }),
        language
      };
    });
  }

  updateSelectedScriptSource(source: string): void {
    this.updateSelectedBinding((binding) => {
      binding.mode = 'script';
      binding.script = {
        ...(binding.script ?? { language: 'java', source: '', returnType: this.selectedTargetNode()?.type ?? 'string' }),
        source
      };
    });
  }

  updateSelectedScriptReturnType(returnType: string): void {
    this.updateSelectedBinding((binding) => {
      binding.mode = 'script';
      binding.script = {
        ...(binding.script ?? { language: 'java', source: '', returnType }),
        returnType
      };
    });
  }

  updateSelectedAliasStrategy(strategy: 'first' | 'fallback'): void {
    this.updateSelectedBinding((binding) => {
      binding.aliasStrategy = strategy;
    });
  }

  addAliasFallback(path: string): void {
    this.updateSelectedBinding((binding) => {
      binding.mode = 'alias';
      if (!binding.sourcePaths.includes(path)) {
        binding.sourcePaths = [...binding.sourcePaths.filter(Boolean), path];
      }
    });
  }

  removeAliasFallback(index: number): void {
    this.updateSelectedBinding((binding) => {
      binding.sourcePaths = binding.sourcePaths.filter((_, currentIndex) => currentIndex != index);
      if (binding.sourcePaths.length == 0) {
        binding.mode = 'unmapped';
      }
    });
  }

  replaceAliasFallback(index: number, path: string): void {
    this.updateSelectedBinding((binding) => {
      binding.mode = 'alias';
      binding.sourcePaths[index] = path;
    });
  }

  addConcatSource(path: string): void {
    this.updateSelectedBinding((binding) => {
      binding.mode = 'concat';
      binding.sourcePaths = [...binding.sourcePaths.filter(Boolean), path];
    });
  }

  removeConcatSource(index: number): void {
    this.updateSelectedBinding((binding) => {
      binding.sourcePaths = binding.sourcePaths.filter((_, currentIndex) => currentIndex != index);
      binding.formatters = binding.formatters.filter((_, currentIndex) => currentIndex != index);
      if (binding.sourcePaths.length <= 1) {
        binding.mode = binding.sourcePaths.length == 1 ? 'alias' : 'unmapped';
      }
    });
  }

  replaceConcatSource(index: number, path: string): void {
    this.updateSelectedBinding((binding) => {
      if (index < 0 || index >= binding.sourcePaths.length) {
        return;
      }

      binding.mode = 'concat';
      binding.sourcePaths[index] = path;
    });
  }

  moveConcatSource(index: number, direction: -1 | 1): void {
    this.updateSelectedBinding((binding) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= binding.sourcePaths.length) {
        return;
      }

      [binding.sourcePaths[index], binding.sourcePaths[nextIndex]] = [
        binding.sourcePaths[nextIndex],
        binding.sourcePaths[index]
      ];
      [binding.formatters[index], binding.formatters[nextIndex]] = [
        binding.formatters[nextIndex],
        binding.formatters[index]
      ];
    });
  }

  reorderConcatSource(fromIndex: number, toIndex: number): void {
    this.updateSelectedBinding((binding) => {
      const normalizedToIndex = Math.min(toIndex, binding.sourcePaths.length - 1);
      if (
        fromIndex < 0 ||
        normalizedToIndex < 0 ||
        fromIndex >= binding.sourcePaths.length ||
        normalizedToIndex >= binding.sourcePaths.length ||
        fromIndex == normalizedToIndex
      ) {
        return;
      }

      const [path] = binding.sourcePaths.splice(fromIndex, 1);
      binding.sourcePaths.splice(normalizedToIndex, 0, path);

      const [formatter] = binding.formatters.splice(fromIndex, 1);
      if (formatter) {
        binding.formatters.splice(normalizedToIndex, 0, formatter);
      }
    });
  }

  updateConcatSeparator(separator: string): void {
    this.updateSelectedBinding((binding) => {
      binding.separator = separator;
    });
  }

  applyConcatSeparatorPreset(separator: string): void {
    this.updateConcatSeparator(separator);
  }

  updateConcatFormat(
    index: number,
    patch: Partial<{ pad: 'left' | 'right'; length: number; char: string }>
  ): void {
    this.updateSelectedBinding((binding) => {
      binding.formatters[index] ??= {
        id: `fmt-${index}`,
        pad: 'left',
        length: 0,
        char: '0'
      };

      binding.formatters[index] = {
        ...binding.formatters[index],
        ...patch
      };
    });
  }

  clearConcatFormat(index: number): void {
    this.updateSelectedBinding((binding) => {
      binding.formatters[index] = {
        id: binding.formatters[index]?.id ?? `fmt-${index}`,
        pad: 'left',
        length: 0,
        char: '0'
      };
    });
  }

  updateSelectedAdvancedExpression(expression: string): void {
    this.updateSelectedBinding((binding) => {
      binding.advancedExpression = expression;
    });
  }

  applyDefaultLiteralPreset(value: string): void {
    this.setSelectedDefaultLiteral(value);
  }

  createRule(): void {
    this.rules.update((rules) => [
      ...rules,
      {
        id: `rule-${Date.now()}`,
        name: `Novo gerador ${rules.length + 1}`,
        matchMode: 'all',
        conditions: [this.createCondition()],
        actions: [this.createAction()]
      }
    ]);
    this.syncTargetText();
  }

  createRuleTemplate(template: 'porto' | 'apolice' | 'cnpjProdutor'): void {
    const targetPath = this.selectedTargetNode()?.kind == 'field'
      ? this.selectedTargetNode()!.path
      : this.targetLeafOptions()[0]?.path ?? '$';
    const now = Date.now();
    const templates = {
      porto: {
        name: 'Ramo e marca definem Porto',
        conditions: [
          {
            id: `cond-${now}-ramo`,
            scope: 'source' as const,
            fieldPath: '$.dadosApolice.ramo',
            operator: '==' as const,
            value: '5'
          },
          {
            id: `cond-${now}-marca`,
            scope: 'source' as const,
            fieldPath: '$.dadosApolice.codigoMarca',
            operator: '==' as const,
            value: '1001'
          }
        ] as RuleCondition[],
        value: 'Porto',
        sourceFieldPath: '$.dadosApolice.codigoMarca'
      },
      apolice: {
        name: 'Numero de apolice habilita tipo',
        conditions: [
          {
            id: `cond-${now}-apolice`,
            scope: 'source' as const,
            fieldPath: '$.dadosApolice.numeroApolice',
            operator: 'exists' as const,
            value: ''
          }
        ] as RuleCondition[],
        value: 'APOLICE',
        sourceFieldPath: '$.dadosApolice.numeroApolice'
      },
      cnpjProdutor: {
        name: 'Produtor padrao',
        conditions: [
          {
            id: `cond-${now}-item`,
            scope: 'source' as const,
            fieldPath: '$.dadosApolice.numeroItem',
            operator: 'exists' as const,
            value: ''
          }
        ] as RuleCondition[],
        value: '61199164000160',
        sourceFieldPath: '$.dadosApolice.numeroItem'
      }
    };

    const selectedTemplate = templates[template];

    this.rules.update((rules) => [
      ...rules,
      {
        id: `rule-${now}`,
        name: selectedTemplate.name,
        matchMode: 'all',
        conditions: selectedTemplate.conditions,
        actions: [
          {
            id: `act-${now}-${template}`,
            scope: 'target',
            fieldPath: targetPath,
            type: 'setLiteral',
            applicationMode: 'replace',
            value: selectedTemplate.value,
            sourceScope: 'source',
            sourceFieldPath: selectedTemplate.sourceFieldPath,
            expression: ''
          }
        ]
      }
    ]);
    this.syncTargetText();
  }

  updateRuleName(ruleId: string, value: string): void {
    this.rules.update((rules) =>
      rules.map((rule) => (rule.id == ruleId ? { ...rule, name: value } : rule))
    );
    this.syncTargetText();
  }

  updateRuleMatchMode(ruleId: string, mode: 'all' | 'any'): void {
    this.rules.update((rules) =>
      rules.map((rule) => (rule.id == ruleId ? { ...rule, matchMode: mode } : rule))
    );
    this.syncTargetText();
  }

  removeRule(ruleId: string): void {
    this.rules.update((rules) => rules.filter((rule) => rule.id != ruleId));
    this.syncTargetText();
  }

  addCondition(ruleId: string): void {
    this.rules.update((rules) =>
      rules.map((rule) =>
        rule.id == ruleId ? { ...rule, conditions: [...rule.conditions, this.createCondition()] } : rule
      )
    );
    this.syncTargetText();
  }

  updateCondition(ruleId: string, conditionId: string, patch: Partial<RuleCondition>): void {
    this.rules.update((rules) =>
      rules.map((rule) =>
        rule.id == ruleId
          ? {
              ...rule,
              conditions: rule.conditions.map((condition) =>
                condition.id == conditionId ? { ...condition, ...patch } : condition
              )
            }
          : rule
      )
    );
    this.syncTargetText();
  }

  removeCondition(ruleId: string, conditionId: string): void {
    this.rules.update((rules) =>
      rules.map((rule) =>
        rule.id == ruleId
          ? {
              ...rule,
              conditions: rule.conditions.filter((condition) => condition.id != conditionId)
            }
          : rule
      )
    );
    this.syncTargetText();
  }

  addAction(ruleId: string): void {
    this.rules.update((rules) =>
      rules.map((rule) =>
        rule.id == ruleId ? { ...rule, actions: [...rule.actions, this.createAction()] } : rule
      )
    );
    this.syncTargetText();
  }

  updateAction(ruleId: string, actionId: string, patch: Partial<RuleAction>): void {
    this.rules.update((rules) =>
      rules.map((rule) =>
        rule.id == ruleId
          ? {
              ...rule,
              actions: rule.actions.map((action) =>
                action.id == actionId ? { ...action, ...patch } : action
              )
            }
          : rule
      )
    );
    this.syncTargetText();
  }

  removeAction(ruleId: string, actionId: string): void {
    this.rules.update((rules) =>
      rules.map((rule) =>
        rule.id == ruleId
          ? {
              ...rule,
              actions: rule.actions.filter((action) => action.id != actionId)
            }
          : rule
      )
    );
    this.syncTargetText();
  }

  saveConfig(): void {
    this.isSaving.set(true);
    this.saveError.set('');
    this.saveStatus.set('Salvando documento no backend...');

    this.configApi.saveConfig(this.persistenceDocument()).subscribe({
      next: (response) => {
        this.lastSavedResponse.set(response);
        this.saveStatus.set(`Configuracao salva com sucesso${response.id ? ` (id ${response.id})` : ''}.`);
        this.isSaving.set(false);
      },
      error: (error) => {
        this.saveError.set(error?.error?.message ?? 'Nao foi possivel salvar na API.');
        this.saveStatus.set('');
        this.isSaving.set(false);
      }
    });
  }

  loadLatestConfig(): void {
    this.isLoadingLatest.set(true);
    this.saveError.set('');
    this.saveStatus.set('Buscando ultima configuracao...');

    this.configApi.loadLatestConfig(this.persistenceMetadata()).subscribe({
      next: (response) => {
        this.lastSavedResponse.set(response);
        if (response.config) {
          this.applyConfig(response.config);
        } else {
          this.applyPersistedDocument(response);
        }
        this.saveStatus.set(`Ultima configuracao carregada${response.id ? ` (id ${response.id})` : ''}.`);
        this.isLoadingLatest.set(false);
      },
      error: (error) => {
        this.saveError.set(error?.error?.message ?? 'Nao foi possivel carregar a ultima configuracao.');
        this.saveStatus.set('');
        this.isLoadingLatest.set(false);
      }
    });
  }

  private buildConfig(): MapperConfigV2 {
    const legacyMappings = this.mappedTargets()
      .filter((mapping) => mapping.sourcePaths.length > 0)
      .map((mapping) => {
        const targetNode = this.findTargetNode(mapping.targetNodeId);
        return {
          id: mapping.id,
          sourceFieldId: `source:${mapping.sourcePaths[0]}`,
          targetFieldId: `target:${targetNode?.path ?? '$'}`,
          sourcePath: mapping.sourcePaths[0],
          targetPath: targetNode?.path ?? '$',
          alias: targetNode?.label ?? mapping.targetLabel,
          xPath: toXPath(targetNode?.path ?? '$'),
          transformExpression: targetNode?.binding?.advancedExpression ?? ''
        };
      });

    return {
      version: 'v2',
      sourceJsonText: this.sourceJsonText(),
      targetJsonText: this.targetJsonText(),
      sourceSchema: this.sourceFields(),
      targetSchema: this.targetFields(),
      mappings: legacyMappings,
      rules: this.rules(),
      sourceSchemaRaw: this.sourceJsonText(),
      targetSchemaRaw: this.targetJsonText(),
      editorDraft: this.editorDocument(),
      generatedOutputSchema: this.generatedOutputSchema(),
      persistenceMetadata: this.persistenceMetadata(),
      persistenceDocument: this.persistenceDocument(),
      validationErrors: this.validationErrors(),
      metadata: {
        schemaVersion: 2,
        generatedAt: new Date().toISOString()
      }
    };
  }

  private applyConfig(config: MapperConfig): void {
    if ((config as MapperConfigV2).version == 'v2' && (config as MapperConfigV2).editorDraft) {
      const next = config as MapperConfigV2;
      this.sourceJsonText.set(next.sourceSchemaRaw || next.sourceJsonText);
      this.targetJsonText.set(next.targetSchemaRaw || next.targetJsonText);
      this.sourceTree.set(next.editorDraft.sourceTree);
      this.targetTree.set(next.editorDraft.targetTree);
      this.selectedSourceNodeId.set(next.editorDraft.selectedSourceNodeId || next.editorDraft.sourceTree[0]?.id || '');
      this.selectedTargetNodeId.set(next.editorDraft.selectedTargetNodeId || next.editorDraft.targetTree[0]?.id || '');
      this.rules.set(next.rules ?? []);
      if (next.persistenceMetadata) {
        this.persistenceMetadata.set(this.normalizePersistenceMetadata(next.persistenceMetadata));
      }
      this.sourceSchemaUri.set(this.readSchemaUri(this.sourceJsonText(), this.sourceSchemaUri()));
      this.targetSchemaUri.set(this.readSchemaUri(this.targetJsonText(), this.targetSchemaUri()));
      this.syncSourceText();
      this.syncTargetText();
      return;
    }

    this.migrateLegacyConfig(config as MapperConfigV1);
  }

  private applyPersistedDocument(document: SavedConfigResponse): void {
    const sourceSchema = this.asSchemaRecord(document.schema_origem);
    const targetSchema = this.asSchemaRecord(document.schema_destino);

    this.sourceJsonText.set(JSON.stringify(sourceSchema, null, 2));
    this.targetJsonText.set(JSON.stringify(targetSchema, null, 2));
    this.sourceSchemaUri.set(typeof sourceSchema['$schema'] == 'string' ? sourceSchema['$schema'] : this.sourceSchemaUri());
    this.targetSchemaUri.set(typeof targetSchema['$schema'] == 'string' ? targetSchema['$schema'] : this.targetSchemaUri());
    const sourceTree = this.schemaImport.importSourceTree(sourceSchema);
    const targetTree = this.schemaImport.importTargetTree(targetSchema);
    this.sourceTree.set(sourceTree);
    this.targetTree.set(targetTree);
    this.selectedSourceNodeId.set(sourceTree[0]?.id ?? '');
    this.selectedTargetNodeId.set(targetTree[0]?.id ?? '');
    this.sourceError.set('');
    this.targetError.set('');
    this.rules.set([]);
    this.persistenceMetadata.set(this.normalizePersistenceMetadata({
      codigoParceiro: this.readPartnerCode(document),
      eventoParceiro: this.readEventId(document),
      dataInicioVigencia: this.readStartDate(document),
      tipoSchema: document.tipo_schema,
      versaoSchema: document.versao_schema,
      schemaStorageField: 'schema_destino'
    }));
    this.eventTypeSearchTerm.set(this.readEventId(document));
  }

  private normalizePersistenceMetadata(metadata: Partial<PersistenceMetadataDraft> & { nomeParceiro?: unknown }): PersistenceMetadataDraft {
    const parsedCodigoParceiro =
      typeof metadata.codigoParceiro == 'string'
        ? Number.parseInt(metadata.codigoParceiro, 10)
        : null;
    const legacyCode =
      typeof metadata.nomeParceiro == 'string'
        ? Number.parseInt(metadata.nomeParceiro, 10)
        : null;
    const codigoParceiro =
      typeof metadata.codigoParceiro == 'number' && Number.isInteger(metadata.codigoParceiro)
        ? metadata.codigoParceiro
        : Number.isInteger(parsedCodigoParceiro)
          ? parsedCodigoParceiro
        : Number.isInteger(legacyCode)
          ? legacyCode
          : null;

    return {
      codigoParceiro,
      eventoParceiro: metadata.eventoParceiro ?? '',
      dataInicioVigencia: this.normalizeStartDate(metadata.dataInicioVigencia),
      tipoSchema: metadata.tipoSchema == 'origem' ? 'origem' : 'destino',
      versaoSchema: metadata.versaoSchema ?? '',
      schemaStorageField: metadata.schemaStorageField == 'schema_origem' ? 'schema_origem' : 'schema_destino'
    };
  }

  private normalizeStartDate(value: unknown): string {
    if (typeof value != 'string') {
      return '';
    }

    const trimmedValue = value.trim();
    const match = /^(\d{4}-\d{2}-\d{2})/.exec(trimmedValue);
    return match?.[1] ?? '';
  }

  private readStartDate(document: SavedConfigResponse): string {
    const payload = document as SavedConfigResponse & {
      data_inicio_vigencia?: unknown;
    };

    return this.normalizeStartDate(payload.data_inicio_vigencia);
  }

  private readEventId(document: SavedConfigResponse): string {
    const payload = document as SavedConfigResponse & {
      id_evento?: unknown;
      evento_parceiro?: unknown;
    };

    if (typeof payload.id_evento == 'string') {
      return payload.id_evento.trim();
    }

    if (typeof payload.evento_parceiro == 'string') {
      return payload.evento_parceiro.trim();
    }

    return '';
  }

  private readPartnerCode(document: SavedConfigResponse): number | null {
    const payload = document as SavedConfigResponse & {
      codigo_parceiro?: unknown;
      nome_parceiro?: unknown;
    };

    if (typeof payload.codigo_parceiro == 'number' && Number.isInteger(payload.codigo_parceiro)) {
      return payload.codigo_parceiro;
    }

    if (typeof payload.codigo_parceiro == 'string') {
      const parsedCode = Number.parseInt(payload.codigo_parceiro, 10);
      if (Number.isInteger(parsedCode)) {
        return parsedCode;
      }
    }

    if (typeof payload.nome_parceiro == 'string') {
      const parsedLegacyCode = Number.parseInt(payload.nome_parceiro, 10);
      if (Number.isInteger(parsedLegacyCode)) {
        return parsedLegacyCode;
      }
    }

    return null;
  }

  private migrateLegacyConfig(config: MapperConfigV1): void {
    this.sourceJsonText.set(config.sourceJsonText ?? this.sourceJsonText());
    this.targetJsonText.set(config.targetJsonText ?? this.targetJsonText());
    this.importSourceSchema();
    this.importTargetSchema();

    let nextTargetTree = this.targetTree();
    (config.mappings ?? []).forEach((mapping) => {
      nextTargetTree = this.mappingEditor.updateNode(nextTargetTree, this.findTargetNodeByPath(nextTargetTree, mapping.targetPath)?.id ?? '', (node) => {
        node.binding ??= {
          mode: 'alias',
          sourcePaths: [],
          separator: '',
          formatters: [],
          defaultValue: '',
          defaultSourcePath: '',
          advancedExpression: ''
        };
        node.binding.mode = 'alias';
        node.binding.sourcePaths = [mapping.sourcePath];
        node.binding.advancedExpression = mapping.transformExpression ?? '';
      });
    });

    this.targetTree.set(nextTargetTree);
    this.rules.set((config.rules ?? []).map((rule) => ({ ...rule, matchMode: rule.matchMode ?? 'all' })));
    this.syncTargetText();
  }

  private updateSelectedBinding(updater: (binding: NonNullable<SchemaNodeDraft['binding']>) => void): void {
    const selected = this.selectedTargetNode();
    if (!selected || selected.kind != 'field') {
      return;
    }

    this.targetTree.set(this.mappingEditor.updateBinding(this.targetTree(), selected.id, updater));
    this.syncTargetText();
  }

  private findNode(nodes: SchemaNodeDraft[], nodeId: string): SchemaNodeDraft | null {
    return this.mappingEditor.findNode(nodes, nodeId);
  }

  private findTargetNode(nodeId: string): SchemaNodeDraft | null {
    return this.mappingEditor.findNode(this.targetTree(), nodeId);
  }

  private findTargetNodeByPath(nodes: SchemaNodeDraft[], path: string): SchemaNodeDraft | null {
    return this.schemaImport
      .flattenLeafNodes(nodes)
      .find((node) => node.path == path || this.schemaImport.toSchemaAliasPath(node.path) == path.replace(/^\$\./, '')) ?? null;
  }

  private createCondition(): RuleCondition {
    return {
      id: `cond-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      scope: 'source',
      fieldPath: this.sourceLeafOptions()[0]?.path ?? '$',
      operator: '==',
      value: ''
    };
  }

  private createAction(): RuleAction {
    return {
      id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      scope: 'target',
      fieldPath: this.targetLeafOptions()[0]?.path ?? '$',
      type: 'setLiteral',
      applicationMode: 'replace',
      value: '',
      sourceScope: 'source',
      sourceFieldPath: this.sourceLeafOptions()[0]?.path ?? '$',
      expression: ''
    };
  }

  private syncSourceText(): void {
    this.sourceJsonText.set(JSON.stringify(this.generatedSourceSchema(), null, 2));
  }

  private syncTargetText(): void {
    this.targetJsonText.set(this.generatedTargetSchemaText());
  }

  private readSchemaUri(jsonText: string, fallback: string): string {
    try {
      return this.schemaImport.parseJsonText(jsonText).schemaUri || fallback;
    } catch {
      return fallback;
    }
  }

  private resolvePersistedSchema(
    rawJsonText: string,
    fallback: Record<string, unknown>
  ): Record<string, unknown> {
    try {
      const parsed = this.schemaImport.parseJsonText(rawJsonText).raw;
      return parsed;
    } catch {
      return fallback;
    }
  }

  private asSchemaRecord(value: unknown): Record<string, unknown> {
    return value != null && typeof value == 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  private setExpandedState(nodes: SchemaNodeDraft[], expanded: boolean): SchemaNodeDraft[] {
    return nodes.map((node) => ({
      ...node,
      expanded,
      children: this.setExpandedState(node.children, expanded)
    }));
  }

  private isEmptyTarget(node: SchemaNodeDraft): boolean {
    if (this.ruleTargetIds().has(node.id)) {
      return false;
    }

    return (node.binding?.mode ?? 'unmapped') == 'unmapped';
  }

  private hasValidationIssue(node: SchemaNodeDraft): boolean {
    if (this.ruleTargetIds().has(node.id)) {
      return false;
    }

    const mode = node.binding?.mode ?? 'unmapped';

    if (mode == 'unmapped') {
      return true;
    }

    if (mode == 'alias') {
      return !node.binding?.sourcePaths.some(Boolean);
    }

    if (mode == 'concat') {
      return !node.binding?.sourcePaths.some(Boolean);
    }

    if (mode == 'defaultSource') {
      return !node.binding?.defaultSourcePath;
    }

    if (mode == 'eval') {
      return !node.binding?.evalExpression?.trim();
    }

    if (mode == 'script') {
      return !node.binding?.script?.source?.trim();
    }

    return false;
  }
}
