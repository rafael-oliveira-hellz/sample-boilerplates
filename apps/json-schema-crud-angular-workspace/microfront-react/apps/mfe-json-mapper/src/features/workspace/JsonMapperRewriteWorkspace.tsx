import { useMemo, useState } from 'react';
import { useShellContext } from '@porto/shared-runtime';
import type { ImportedFileSummary, MappingRule, SchemaNodeDraft, SchemaPanelState } from '../../core/models/mapperModels';
import { loadLatestConfig, saveConfig } from '../../core/api/configApi';
import { PreviewPanel } from '../preview/PreviewPanel';
import { buildPersistenceDocument } from '../preview/schemaPreview';
import { RulesPanel } from '../rules/RulesPanel';
import {
  addAction,
  addCondition,
  createRule,
  createRuleTemplate,
  removeAction,
  removeCondition,
  removeRule,
  updateAction,
  updateCondition,
  updateRuleMatchMode,
  updateRuleName
} from '../rules/rulesState';
import { createEmptyTree, importSourceTree, importTargetTree, parseJsonText, stringifySchema, toImportedFileSummary } from '../schema/schemaImport';
import { addNode, bindSourceDrop, removeNode, renameNode, setAllExpanded, updateNodeNullable, updateNodeType } from '../schema/editorTreeState';
import { findNodeById, flattenLeafNodes, flattenNodes, toggleNodeExpanded } from '../schema/treeState';
import { SourcePanel } from '../source/SourcePanel';
import { TargetPanel } from '../target/TargetPanel';
import { WorkbenchPanel } from '../workbench/WorkbenchPanel';
import {
  addAliasFallback,
  addConcatSource,
  clearConcatFormat,
  moveConcatSource,
  removeConcatSource,
  removeAliasFallback,
  replaceAliasFallback,
  setAliasSource,
  setAdvancedExpression,
  setBindingMode,
  setDefaultLiteral,
  setDefaultSource,
  setEvalExpression,
  setMapFromSource,
  setScriptBinding,
  updateAliasStrategy,
  updateConcatFormat,
  updateConcatSeparator
} from '../workbench/workbenchState';

const initialSourceState: SchemaPanelState = {
  rawJsonText: '',
  technicalMode: false,
  search: '',
  selectedNodeId: 'source-root',
  error: '',
  importedFile: null
};

const initialTargetState: SchemaPanelState = {
  rawJsonText: '',
  technicalMode: false,
  search: '',
  selectedNodeId: 'target-root',
  error: '',
  importedFile: null
};

async function readJsonFile(file: File): Promise<{ content: string; summary: ImportedFileSummary }> {
  return {
    content: await file.text(),
    summary: toImportedFileSummary(file)
  };
}

function hasMapFromAncestor(nodes: SchemaNodeDraft[], node: SchemaNodeDraft): boolean {
  let currentParentId = node.parentId;

  while (currentParentId) {
    const parent = findNodeById(nodes, currentParentId);
    if (!parent) {
      return false;
    }

    if (parent.mapFrom?.sourcePaths?.some(Boolean)) {
      return true;
    }

    currentParentId = parent.parentId;
  }

  return false;
}

function isFieldBindingEmpty(node: SchemaNodeDraft): boolean {
  const binding = node.binding;
  if (!binding || binding.mode === 'unmapped') {
    return true;
  }

  if (binding.mode === 'alias' || binding.mode === 'concat') {
    return binding.sourcePaths.filter(Boolean).length === 0;
  }

  if (binding.mode === 'defaultSource') {
    return !binding.defaultSourcePath;
  }

  if (binding.mode === 'eval') {
    return !binding.evalExpression.trim();
  }

  if (binding.mode === 'script') {
    return !binding.script?.source.trim();
  }

  return false;
}

function normalizeLookupToken(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '')
    .toLowerCase();
}

function rankSourcesForTarget(targetNode: SchemaNodeDraft, sourceNodes: SchemaNodeDraft[]): SchemaNodeDraft[] {
  const targetKey = normalizeLookupToken(targetNode.key);
  const targetPath = normalizeLookupToken(targetNode.displayPath);

  return [...sourceNodes].sort((left, right) => scoreSource(right, targetKey, targetPath) - scoreSource(left, targetKey, targetPath));
}

function scoreSource(source: SchemaNodeDraft, targetKey: string, targetPath: string): number {
  const label = normalizeLookupToken(source.label);
  const path = normalizeLookupToken(source.displayPath);

  if (label === targetKey || path.endsWith(targetKey)) {
    return 100;
  }

  if (label.includes(targetKey) || path.includes(targetKey)) {
    return 60;
  }

  if (targetPath && path.includes(targetPath)) {
    return 40;
  }

  return 0;
}

export function JsonMapperRewriteWorkspace(): JSX.Element {
  const shellContext = useShellContext();
  const [sourcePanel, setSourcePanel] = useState<SchemaPanelState>(initialSourceState);
  const [targetPanel, setTargetPanel] = useState<SchemaPanelState>(initialTargetState);
  const [sourceTree, setSourceTree] = useState<SchemaNodeDraft[]>(() => createEmptyTree('source'));
  const [targetTree, setTargetTree] = useState<SchemaNodeDraft[]>(() => createEmptyTree('target'));
  const [rules, setRules] = useState<MappingRule[]>([]);
  const [draggedSourcePath, setDraggedSourcePath] = useState('');
  const [hoveredConcatSegmentIndex, setHoveredConcatSegmentIndex] = useState<number | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [metadata, setMetadata] = useState({
    nomeParceiro: 'porto_teste_1',
    eventoParceiro: 'emissao',
    tipoSchema: 'destino' as const,
    versaoSchema: 'v1'
  });
  const [saveStatus, setSaveStatus] = useState('');
  const [saveError, setSaveError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingLatest, setIsLoadingLatest] = useState(false);

  const sourceSelectedNode = useMemo(() => findNodeById(sourceTree, sourcePanel.selectedNodeId), [sourcePanel.selectedNodeId, sourceTree]);
  const targetSelectedNode = useMemo(() => findNodeById(targetTree, targetPanel.selectedNodeId), [targetPanel.selectedNodeId, targetTree]);
  const sourceLeafNodes = useMemo(() => flattenLeafNodes(sourceTree), [sourceTree]);
  const sourceAllNodes = useMemo(() => flattenNodes(sourceTree), [sourceTree]);
  const targetAllNodes = useMemo(() => flattenNodes(targetTree), [targetTree]);
  const targetLeafNodes = useMemo(() => flattenLeafNodes(targetTree), [targetTree]);

  const mappedTargetIds = useMemo(
    () => new Set(targetLeafNodes.filter((node) => (node.binding?.mode ?? 'unmapped') !== 'unmapped').map((node) => node.id)),
    [targetLeafNodes]
  );

  const usedSourcePaths = useMemo(() => {
    const used = new Set<string>();

    targetAllNodes.forEach((node) => {
      node.binding?.sourcePaths.filter(Boolean).forEach((path) => used.add(path));
      if (node.binding?.defaultSourcePath) {
        used.add(node.binding.defaultSourcePath);
      }
      node.mapFrom?.sourcePaths.filter(Boolean).forEach((path) => used.add(path));
    });

    rules.forEach((rule) => {
      rule.conditions.forEach((condition) => {
        if (condition.scope === 'source' && condition.fieldPath) {
          used.add(condition.fieldPath);
        }
      });

      rule.actions.forEach((action) => {
        if (action.sourceScope === 'source' && action.sourceFieldPath) {
          used.add(action.sourceFieldPath);
        }
      });
    });

    return used;
  }, [rules, targetAllNodes]);

  const emptyTargetIds = useMemo(
    () => new Set(targetLeafNodes.filter((node) => isFieldBindingEmpty(node)).map((node) => node.id)),
    [targetLeafNodes]
  );

  const ruleTargetIds = useMemo(
    () => new Set(targetLeafNodes.filter((node) => ['eval', 'script', 'rule'].includes(node.binding?.mode ?? '')).map((node) => node.id)),
    [targetLeafNodes]
  );

  const errorTargetIds = useMemo(() => {
    const sourceFieldPaths = new Set(sourceLeafNodes.map((node) => node.path));
    const sourceNodePaths = new Set(sourceAllNodes.map((node) => node.path));

    return new Set(
      targetAllNodes
        .filter((node) => {
          if (node.kind === 'field') {
            const binding = node.binding;
            if (!binding || binding.mode === 'unmapped') {
              return false;
            }

            if (binding.mode === 'alias' || binding.mode === 'concat') {
              const relativeContext = hasMapFromAncestor(targetTree, node);
              return binding.sourcePaths.some((path) => {
                if (!path || path === '$') {
                  return false;
                }
                if (sourceFieldPaths.has(path)) {
                  return false;
                }
                if (relativeContext && path.startsWith('$.')) {
                  return false;
                }
                return path.startsWith('$.');
              });
            }

            if (binding.mode === 'defaultSource') {
              if (!binding.defaultSourcePath) {
                return false;
              }
              if (sourceFieldPaths.has(binding.defaultSourcePath)) {
                return false;
              }
              return !(hasMapFromAncestor(targetTree, node) && binding.defaultSourcePath.startsWith('$.'));
            }

            if (binding.mode === 'eval') {
              return !binding.evalExpression.trim();
            }

            if (binding.mode === 'script') {
              return !binding.script?.source.trim();
            }

            return false;
          }

          if (node.mapFrom?.sourcePaths.some(Boolean)) {
            return node.mapFrom.sourcePaths.some((path) => !sourceNodePaths.has(path));
          }

          return false;
        })
        .map((node) => node.id)
    );
  }, [sourceAllNodes, sourceLeafNodes, targetAllNodes, targetTree]);

  const reviewCounts = useMemo(
    () => ({
      empty: emptyTargetIds.size,
      rule: ruleTargetIds.size,
      error: errorTargetIds.size
    }),
    [emptyTargetIds, errorTargetIds, ruleTargetIds]
  );
  const reviewTargetIds = useMemo(
    () => ({
      empty: targetLeafNodes.filter((node) => emptyTargetIds.has(node.id)).map((node) => node.id).slice(0, 8),
      rule: targetLeafNodes.filter((node) => ruleTargetIds.has(node.id)).map((node) => node.id).slice(0, 8),
      error: targetAllNodes.filter((node) => errorTargetIds.has(node.id)).map((node) => node.id).slice(0, 8)
    }),
    [emptyTargetIds, errorTargetIds, ruleTargetIds, targetAllNodes, targetLeafNodes]
  );

  const validationErrors = useMemo(() => {
    const errors: string[] = [];

    if (sourceLeafNodes.length === 0) {
      errors.push('Importe ou monte a origem para liberar os bindings.');
    }

    if (targetLeafNodes.length === 0) {
      errors.push('Estruture o destino para gerar o contrato final.');
    }

    if (errorTargetIds.size > 0) {
      errors.push(`${errorTargetIds.size} campo(s) ou container(s) merecem revisão antes do save.`);
    }

    if (emptyTargetIds.size > 0) {
      errors.push(`${emptyTargetIds.size} campo(s) de destino ainda estão vazios.`);
    }

    return errors;
  }, [emptyTargetIds, errorTargetIds, sourceLeafNodes.length, targetLeafNodes.length]);

  async function importSourceFile(file: File): Promise<void> {
    const imported = await readJsonFile(file);

    try {
      const parsed = parseJsonText(imported.content);
      setSourceTree(importSourceTree(parsed));
      setSourcePanel((current) => ({
        ...current,
        rawJsonText: stringifySchema(parsed),
        selectedNodeId: 'source-root',
        importedFile: imported.summary,
        error: '',
        technicalMode: true
      }));
    } catch (error) {
      setSourcePanel((current) => ({
        ...current,
        error: error instanceof Error ? error.message : 'Falha ao importar origem.'
      }));
    }
  }

  async function importTargetFile(file: File): Promise<void> {
    const imported = await readJsonFile(file);

    try {
      const parsed = parseJsonText(imported.content);
      setTargetTree(importTargetTree(parsed));
      setTargetPanel((current) => ({
        ...current,
        rawJsonText: stringifySchema(parsed),
        selectedNodeId: 'target-root',
        importedFile: imported.summary,
        error: '',
        technicalMode: true
      }));
    } catch (error) {
      setTargetPanel((current) => ({
        ...current,
        error: error instanceof Error ? error.message : 'Falha ao importar destino.'
      }));
    }
  }

  function applySourceText(): void {
    try {
      const parsed = parseJsonText(sourcePanel.rawJsonText || '{}');
      setSourceTree(importSourceTree(parsed));
      setSourcePanel((current) => ({
        ...current,
        error: '',
        importedFile: null,
        selectedNodeId: 'source-root'
      }));
    } catch (error) {
      setSourcePanel((current) => ({
        ...current,
        error: error instanceof Error ? error.message : 'Falha ao aplicar origem.'
      }));
    }
  }

  function applyTargetText(): void {
    try {
      const parsed = parseJsonText(targetPanel.rawJsonText || '{}');
      setTargetTree(importTargetTree(parsed));
      setTargetPanel((current) => ({
        ...current,
        error: '',
        importedFile: null,
        selectedNodeId: 'target-root'
      }));
    } catch (error) {
      setTargetPanel((current) => ({
        ...current,
        error: error instanceof Error ? error.message : 'Falha ao aplicar destino.'
      }));
    }
  }

  function handleAddNode(scope: 'source' | 'target', kind: 'field' | 'object' | 'array'): void {
    if (scope === 'source') {
      const result = addNode(sourceTree, 'source', sourcePanel.selectedNodeId, kind);
      setSourceTree(result.tree);
      setSourcePanel((current) => ({ ...current, selectedNodeId: result.createdNodeId }));
      return;
    }

    const result = addNode(targetTree, 'target', targetPanel.selectedNodeId, kind);
    setTargetTree(result.tree);
    setTargetPanel((current) => ({ ...current, selectedNodeId: result.createdNodeId }));
  }

  function handleRemoveNode(scope: 'source' | 'target'): void {
    if (scope === 'source') {
      const result = removeNode(sourceTree, sourcePanel.selectedNodeId);
      setSourceTree(result.tree);
      setSourcePanel((current) => ({ ...current, selectedNodeId: result.nextSelectedNodeId }));
      return;
    }

    const result = removeNode(targetTree, targetPanel.selectedNodeId);
    setTargetTree(result.tree);
    setTargetPanel((current) => ({ ...current, selectedNodeId: result.nextSelectedNodeId }));
  }

  function handleDropSource(targetNodeId: string, sourcePath: string): void {
    const result = bindSourceDrop(targetTree, targetNodeId, sourcePath);
    setTargetTree(result.tree);
    setTargetPanel((current) => ({ ...current, selectedNodeId: result.targetNodeId }));
    setDraggedSourcePath('');
  }

  function applySuggestedMapping(nodeId: string): void {
    const targetNode = findNodeById(targetTree, nodeId);
    if (!targetNode || targetNode.kind !== 'field') {
      return;
    }

    const bestMatch = rankSourcesForTarget(targetNode, sourceLeafNodes)[0];
    if (!bestMatch) {
      return;
    }

    if (targetNode.binding?.mode === 'concat') {
      setTargetTree((current) => addConcatSource(current, nodeId, bestMatch.path));
      return;
    }

    if (targetNode.binding?.mode === 'defaultSource') {
      setTargetTree((current) => setDefaultSource(current, nodeId, bestMatch.path));
      return;
    }

    setTargetTree((current) => setAliasSource(current, nodeId, bestMatch.path));
  }

  function applySuggestedMappingsBatch(): void {
    let nextTree = targetTree;

    targetLeafNodes
      .filter((node) => isFieldBindingEmpty(node))
      .forEach((node) => {
        const bestMatch = rankSourcesForTarget(node, sourceLeafNodes)[0];
        if (!bestMatch) {
          return;
        }

        nextTree = setAliasSource(nextTree, node.id, bestMatch.path);
      });

    setTargetTree(nextTree);
  }

  async function handleSave(): Promise<void> {
    try {
      setIsSaving(true);
      setSaveError('');
      setSaveStatus('');
      const response = await saveConfig(shellContext.apiBaseUrl, buildPersistenceDocument(sourceTree, targetTree, metadata, rules) as never);
      setSaveStatus(response.id ? `Configuração salva com ID ${response.id}.` : 'Configuração salva com sucesso.');
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Não foi possível salvar a configuração.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleLoadLatest(): Promise<void> {
    try {
      setIsLoadingLatest(true);
      setSaveError('');
      setSaveStatus('');
      const response = await loadLatestConfig(shellContext.apiBaseUrl, metadata);
      const sourceSchema = (response.schema_origem ?? {}) as Record<string, unknown>;
      const targetSchema = (response.schema_destino ?? {}) as Record<string, unknown>;

      setSourceTree(importSourceTree(sourceSchema));
      setTargetTree(importTargetTree(targetSchema));
      setSourcePanel((current) => ({
        ...current,
        rawJsonText: stringifySchema(sourceSchema),
        selectedNodeId: 'source-root',
        error: '',
        importedFile: null
      }));
      setTargetPanel((current) => ({
        ...current,
        rawJsonText: stringifySchema(targetSchema),
        selectedNodeId: 'target-root',
        error: '',
        importedFile: null
      }));
      setRules([]);
      setDraggedSourcePath('');
      setSaveStatus(response.id ? `Última configuração carregada: ${response.id}.` : 'Última configuração carregada.');
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Não foi possível carregar a última configuração.');
    } finally {
      setIsLoadingLatest(false);
    }
  }

  return (
    <main className="workspace" data-testid="react-json-mapper-workspace">
      <section className="hero">
        <div>
          <p className="eyebrow">React + API Java + editor visual V2</p>
          <h1>Mapeador JSON visual para contratos de integração</h1>
          <p className="hero-copy">
            Importe o schema de origem, monte a estrutura de saída, refine bindings e publique um contrato persistido
            com preview, regras visuais e compatibilidade com o backend atual do mapper.
          </p>

          <div className="hero-stats">
            <div className="hero-chip">
              <strong>{sourceLeafNodes.length}</strong>
              <span>campos na origem</span>
            </div>
            <div className="hero-chip">
              <strong>{targetLeafNodes.length}</strong>
              <span>campos no destino</span>
            </div>
            <div className="hero-chip">
              <strong>{mappedTargetIds.size}</strong>
              <span>campos mapeados</span>
            </div>
            <div className="hero-chip">
              <strong>{rules.length}</strong>
              <span>geradores visuais</span>
            </div>
          </div>
        </div>

        <div className="hero-actions">
          <button type="button" onClick={() => void handleSave()} disabled={isSaving}>
            {isSaving ? 'Salvando...' : 'Salvar na API'}
          </button>
          <button type="button" className="ghost" onClick={() => void handleLoadLatest()} disabled={isLoadingLatest}>
            {isLoadingLatest ? 'Carregando...' : 'Carregar última configuração'}
          </button>
          {saveStatus ? <p className="status ok">{saveStatus}</p> : null}
          {saveError ? <p className="status error">{saveError}</p> : null}
          <small>
            Usuário: {shellContext.session.userId} · Tenant: {shellContext.session.tenantId} · API: {shellContext.apiBaseUrl}
          </small>
        </div>
      </section>

      <section className="meta-bar" data-testid="react-metadata-panel">
        <div className="meta-card">
          <label htmlFor="metadata-parceiro">Parceiro</label>
          <input
            id="metadata-parceiro"
            value={metadata.nomeParceiro}
            onChange={(event) => setMetadata((current) => ({ ...current, nomeParceiro: event.target.value }))}
          />
          <small className="meta-help">Nome que identifica este cadastro na operação.</small>
        </div>

        <div className="meta-card">
          <label htmlFor="metadata-evento">Evento</label>
          <input
            id="metadata-evento"
            value={metadata.eventoParceiro}
            onChange={(event) => setMetadata((current) => ({ ...current, eventoParceiro: event.target.value }))}
          />
          <small className="meta-help">Evento ou etapa da operação associada a este cadastro.</small>
        </div>

        <div className="meta-card">
          <label htmlFor="metadata-tipo">Tipo de schema</label>
          <select
            id="metadata-tipo"
            value={metadata.tipoSchema}
            onChange={(event) => setMetadata((current) => ({ ...current, tipoSchema: event.target.value as 'origem' | 'destino' }))}
          >
            <option value="destino">destino</option>
            <option value="origem">origem</option>
          </select>
          <small className="meta-help">Define como este cadastro será identificado na API.</small>
        </div>

        <div className="meta-card">
          <label htmlFor="metadata-versao">Versão</label>
          <input
            id="metadata-versao"
            value={metadata.versaoSchema}
            onChange={(event) => setMetadata((current) => ({ ...current, versaoSchema: event.target.value }))}
          />
          <small className="meta-help">Versão funcional desta configuração.</small>
        </div>
      </section>

      <section className="flow-bar">
        <div className="flow-step primary">
          <strong>1. Arraste da origem</strong>
          <span>Comece pelo painel da esquerda e escolha o dado que deseja aproveitar.</span>
        </div>
        <div className="flow-arrow">→</div>
        <div className="flow-step primary">
          <strong>2. Solte no destino</strong>
          <span>Solte direto no destino para montar a estrutura sem etapas extras.</span>
        </div>
        <div className="flow-arrow">→</div>
        <div className="flow-step">
          <strong>3. Refine se precisar</strong>
          <span>Use a lateral direita apenas quando precisar completar ou refinar o contrato.</span>
        </div>
        {draggedSourcePath ? <div className="flow-drag-hint">Arrastando agora: {draggedSourcePath}</div> : null}
      </section>

      <section className="builder-grid">
        <SourcePanel
          panelState={sourcePanel}
          nodes={sourceTree}
          selectedNode={sourceSelectedNode}
          usedPaths={usedSourcePaths}
          onPanelStateChange={setSourcePanel}
          onImportFile={importSourceFile}
          onApplyText={applySourceText}
          onToggleNode={(nodeId) => setSourceTree((current) => toggleNodeExpanded(current, nodeId))}
          onSelectNode={(nodeId) => setSourcePanel((current) => ({ ...current, selectedNodeId: nodeId }))}
          onSetAllExpanded={(expanded) => setSourceTree((current) => setAllExpanded(current, expanded))}
          onAddNode={(kind) => handleAddNode('source', kind)}
          onRemoveSelected={() => handleRemoveNode('source')}
          onRenameNode={(nodeId, nextKey) => setSourceTree((current) => renameNode(current, nodeId, nextKey))}
          onUpdateNodeType={(nodeId, nextType) => setSourceTree((current) => updateNodeType(current, nodeId, nextType))}
          onUpdateNodeNullable={(nodeId, nullable) => setSourceTree((current) => updateNodeNullable(current, nodeId, nullable))}
          onDragSourceStart={setDraggedSourcePath}
          onDragSourceEnd={() => setDraggedSourcePath('')}
        />

        <TargetPanel
          panelState={targetPanel}
          nodes={targetTree}
          selectedNode={targetSelectedNode}
          mappedTargetIds={mappedTargetIds}
          emptyTargetIds={emptyTargetIds}
          ruleTargetIds={ruleTargetIds}
          errorTargetIds={errorTargetIds}
          highlightedConcatSegmentIndex={hoveredConcatSegmentIndex}
          draggedSourcePath={draggedSourcePath}
          onPanelStateChange={setTargetPanel}
          onImportFile={importTargetFile}
          onApplyText={applyTargetText}
          onToggleNode={(nodeId) => setTargetTree((current) => toggleNodeExpanded(current, nodeId))}
          onSelectNode={(nodeId) => setTargetPanel((current) => ({ ...current, selectedNodeId: nodeId }))}
          onSetAllExpanded={(expanded) => setTargetTree((current) => setAllExpanded(current, expanded))}
          onAddNode={(kind) => handleAddNode('target', kind)}
          onRemoveSelected={() => handleRemoveNode('target')}
          onRenameNode={(nodeId, nextKey) => setTargetTree((current) => renameNode(current, nodeId, nextKey))}
          onUpdateNodeType={(nodeId, nextType) => setTargetTree((current) => updateNodeType(current, nodeId, nextType))}
          onUpdateNodeNullable={(nodeId, nullable) => setTargetTree((current) => updateNodeNullable(current, nodeId, nullable))}
          onDropSource={handleDropSource}
        />

        <WorkbenchPanel
          sourceFieldOptions={sourceLeafNodes}
          sourceNodeOptions={sourceAllNodes}
          targetTree={targetTree}
          selectedTargetNode={targetSelectedNode}
          mappedCount={mappedTargetIds.size}
          reviewCounts={reviewCounts}
          reviewTargetIds={reviewTargetIds}
        ruleCount={rules.length}
        validationErrors={validationErrors}
        highlightedConcatSegmentIndex={hoveredConcatSegmentIndex}
        draggedSourcePath={draggedSourcePath}
        onSelectTarget={(nodeId) => setTargetPanel((current) => ({ ...current, selectedNodeId: nodeId }))}
          onSetBindingMode={(nodeId, mode) => setTargetTree((current) => setBindingMode(current, nodeId, mode))}
          onSetAliasSource={(nodeId, sourcePath) => setTargetTree((current) => setAliasSource(current, nodeId, sourcePath))}
          onAddAliasFallback={(nodeId, sourcePath) => setTargetTree((current) => addAliasFallback(current, nodeId, sourcePath))}
          onReplaceAliasFallback={(nodeId, index, sourcePath) => setTargetTree((current) => replaceAliasFallback(current, nodeId, index, sourcePath))}
          onRemoveAliasFallback={(nodeId, index) => setTargetTree((current) => removeAliasFallback(current, nodeId, index))}
          onUpdateAliasStrategy={(nodeId, strategy) => setTargetTree((current) => updateAliasStrategy(current, nodeId, strategy))}
          onAddConcatSource={(nodeId, sourcePath) => setTargetTree((current) => addConcatSource(current, nodeId, sourcePath))}
          onRemoveConcatSource={(nodeId, sourcePath) => setTargetTree((current) => removeConcatSource(current, nodeId, sourcePath))}
          onMoveConcatSource={(nodeId, index, direction) => setTargetTree((current) => moveConcatSource(current, nodeId, index, direction))}
          onUpdateConcatSeparator={(nodeId, separator) => setTargetTree((current) => updateConcatSeparator(current, nodeId, separator))}
          onUpdateConcatFormat={(nodeId, index, patch) => setTargetTree((current) => updateConcatFormat(current, nodeId, index, patch))}
          onClearConcatFormat={(nodeId, index) => setTargetTree((current) => clearConcatFormat(current, nodeId, index))}
          onSetDefaultLiteral={(nodeId, value) => setTargetTree((current) => setDefaultLiteral(current, nodeId, value))}
          onSetDefaultSource={(nodeId, sourcePath) => setTargetTree((current) => setDefaultSource(current, nodeId, sourcePath))}
          onSetEvalExpression={(nodeId, expression, evalType) => setTargetTree((current) => setEvalExpression(current, nodeId, expression, evalType))}
          onSetAdvancedExpression={(nodeId, expression) => setTargetTree((current) => setAdvancedExpression(current, nodeId, expression))}
          onSetScript={(nodeId, patch) => setTargetTree((current) => setScriptBinding(current, nodeId, patch))}
          onSetMapFromSource={(nodeId, sourcePath) => setTargetTree((current) => setMapFromSource(current, nodeId, sourcePath))}
          onApplySuggestedMapping={applySuggestedMapping}
          onApplySuggestedMappingsBatch={applySuggestedMappingsBatch}
          onHoverConcatSegment={setHoveredConcatSegmentIndex}
        />
      </section>

      {sourceLeafNodes.length > 0 && targetLeafNodes.length > 0 ? (
        <section className="rewrite-preview-grid">
          <RulesPanel
            rules={rules}
            sourceOptions={sourceAllNodes}
            targetOptions={targetAllNodes}
            onCreateRule={() => setRules((current) => createRule(current, targetSelectedNode?.path ?? '$'))}
            onRemoveRule={(ruleId) => setRules((current) => removeRule(current, ruleId))}
            onUpdateRuleName={(ruleId, value) => setRules((current) => updateRuleName(current, ruleId, value))}
            onUpdateRuleMatchMode={(ruleId, mode) => setRules((current) => updateRuleMatchMode(current, ruleId, mode))}
            onAddCondition={(ruleId) => setRules((current) => addCondition(current, ruleId))}
            onRemoveCondition={(ruleId, conditionId) => setRules((current) => removeCondition(current, ruleId, conditionId))}
            onUpdateCondition={(ruleId, conditionId, patch) => setRules((current) => updateCondition(current, ruleId, conditionId, patch))}
            onAddAction={(ruleId) => setRules((current) => addAction(current, ruleId, targetSelectedNode?.path ?? '$'))}
            onRemoveAction={(ruleId, actionId) => setRules((current) => removeAction(current, ruleId, actionId))}
            onUpdateAction={(ruleId, actionId, patch) => setRules((current) => updateAction(current, ruleId, actionId, patch))}
            onCreateRuleTemplate={(template) => setRules((current) => createRuleTemplate(current, template, targetSelectedNode?.path ?? '$'))}
          />
        </section>
      ) : null}

      <button type="button" className="preview-fab" data-testid="preview-fab" onClick={() => setPreviewOpen(true)}>
        <span className="preview-fab-icon" aria-hidden="true">◎</span>
        <span className="preview-fab-copy">
          <strong>Abrir painel</strong>
          <small>{validationErrors.length} alerta(s)</small>
        </span>
      </button>

      {previewOpen ? (
        <div className="preview-modal-backdrop" role="presentation" onClick={() => setPreviewOpen(false)}>
          <div
            className="preview-modal-card"
            role="dialog"
            aria-modal="true"
            aria-label="Painel de conferência"
            onClick={(event) => event.stopPropagation()}
          >
            <button type="button" className="preview-modal-close" aria-label="Fechar preview" onClick={() => setPreviewOpen(false)}>
              ×
            </button>
            <PreviewPanel sourceTree={sourceTree} targetTree={targetTree} metadata={metadata} rules={rules} />
          </div>
        </div>
      ) : null}
    </main>
  );
}
