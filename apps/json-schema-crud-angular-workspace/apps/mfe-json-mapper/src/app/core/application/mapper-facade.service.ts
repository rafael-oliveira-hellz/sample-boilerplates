import { Injectable, computed, inject, signal } from '@angular/core';
import { ConfigApiService } from '../infra/config-api.service';
import { MappingEditorService } from '../../features/workbench/application/mapping-editor.service';
import { SchemaGeneratorService } from '../../features/schema/application/schema-generator.service';
import { SchemaImportService } from '../../features/schema/application/schema-import.service';
import {
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
} from '../models';
import { rankSuggestedSources, toXPath } from '../utils';

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
    nomeParceiro: 'porto_teste_1',
    eventoParceiro: 'emissao',
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
  private readonly reviewQueueCursor: Record<'empty' | 'error' | 'rule', number> = { empty: -1, error: -1, rule: -1 };

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
    this.mappingEditor.summarizeMappings(this.targetTree())
  );
  readonly usedSourcePaths = computed(() => new Set(this.mappedTargets().flatMap((mapping) => mapping.sourcePaths.filter(Boolean))));
  readonly generatedSourceSchema = computed<Record<string, unknown>>(() =>
    this.parseTechnicalJson(this.sourceJsonText()) ?? this.schemaGenerator.generateSourceSchema(this.sourceTree(), this.sourceSchemaUri())
  );
  readonly generatedOutputSchema = computed<Record<string, unknown>>(() =>
    this.schemaGenerator.generateTargetSchema(this.targetTree(), this.rules(), this.targetSchemaUri())
  );
  readonly persistenceDocument = computed(() =>
    this.buildPersistenceDocument(this.generatedOutputSchema())
  );
  readonly validationErrors = computed(() => this.schemaGenerator.validateWorkspace(this.sourceTree(), this.targetTree(), this.rules()));
  readonly previewPayload = computed(() => this.schemaGenerator.generatePreviewPayload(this.targetTree(), this.sourceTree(), this.rules()));
  readonly generatedTargetSchemaText = computed(() => this.schemaImport.stringifySchema(this.generatedOutputSchema()));
  readonly persistenceDocumentJson = computed(() => this.schemaImport.stringifySchema(this.persistenceDocument()));
  readonly previewJson = computed(() => this.previewPayload());
  readonly exportFileBase = computed(() => {
    const metadata = this.persistenceMetadata();
    const stamp = new Date().toISOString().replace(/[:T]/g, '-').replace(/\..+$/, '').replace(/-Z$/, '');
    return [metadata.nomeParceiro, metadata.eventoParceiro, metadata.tipoSchema, metadata.versaoSchema, stamp]
      .map((part) => (part || '').trim())
      .filter(Boolean)
      .join('_');
  });
  readonly mappedTargetIds = computed(() => new Set(this.mappedTargets().map((mapping) => mapping.targetNodeId)));
  readonly emptyTargetIds = computed(() => new Set(this.targetLeafOptions().filter((node) => (node.binding?.mode ?? 'unmapped') == 'unmapped').map((node) => node.id)));
  readonly ruleTargetIds = computed(() => {
    const targetedPaths = new Set(
      this.rules()
        .flatMap((rule) => rule.actions)
        .filter((action) => action.scope == 'target' && !!action.fieldPath)
        .map((action) => action.fieldPath)
    );
    return new Set(
      this.targetLeafOptions()
        .filter((node) => targetedPaths.has(node.id) || targetedPaths.has(node.path))
        .map((node) => node.id)
    );
  });
  readonly errorTargetIds = computed(() => new Set(this.targetLeafOptions().filter((node) => this.schemaGenerator.validateWorkspace(this.sourceTree(), [node], this.rules()).length > 0).map((node) => node.id)));

  sourceStats = computed(() => this.schemaImport.summarizeSource(this.sourceTree(), this.mappedTargets()));
  targetStats = computed(() => this.schemaImport.summarizeTarget(this.targetTree()));
  selectedTargetNode = computed(() => this.schemaImport.findNodeById(this.targetTree(), this.selectedTargetNodeId()));
  selectedSourceNode = computed(() => this.schemaImport.findNodeById(this.sourceTree(), this.selectedSourceNodeId()));
  readonly reviewCounts = computed(() => ({
    empty: this.emptyTargetIds().size,
    rule: this.ruleTargetIds().size,
    error: this.errorTargetIds().size
  }));
  readonly selectedTargetRuleCount = computed(() => {
    const node = this.selectedTargetNode();
    if (!node) {
      return 0;
    }
    return this.rules().filter((rule) => rule.actions.some((action) => action.scope == 'target' && action.fieldPath == node.path)).length;
  });
  readonly selectedTargetHasVisualRule = computed(() => this.selectedTargetRuleCount() > 0);

  importSourceJson(raw: string): void {
    if (!raw.trim()) {
      this.sourceTree.set(this.schemaImport.createEmptyTree('source'));
      this.sourceJsonText.set('');
      this.sourceError.set('');
      this.selectedSourceNodeId.set('');
      return;
    }

    try {
      const tree = this.schemaImport.importSourceTree(raw);
      this.sourceTree.set(tree);
      this.sourceJsonText.set(this.schemaImport.formatJson(raw));
      this.sourceSchemaUri.set(this.schemaImport.extractSchemaUri(raw) ?? this.sourceSchemaUri());
      this.sourceError.set('');
      this.selectedSourceNodeId.set('');
    } catch (error) {
      this.sourceError.set(error instanceof Error ? error.message : 'Nao foi possivel importar o schema de origem.');
    }
  }

  importTargetJson(raw: string): void {
    if (!raw.trim()) {
      this.targetTree.set(this.schemaImport.createEmptyTree('target'));
      this.targetJsonText.set('');
      this.targetError.set('');
      this.selectedTargetNodeId.set('');
      return;
    }

    try {
      const tree = this.schemaImport.importTargetTree(raw);
      this.targetTree.set(tree);
      this.targetJsonText.set(this.schemaImport.formatJson(raw));
      this.targetSchemaUri.set(this.schemaImport.extractSchemaUri(raw) ?? this.targetSchemaUri());
      this.targetError.set('');
      this.selectedTargetNodeId.set('');
    } catch (error) {
      this.targetError.set(error instanceof Error ? error.message : 'Falha ao importar destino.');
    }
  }

  updateSourceJsonText(raw: string): void {
    this.sourceJsonText.set(raw);
  }

  updateTargetJsonText(raw: string): void {
    this.targetJsonText.set(raw);
  }

  applySourceJsonText(): void {
    this.importSourceJson(this.sourceJsonText());
  }

  applyTargetJsonText(): void {
    this.importTargetJson(this.targetJsonText());
  }

  setSelectedSourceNode(nodeId: string): void {
    this.selectedSourceNodeId.set(nodeId);
  }

  setSelectedTargetNode(nodeId: string): void {
    this.selectedTargetNodeId.set(nodeId);
  }

  setDragSourcePath(path: string): void {
    this.dragSourcePath.set(path);
  }

  clearDragSourcePath(): void {
    this.dragSourcePath.set('');
  }

  addManualNode(scope: 'source' | 'target', kind: 'field' | 'object' | 'array'): void {
    if (scope == 'source') {
      const result = this.mappingEditor.addNode(this.sourceTree(), scope, this.selectedSourceNodeId(), kind);
      this.sourceTree.set(result.tree);
      this.selectedSourceNodeId.set(result.createdNodeId);
      return;
    }

    const result = this.mappingEditor.addNode(this.targetTree(), scope, this.selectedTargetNodeId(), kind);
    this.targetTree.set(result.tree);
    this.selectedTargetNodeId.set(result.createdNodeId);
    this.syncTargetText();
  }

  removeSelectedTargetNode(): void {
    if (!this.selectedTargetNodeId()) {
      return;
    }
    if (this.selectedTargetNode()?.kind == 'root') {
      return;
    }

    this.targetTree.set(this.mappingEditor.removeNode(this.targetTree(), this.selectedTargetNodeId()));
    this.selectedTargetNodeId.set('');
    this.syncTargetText();
  }

  removeSelectedSourceNode(): void {
    if (!this.selectedSourceNodeId()) {
      return;
    }
    if (this.selectedSourceNode()?.kind == 'root') {
      return;
    }

    this.sourceTree.set(this.mappingEditor.removeNode(this.sourceTree(), this.selectedSourceNodeId()));
    this.selectedSourceNodeId.set('');
  }

  renameNode(scope: 'source' | 'target', nodeId: string, nextLabel: string): void {
    if (scope == 'source') {
      this.sourceTree.set(this.mappingEditor.renameNode(this.sourceTree(), nodeId, nextLabel));
      return;
    }

    this.targetTree.set(this.mappingEditor.renameNode(this.targetTree(), nodeId, nextLabel));
    this.syncTargetText();
  }

  updateNodeType(scope: 'source' | 'target', nodeId: string, nextType: string): void {
    if (scope == 'source') {
      this.sourceTree.set(this.mappingEditor.updateNodeType(this.sourceTree(), nodeId, nextType));
      return;
    }

    this.targetTree.set(this.mappingEditor.updateNodeType(this.targetTree(), nodeId, nextType));
    this.syncTargetText();
  }

  updateNodeNullable(scope: 'source' | 'target', nodeId: string, nullable: boolean): void {
    if (scope == 'source') {
      this.sourceTree.set(this.mappingEditor.updateNodeNullable(this.sourceTree(), nodeId, nullable));
      return;
    }

    this.targetTree.set(this.mappingEditor.updateNodeNullable(this.targetTree(), nodeId, nullable));
    this.syncTargetText();
  }

  toggleNodeExpanded(scope: 'source' | 'target', nodeId: string): void {
    if (scope == 'source') {
      this.sourceTree.set(this.mappingEditor.toggleExpanded(this.sourceTree(), nodeId));
      return;
    }

    this.targetTree.set(this.mappingEditor.toggleExpanded(this.targetTree(), nodeId));
  }

  expandAll(scope: 'source' | 'target'): void {
    if (scope == 'source') {
      this.sourceTree.set(this.mappingEditor.expandAll(this.sourceTree()));
      return;
    }

    this.targetTree.set(this.mappingEditor.expandAll(this.targetTree()));
  }

  collapseAll(scope: 'source' | 'target'): void {
    if (scope == 'source') {
      this.sourceTree.set(this.mappingEditor.collapseAll(this.sourceTree()));
      return;
    }

    this.targetTree.set(this.mappingEditor.collapseAll(this.targetTree()));
  }

  dropSourceOnTarget(sourcePath: string, targetNodeId: string): void {
    const result = this.mappingEditor.bindSourceDrop(this.targetTree(), targetNodeId, sourcePath);
    this.targetTree.set(result.tree);
    this.selectedTargetNodeId.set(result.targetNodeId);
    this.syncTargetText();
  }

  updateTargetBindingMode(nodeId: string, mode: TargetBindingMode): void {
    this.targetTree.set(this.mappingEditor.updateBindingMode(this.targetTree(), nodeId, mode));
    this.syncTargetText();
  }

  updateTargetBindingSourcePath(nodeId: string, sourcePath: string): void {
    this.targetTree.set(this.mappingEditor.updateBindingSourcePath(this.targetTree(), nodeId, sourcePath));
    this.syncTargetText();
  }

  addConcatSource(nodeIdOrSourcePath: string, maybeSourcePath?: string): void {
    const nodeId = maybeSourcePath === undefined ? this.selectedTargetField()?.id ?? '' : nodeIdOrSourcePath;
    const sourcePath = maybeSourcePath === undefined ? nodeIdOrSourcePath : maybeSourcePath;
    if (!nodeId || !sourcePath) {
      return;
    }

    this.targetTree.set(this.mappingEditor.addConcatSource(this.targetTree(), nodeId, sourcePath));
    this.syncTargetText();
  }

  removeConcatSource(nodeIdOrIndex: string | number, maybeIndex?: number): void {
    const nodeId = maybeIndex === undefined ? this.selectedTargetField()?.id ?? '' : String(nodeIdOrIndex);
    const index = maybeIndex === undefined ? Number(nodeIdOrIndex) : maybeIndex;
    if (!nodeId || Number.isNaN(index)) {
      return;
    }

    this.targetTree.set(this.mappingEditor.removeConcatSource(this.targetTree(), nodeId, index));
    this.syncTargetText();
  }

  reorderConcatSource(nodeIdOrPreviousIndex: string | number, previousIndexOrCurrentIndex: number, maybeCurrentIndex?: number): void {
    const nodeId = maybeCurrentIndex === undefined ? this.selectedTargetField()?.id ?? '' : String(nodeIdOrPreviousIndex);
    const previousIndex = maybeCurrentIndex === undefined ? Number(nodeIdOrPreviousIndex) : previousIndexOrCurrentIndex;
    const currentIndex = maybeCurrentIndex === undefined ? previousIndexOrCurrentIndex : maybeCurrentIndex;
    if (!nodeId || Number.isNaN(previousIndex) || Number.isNaN(currentIndex)) {
      return;
    }

    this.targetTree.set(this.mappingEditor.reorderConcatSource(this.targetTree(), nodeId, previousIndex, currentIndex));
    this.syncTargetText();
  }

  updateConcatSeparator(nodeIdOrSeparator: string, maybeSeparator?: string): void {
    const nodeId = maybeSeparator === undefined ? this.selectedTargetField()?.id ?? '' : nodeIdOrSeparator;
    const separator = maybeSeparator === undefined ? nodeIdOrSeparator : maybeSeparator;
    if (!nodeId) {
      return;
    }

    this.targetTree.set(this.mappingEditor.updateConcatSeparator(this.targetTree(), nodeId, separator));
    this.syncTargetText();
  }

  updateDefaultLiteral(nodeId: string, value: string): void {
    this.targetTree.set(this.mappingEditor.updateDefaultLiteral(this.targetTree(), nodeId, value));
    this.syncTargetText();
  }

  updateDefaultSource(nodeId: string, sourcePath: string): void {
    this.targetTree.set(this.mappingEditor.updateDefaultSource(this.targetTree(), nodeId, sourcePath));
    this.syncTargetText();
  }

  updateEvalExpression(nodeId: string, expression: string): void {
    this.targetTree.set(this.mappingEditor.updateEvalExpression(this.targetTree(), nodeId, expression));
    this.syncTargetText();
  }

  updateScript(nodeId: string, language: 'java' | 'javascript' | 'python', source: string, returnType: string): void {
    this.targetTree.set(this.mappingEditor.updateScript(this.targetTree(), nodeId, language, source, returnType));
    this.syncTargetText();
  }

  updateAdvancedExpression(nodeId: string, expression: string): void {
    this.targetTree.set(this.mappingEditor.updateAdvancedExpression(this.targetTree(), nodeId, expression));
    this.syncTargetText();
  }

  clearTargetFieldConfig(nodeId: string): void {
    this.targetTree.set(this.mappingEditor.clearTargetFieldConfig(this.targetTree(), nodeId));
    this.syncTargetText();
  }

  updateMapFrom(nodeId: string, sourcePath: string): void {
    this.targetTree.set(this.mappingEditor.updateMapFrom(this.targetTree(), this.sourceTree(), nodeId, sourcePath));
    this.syncTargetText();
  }

  clearMapFrom(nodeId: string): void {
    this.targetTree.set(this.mappingEditor.clearMapFrom(this.targetTree(), nodeId));
    this.syncTargetText();
  }

  createRule(): void {
    const defaultTargetPath = this.selectedTargetNode()?.path ?? String.fromCharCode(36);
    this.rules.set(this.mappingEditor.createRule(this.rules(), defaultTargetPath));
    this.syncTargetText();
  }

  removeRule(ruleId: string): void {
    this.rules.set(this.mappingEditor.removeRule(this.rules(), ruleId));
    this.syncTargetText();
  }

  updateRuleName(ruleId: string, name: string): void {
    this.rules.set(this.mappingEditor.updateRuleName(this.rules(), ruleId, name));
    this.syncTargetText();
  }

  updateRuleMatchMode(ruleId: string, matchMode: 'all' | 'any'): void {
    this.rules.set(this.mappingEditor.updateRuleMatchMode(this.rules(), ruleId, matchMode));
    this.syncTargetText();
  }

  addRuleCondition(ruleId: string): void {
    this.rules.set(this.mappingEditor.addRuleCondition(this.rules(), ruleId));
    this.syncTargetText();
  }

  removeRuleCondition(ruleId: string, conditionId: string): void {
    this.rules.set(this.mappingEditor.removeRuleCondition(this.rules(), ruleId, conditionId));
    this.syncTargetText();
  }

  updateRuleConditionScope(ruleId: string, conditionId: string, scope: 'source' | 'target'): void {
    this.rules.set(this.mappingEditor.updateRuleConditionScope(this.rules(), ruleId, conditionId, scope));
    this.syncTargetText();
  }

  updateRuleConditionField(ruleId: string, conditionId: string, fieldPath: string): void {
    this.rules.set(this.mappingEditor.updateRuleConditionField(this.rules(), ruleId, conditionId, fieldPath));
    this.syncTargetText();
  }

  updateRuleConditionOperator(ruleId: string, conditionId: string, operator: RuleOperator): void {
    this.rules.set(this.mappingEditor.updateRuleConditionOperator(this.rules(), ruleId, conditionId, operator));
    this.syncTargetText();
  }

  updateRuleConditionValue(ruleId: string, conditionId: string, value: string): void {
    this.rules.set(this.mappingEditor.updateRuleConditionValue(this.rules(), ruleId, conditionId, value));
    this.syncTargetText();
  }

  addRuleAction(ruleId: string): void {
    const defaultTargetPath = this.selectedTargetNode()?.path ?? String.fromCharCode(36);
    this.rules.set(this.mappingEditor.addRuleAction(this.rules(), ruleId, defaultTargetPath));
    this.syncTargetText();
  }

  removeRuleAction(ruleId: string, actionId: string): void {
    this.rules.set(this.mappingEditor.removeRuleAction(this.rules(), ruleId, actionId));
    this.syncTargetText();
  }

  updateRuleActionScope(ruleId: string, actionId: string, scope: 'source' | 'target'): void {
    this.rules.set(this.mappingEditor.updateRuleActionScope(this.rules(), ruleId, actionId, scope));
    this.syncTargetText();
  }

  updateRuleActionField(ruleId: string, actionId: string, fieldPath: string): void {
    this.rules.set(this.mappingEditor.updateRuleActionField(this.rules(), ruleId, actionId, fieldPath));
    this.syncTargetText();
  }

  updateRuleActionType(ruleId: string, actionId: string, type: RuleAction['type']): void {
    this.rules.set(this.mappingEditor.updateRuleActionType(this.rules(), ruleId, actionId, type));
    this.syncTargetText();
  }

  updateRuleActionValue(ruleId: string, actionId: string, value: string): void {
    this.rules.set(this.mappingEditor.updateRuleActionValue(this.rules(), ruleId, actionId, value));
    this.syncTargetText();
  }

  updateRuleActionSourceScope(ruleId: string, actionId: string, sourceScope: 'source' | 'target'): void {
    this.rules.set(this.mappingEditor.updateRuleActionSourceScope(this.rules(), ruleId, actionId, sourceScope));
    this.syncTargetText();
  }

  updateRuleActionSourceField(ruleId: string, actionId: string, sourceFieldPath: string): void {
    this.rules.set(this.mappingEditor.updateRuleActionSourceField(this.rules(), ruleId, actionId, sourceFieldPath));
    this.syncTargetText();
  }

  updateRuleActionExpression(ruleId: string, actionId: string, expression: string): void {
    this.rules.set(this.mappingEditor.updateRuleActionExpression(this.rules(), ruleId, actionId, expression));
    this.syncTargetText();
  }

  saveConfiguration(): void {
    this.saveStatus.set('');
    this.saveError.set('');
    this.isSaving.set(true);

    this.configApi.saveConfig(this.persistenceDocument()).subscribe({
      next: (response) => {
        this.lastSavedResponse.set(response);
        this.saveStatus.set(response.id ? 'Configuracao salva com sucesso. Id ' + response.id + '.' : 'Configuracao salva com sucesso.');
        this.isSaving.set(false);
      },
      error: (error) => {
        this.saveError.set(this.resolveApiError(error, 'Nao foi possivel salvar na API.'));
        this.isSaving.set(false);
      }
    });
  }

  loadLatestConfiguration(): void {
    this.saveStatus.set('');
    this.saveError.set('');
    this.isLoadingLatest.set(true);

    this.configApi.loadLatestConfig(this.persistenceMetadata()).subscribe({
      next: (response) => {
        this.lastSavedResponse.set(response);
        this.applyLoadedConfiguration(this.normalizeLoadedResponse(response));
        this.saveStatus.set('Ultima configuracao carregada.');
        this.isLoadingLatest.set(false);
      },
      error: (error) => {
        this.saveError.set(this.resolveApiError(error, 'Nao foi possivel carregar a ultima configuracao.'));
        this.isLoadingLatest.set(false);
      }
    });
  }

  readonly editorDocument = computed<EditorDocument>(() => ({
    version: 'v2',
    sourceTree: this.sourceTree(),
    targetTree: this.targetTree(),
    selectedSourceNodeId: this.selectedSourceNodeId() || 'source-root',
    selectedTargetNodeId: this.selectedTargetNodeId() || 'target-root'
  }));

  saveConfig(): void {
    this.saveConfiguration();
  }

  loadLatestConfig(): void {
    this.loadLatestConfiguration();
  }

  updatePersistenceMetadata(patch: Partial<PersistenceMetadataDraft>): void {
    const next = { ...this.persistenceMetadata(), ...patch };
    next.schemaStorageField = next.tipoSchema == 'origem' ? 'schema_origem' : 'schema_destino';
    this.persistenceMetadata.set(next);
  }

  importSourceSchema(): void { this.applySourceJsonText(); }
  importTargetSchema(): void { this.applyTargetJsonText(); }
  importSourceSchemaFromText(raw: string): void { this.importSourceJson(raw); }
  importTargetSchemaFromText(raw: string): void { this.importTargetJson(raw); }
  selectSourceNode(nodeId: string): void { this.setSelectedSourceNode(nodeId); }
  selectTargetNode(nodeId: string): void { this.setSelectedTargetNode(nodeId); }
  toggleSourceNode(nodeId: string): void { this.toggleNodeExpanded('source', nodeId); }
  toggleTargetNode(nodeId: string): void { this.toggleNodeExpanded('target', nodeId); }
  startDraggingSource(path: string): void { this.setDragSourcePath(path); }
  clearDraggingSource(): void { this.clearDragSourcePath(); }
  addSourceNode(kind: 'field' | 'object' | 'array'): void { this.addManualNode('source', kind); }
  addTargetNode(kind: 'field' | 'object' | 'array'): void { this.addManualNode('target', kind); }
  renameSourceNode(name: string): void { if (this.selectedSourceNodeId()) { this.renameNode('source', this.selectedSourceNodeId(), name); } }
  renameTargetNode(name: string): void { if (this.selectedTargetNodeId()) { this.renameNode('target', this.selectedTargetNodeId(), name); } }
  updateSourceNodeType(type: string): void { if (this.selectedSourceNodeId()) { this.updateNodeType('source', this.selectedSourceNodeId(), type); } }
  updateTargetNodeType(type: string): void { if (this.selectedTargetNodeId()) { this.updateNodeType('target', this.selectedTargetNodeId(), type); } }
  updateSourceNodeNullable(nullable: boolean): void { if (this.selectedSourceNodeId()) { this.updateNodeNullable('source', this.selectedSourceNodeId(), nullable); } }
  updateTargetNodeNullable(nullable: boolean): void { if (this.selectedTargetNodeId()) { this.updateNodeNullable('target', this.selectedTargetNodeId(), nullable); } }
  removeSourceNode(): void { this.removeSelectedSourceNode(); }
  removeTargetNode(): void { this.removeSelectedTargetNode(); }
  expandAllSourceNodes(): void { this.expandAll('source'); }
  expandAllTargetNodes(): void { this.expandAll('target'); }
  collapseAllSourceNodes(): void { this.collapseAll('source'); }
  collapseAllTargetNodes(): void { this.collapseAll('target'); }
  dropOnTargetNode(targetNodeId: string): void { if (this.dragSourcePath()) { this.dropSourceOnTarget(this.dragSourcePath(), targetNodeId); } }
  setSelectedBindingMode(mode: TargetBindingMode): void { const node = this.selectedTargetField(); if (node) { this.updateTargetBindingMode(node.id, mode); } }
  clearSelectedBinding(): void { const node = this.selectedTargetField(); if (node) { this.clearTargetFieldConfig(node.id); } }
  setSelectedAliasSource(sourcePath: string): void { const node = this.selectedTargetField(); if (node) { this.updateTargetBindingSourcePath(node.id, sourcePath); } }
  setSelectedDefaultLiteral(value: string): void { const node = this.selectedTargetField(); if (node) { this.updateDefaultLiteral(node.id, value); } }
  setSelectedDefaultSource(sourcePath: string): void { const node = this.selectedTargetField(); if (node) { this.updateDefaultSource(node.id, sourcePath); } }
  updateSelectedEvalExpression(expression: string): void {
    const node = this.selectedTargetField();
    if (!node) {
      return;
    }

    this.updateEvalExpression(node.id, expression);
    const shouldPersistAsScript = this.schemaGenerator.shouldPersistEvalAsScript(expression);
    this.targetTree.set(this.mappingEditor.updateBinding(this.targetTree(), node.id, (binding) => {
      binding.evalType = shouldPersistAsScript ? 'script' : undefined;
    }));
    this.syncTargetText();
  }
  updateSelectedScriptLanguage(language: 'java' | 'javascript' | 'python'): void { const node = this.selectedTargetField(); if (node) { this.updateScript(node.id, language, node.binding?.script?.source ?? '', node.binding?.script?.returnType ?? node.type); } }
  updateSelectedScriptSource(source: string): void { const node = this.selectedTargetField(); if (node) { this.updateScript(node.id, node.binding?.script?.language ?? 'java', source, node.binding?.script?.returnType ?? node.type); } }
  updateSelectedScriptReturnType(returnType: string): void { const node = this.selectedTargetField(); if (node) { this.updateScript(node.id, node.binding?.script?.language ?? 'java', node.binding?.script?.source ?? '', returnType); } }
  updateSelectedMapFromSource(sourcePath: string): void { const node = this.selectedTargetContainer(); if (!node) { return; } if (!sourcePath) { this.clearMapFrom(node.id); return; } this.updateMapFrom(node.id, sourcePath); }
  updateSelectedAdvancedExpression(expression: string): void { const node = this.selectedTargetField(); if (node) { this.updateAdvancedExpression(node.id, expression); } }
  applyDefaultLiteralPreset(value: string): void { this.setSelectedDefaultLiteral(value); }
  applyConcatSeparatorPreset(separator: string): void { const node = this.selectedTargetField(); if (node) { this.updateConcatSeparator(node.id, separator); } }
  addAliasFallback(sourcePath: string): void { const node = this.selectedTargetField(); if (!node) { return; } const current = node.binding?.sourcePaths ?? []; this.targetTree.set(this.mappingEditor.updateBinding(this.targetTree(), node.id, (binding) => { binding.mode = 'alias'; binding.aliasStrategy = 'fallback'; if (sourcePath && !binding.sourcePaths.includes(sourcePath)) { binding.sourcePaths = [...current.filter(Boolean), sourcePath]; } })); this.syncTargetText(); }
  replaceAliasFallback(index: number, path: string): void { const node = this.selectedTargetField(); if (!node) { return; } this.targetTree.set(this.mappingEditor.updateBinding(this.targetTree(), node.id, (binding) => { if (index >= 0 && index < binding.sourcePaths.length) { binding.sourcePaths[index] = path; } })); this.syncTargetText(); }
  removeAliasFallback(index: number): void { const node = this.selectedTargetField(); if (!node) { return; } this.targetTree.set(this.mappingEditor.updateBinding(this.targetTree(), node.id, (binding) => { binding.sourcePaths = binding.sourcePaths.filter((_, currentIndex) => currentIndex != index); if (binding.sourcePaths.length == 0) { Object.assign(binding, { mode: 'unmapped', sourcePaths: [], defaultValue: '', defaultSourcePath: '', evalExpression: '', advancedExpression: '', separator: '', formatters: [] }); } })); this.syncTargetText(); }
  updateSelectedAliasStrategy(strategy: 'first' | 'fallback'): void { const node = this.selectedTargetField(); if (!node) { return; } this.targetTree.set(this.mappingEditor.updateBinding(this.targetTree(), node.id, (binding) => { binding.aliasStrategy = strategy; })); this.syncTargetText(); }
  replaceConcatSource(index: number, path: string): void { const node = this.selectedTargetField(); if (!node) { return; } this.targetTree.set(this.mappingEditor.updateBinding(this.targetTree(), node.id, (binding) => { binding.mode = 'concat'; if (index >= 0 && index < binding.sourcePaths.length) { binding.sourcePaths[index] = path; } })); this.syncTargetText(); }
  moveConcatSource(index: number, direction: -1 | 1): void { const node = this.selectedTargetField(); if (!node) { return; } this.reorderConcatSource(node.id, index, index + direction); }
  updateConcatFormat(index: number, patch: Partial<{ pad: 'left' | 'right'; length: number; char: string }>): void { const node = this.selectedTargetField(); if (!node) { return; } this.targetTree.set(this.mappingEditor.updateBinding(this.targetTree(), node.id, (binding) => { const current = binding.formatters[index] ?? { id: 'fmt-' + index, pad: 'left', length: 0, char: '0' }; binding.formatters[index] = { ...current, ...patch }; })); this.syncTargetText(); }
  clearConcatFormat(index: number): void { const node = this.selectedTargetField(); if (!node) { return; } this.targetTree.set(this.mappingEditor.updateBinding(this.targetTree(), node.id, (binding) => { binding.formatters[index] = { id: 'fmt-' + index, pad: 'left', length: 0, char: '0' }; })); this.syncTargetText(); }
  applySuggestedMappingToSelectedTarget(): void { const target = this.selectedTargetNode(); if (!target || target.kind != 'field') { return; } const suggested = rankSuggestedSources(target, this.sourceLeafOptions(), 1)[0]?.source; if (suggested) { this.dropSourceOnTarget(suggested.path, target.id); } }
  applySuggestedMappingsToEmptyTargets(): void { this.targetLeafOptions().filter((node) => (node.binding?.mode ?? 'unmapped') == 'unmapped').forEach((node) => { const suggested = rankSuggestedSources(node, this.sourceLeafOptions(), 1)[0]?.source; if (suggested) { this.dropSourceOnTarget(suggested.path, node.id); } }); }
  addCondition(ruleId: string): void { this.addRuleCondition(ruleId); }
  removeCondition(ruleId: string, conditionId: string): void { this.removeRuleCondition(ruleId, conditionId); }
  addAction(ruleId: string): void { this.addRuleAction(ruleId); }
  removeAction(ruleId: string, actionId: string): void { this.removeRuleAction(ruleId, actionId); }
  updateCondition(ruleId: string, conditionId: string, patch: Partial<RuleCondition>): void { if (patch.scope) { this.updateRuleConditionScope(ruleId, conditionId, patch.scope); } if (patch.fieldPath !== undefined) { this.updateRuleConditionField(ruleId, conditionId, patch.fieldPath); } if (patch.operator) { this.updateRuleConditionOperator(ruleId, conditionId, patch.operator); } if (patch.value !== undefined) { this.updateRuleConditionValue(ruleId, conditionId, patch.value); } }
  updateAction(ruleId: string, actionId: string, patch: Partial<RuleAction>): void { if (patch.scope) { this.updateRuleActionScope(ruleId, actionId, patch.scope); } if (patch.fieldPath !== undefined) { this.updateRuleActionField(ruleId, actionId, patch.fieldPath); } if (patch.type) { this.updateRuleActionType(ruleId, actionId, patch.type); } if (patch.value !== undefined) { this.updateRuleActionValue(ruleId, actionId, patch.value); } if (patch.sourceScope) { this.updateRuleActionSourceScope(ruleId, actionId, patch.sourceScope); } if (patch.sourceFieldPath !== undefined) { this.updateRuleActionSourceField(ruleId, actionId, patch.sourceFieldPath); } if (patch.expression !== undefined) { this.updateRuleActionExpression(ruleId, actionId, patch.expression); } if (patch.applicationMode) { this.rules.set(this.rules().map((rule) => rule.id == ruleId ? { ...rule, actions: rule.actions.map((action) => action.id == actionId ? { ...action, applicationMode: patch.applicationMode } : action) } : rule)); this.syncTargetText(); } }
  createRuleTemplate(template: string): void {
    this.createRule();
    const created = this.rules().at(-1);
    const targetPath = this.selectedTargetNode()?.path ?? String.fromCharCode(36);
    if (!created) {
      return;
    }

    const condition = this.rules().find((rule) => rule.id == created.id)?.conditions[0];
    const action = this.rules().find((rule) => rule.id == created.id)?.actions[0];
    if (!condition || !action) {
      return;
    }

    const setTemplate = (name: string, conditionFieldPath: string, operator: RuleOperator, conditionValue: string, actionValue: string) => {
      this.updateRuleName(created.id, name);
      this.updateCondition(created.id, condition.id, { scope: 'source', fieldPath: conditionFieldPath, operator, value: conditionValue });
      this.updateAction(created.id, action.id, { scope: 'target', fieldPath: targetPath, type: 'setLiteral', value: actionValue, applicationMode: 'replace' });
    };

    if (template == 'porto') {
      setTemplate('Ramo e marca definem Porto', '$.dadosApolice.codigoMarca', '==', '1001', 'Porto');
      return;
    }

    if (template == 'apolice') {
      setTemplate('Numero de apolice habilita tipo', '$.dadosApolice.numeroApolice', 'exists', '', 'APOLICE');
      return;
    }

    if (template == 'cnpjProdutor' || template == 'cnpj') {
      setTemplate('Produtor padrao', String.fromCharCode(36), 'exists', '', '61199164000160');
      return;
    }

    this.updateRuleName(created.id, 'Template');
  }

  navigateReviewQueue(kind: 'empty' | 'error' | 'rule', direction: -1 | 1): void {
    const queue = this.reviewQueueFor(kind);
    if (!queue.length) {
      return;
    }

    const nextIndex = (this.reviewQueueCursor[kind] + direction + queue.length) % queue.length;
    this.reviewQueueCursor[kind] = nextIndex;
    this.selectedTargetNodeId.set(queue[nextIndex]);
  }

  private reviewQueueFor(kind: 'empty' | 'error' | 'rule'): string[] {
    const source = kind == 'empty' ? this.emptyTargetIds() : kind == 'error' ? this.errorTargetIds() : this.ruleTargetIds();
    return this.targetLeafOptions().filter((node) => source.has(node.id) || source.has(node.path)).map((node) => node.id);
  }
  private normalizeLoadedResponse(response: SavedConfigResponse): MapperConfig | null {
    if (response.config) {
      return response.config;
    }

    if (
      response.nome_parceiro ||
      response.evento_parceiro ||
      response.tipo_schema ||
      response.versao_schema ||
      response.schema_origem !== undefined ||
      response.schema_destino !== undefined
    ) {
      const sourceSchema = this.coerceSchemaRecord(response.schema_origem);
      const targetSchema = this.coerceSchemaRecord(response.schema_destino);
      const sourceTree = this.schemaImport.importSourceTreeFromObject(sourceSchema);
      const targetTree = this.schemaImport.importTargetTreeFromObject(targetSchema);
      const sourceSchemaRaw = this.schemaImport.stringifySchema(sourceSchema);
      const targetSchemaRaw = this.schemaImport.stringifySchema(targetSchema);
      const persistenceDocument = {
        id: response.id,
        nome_parceiro: response.nome_parceiro ?? this.persistenceMetadata().nomeParceiro,
        tipo_schema: response.tipo_schema ?? this.persistenceMetadata().tipoSchema,
        versao_schema: response.versao_schema ?? this.persistenceMetadata().versaoSchema,
        evento_parceiro: response.evento_parceiro ?? this.persistenceMetadata().eventoParceiro,
        schema_origem: sourceSchema,
        schema_destino: targetSchema
      };

      return {
        version: 'v2',
        sourceJsonText: sourceSchemaRaw,
        targetJsonText: targetSchemaRaw,
        sourceSchema: this.schemaImport.flattenFields(sourceTree, 'source'),
        targetSchema: this.schemaImport.flattenFields(targetTree, 'target'),
        mappings: [],
        rules: [],
        sourceSchemaRaw,
        targetSchemaRaw,
        editorDraft: {
          version: 'v2',
          sourceTree,
          targetTree,
          selectedSourceNodeId: 'source-root',
          selectedTargetNodeId: 'target-root'
        },
        generatedOutputSchema: targetSchema,
        persistenceMetadata: {
          nomeParceiro: persistenceDocument.nome_parceiro,
          eventoParceiro: persistenceDocument.evento_parceiro,
          tipoSchema: persistenceDocument.tipo_schema,
          versaoSchema: persistenceDocument.versao_schema,
          schemaStorageField: persistenceDocument.tipo_schema == 'origem' ? 'schema_origem' : 'schema_destino'
        },
        persistenceDocument,
        validationErrors: [],
        metadata: {
          schemaVersion: 2,
          generatedAt: new Date().toISOString()
        }
      };
    }

    return null;
  }

  private applyLoadedConfiguration(config: MapperConfig | null): void {
    if (!config) {
      return;
    }

    if ('version' in config && config.version == 'v2') {
      this.applyLoadedV2(config);
      return;
    }

    const sourceTree = config.sourceSchema.length
      ? this.schemaImport.fieldsToTree(config.sourceSchema, 'source')
      : this.schemaImport.importSourceTreeFromObject(this.coerceSchemaRecord(this.parseTechnicalJson(config.sourceJsonText)));
    let targetTree = config.targetSchema.length
      ? this.schemaImport.fieldsToTree(config.targetSchema, 'target')
      : this.schemaImport.importTargetTreeFromObject(this.coerceSchemaRecord(this.parseTechnicalJson(config.targetJsonText)));

    for (const mapping of config.mappings ?? []) {
      const targetPath = this.schemaImport.normalizeSourcePath(mapping.targetPath || '$');
      const targetNode = this.schemaImport.flattenLeafNodes(targetTree).find((node) => node.path == targetPath || node.aliasPath == mapping.targetPath);
      if (!targetNode) {
        continue;
      }

      targetTree = this.mappingEditor.updateBinding(targetTree, targetNode.id, (binding) => {
        binding.mode = 'alias';
        binding.sourcePaths = [mapping.sourcePath];
        binding.advancedExpression = mapping.transformExpression ?? '';
      });
    }

    this.sourceJsonText.set(config.sourceJsonText);
    this.targetJsonText.set(config.targetJsonText);
    this.sourceTree.set(sourceTree);
    this.targetTree.set(targetTree);
    this.rules.set((config.rules ?? []).map((rule) => ({ ...rule, matchMode: rule.matchMode ?? 'all' })));
    this.sourceError.set('');
    this.targetError.set('');
    this.selectedSourceNodeId.set('source-root');
    this.selectedTargetNodeId.set('target-root');
    this.sourceSchemaUri.set(this.schemaImport.extractSchemaUri(config.sourceJsonText) ?? this.sourceSchemaUri());
    this.targetSchemaUri.set(this.schemaImport.extractSchemaUri(config.targetJsonText) ?? this.targetSchemaUri());
  }

  private applyLoadedV2(config: MapperConfigV2): void {
    const persistenceDocument = config.persistenceDocument;
    const sourceSchema = this.coerceSchemaRecord(persistenceDocument?.schema_origem);
    const targetSchema = this.coerceSchemaRecord(persistenceDocument?.schema_destino);
    const editorDraft = config.editorDraft;

    this.sourceJsonText.set(config.sourceSchemaRaw || this.schemaImport.stringifySchema(sourceSchema));
    this.targetJsonText.set(config.targetSchemaRaw || this.schemaImport.stringifySchema(targetSchema));
    this.sourceTree.set(editorDraft?.sourceTree?.length ? editorDraft.sourceTree : this.schemaImport.importSourceTreeFromObject(sourceSchema));
    this.targetTree.set(editorDraft?.targetTree?.length ? editorDraft.targetTree : this.schemaImport.importTargetTreeFromObject(targetSchema));
    this.rules.set((config.rules ?? []).map((rule) => ({ ...rule, matchMode: rule.matchMode ?? 'all' })));
    this.persistenceMetadata.set(config.persistenceMetadata ?? {
      nomeParceiro: persistenceDocument.nome_parceiro,
      eventoParceiro: persistenceDocument.evento_parceiro,
      tipoSchema: persistenceDocument.tipo_schema,
      versaoSchema: persistenceDocument.versao_schema,
      schemaStorageField: persistenceDocument.tipo_schema == 'origem' ? 'schema_origem' : 'schema_destino'
    });
    this.selectedSourceNodeId.set(editorDraft?.selectedSourceNodeId || 'source-root');
    this.selectedTargetNodeId.set(editorDraft?.selectedTargetNodeId || 'target-root');
    this.sourceSchemaUri.set(this.schemaImport.extractSchemaUriFromObject(sourceSchema) ?? this.sourceSchemaUri());
    this.targetSchemaUri.set(this.schemaImport.extractSchemaUriFromObject(targetSchema) ?? this.targetSchemaUri());
    this.sourceError.set('');
    this.targetError.set('');
  }

  private buildPersistenceDocument(generatedTargetSchema: Record<string, unknown>) {
    const sourceSchema = this.generatedSourceSchema();
    const targetSchema = generatedTargetSchema;
    const metadata = this.persistenceMetadata();

    return {
      nome_parceiro: metadata.nomeParceiro,
      tipo_schema: metadata.tipoSchema,
      versao_schema: metadata.versaoSchema,
      evento_parceiro: metadata.eventoParceiro,
      schema_origem: sourceSchema,
      schema_destino: targetSchema
    };
  }

  private parseTechnicalJson(raw: string): Record<string, unknown> | null {
    const parsed = this.schemaImport.tryParseJson(raw);
    return parsed && typeof parsed == 'object' ? (parsed as Record<string, unknown>) : null;
  }

  private syncTargetText(): void {
    if (!this.targetTree().length || !this.targetTree()[0]) {
      this.targetJsonText.set('{}');
      return;
    }
    this.targetJsonText.set(this.generatedTargetSchemaText());
  }

  private selectedTargetField(): SchemaNodeDraft | null {
    const node = this.selectedTargetNode();
    return node?.kind == 'field' ? node : null;
  }

  private selectedTargetContainer(): SchemaNodeDraft | null {
    const node = this.selectedTargetNode();
    return node && node.kind != 'field' ? node : null;
  }

  private coerceSchemaRecord(value: unknown): Record<string, unknown> {
    return value && typeof value == 'object' && !Array.isArray(value)
      ? value as Record<string, unknown>
      : {};
  }

  private resolveApiError(error: unknown, fallbackMessage: string): string {
    if (error && typeof error == 'object') {
      const maybeError = error as { error?: { message?: string }; message?: string };
      if (maybeError.error?.message?.trim()) {
        return maybeError.error.message;
      }
      if (maybeError.message?.trim() && !maybeError.message.startsWith('Http failure response for ')) {
        return maybeError.message;
      }
    }

    if (error instanceof Error && error.message?.trim() && !error.message.startsWith('Http failure response for ')) {
      return error.message;
    }

    return fallbackMessage;
  }
}
