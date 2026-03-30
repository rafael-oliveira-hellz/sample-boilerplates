import { useMemo, useState } from 'react';
import type { SchemaNodeDraft } from '../../core/models/mapperModels';
import { findNodeById } from '../schema/treeState';
import { detectCodeLanguage, shouldPersistEvalAsScript } from './workbenchState';

type WorkbenchMode = Extract<NonNullable<SchemaNodeDraft['binding']>['mode'], 'alias' | 'concat' | 'defaultLiteral' | 'defaultSource' | 'eval' | 'script'>;
type LinkLaneKind = 'alias' | 'concat' | 'defaultSource' | 'fallback';

interface WorkbenchPanelProps {
  sourceFieldOptions: SchemaNodeDraft[];
  sourceNodeOptions: SchemaNodeDraft[];
  targetTree: SchemaNodeDraft[];
  selectedTargetNode: SchemaNodeDraft | null;
  mappedCount: number;
  reviewCounts: { empty: number; rule: number; error: number };
  reviewTargetIds: { empty: string[]; rule: string[]; error: string[] };
  ruleCount: number;
  validationErrors: string[];
  highlightedConcatSegmentIndex: number | null;
  draggedSourcePath: string;
  onSelectTarget(nodeId: string): void;
  onSetBindingMode(nodeId: string, mode: WorkbenchMode): void;
  onSetAliasSource(nodeId: string, sourcePath: string): void;
  onAddAliasFallback(nodeId: string, sourcePath: string): void;
  onReplaceAliasFallback(nodeId: string, index: number, sourcePath: string): void;
  onRemoveAliasFallback(nodeId: string, index: number): void;
  onUpdateAliasStrategy(nodeId: string, strategy: 'first' | 'fallback'): void;
  onAddConcatSource(nodeId: string, sourcePath: string): void;
  onRemoveConcatSource(nodeId: string, sourcePath: string): void;
  onMoveConcatSource(nodeId: string, index: number, direction: -1 | 1): void;
  onUpdateConcatSeparator(nodeId: string, separator: string): void;
  onUpdateConcatFormat(nodeId: string, index: number, patch: Partial<{ pad: 'left' | 'right'; length: number; char: string }>): void;
  onClearConcatFormat(nodeId: string, index: number): void;
  onSetDefaultLiteral(nodeId: string, value: string): void;
  onSetDefaultSource(nodeId: string, sourcePath: string): void;
  onSetEvalExpression(nodeId: string, expression: string, evalType?: 'script'): void;
  onSetAdvancedExpression(nodeId: string, expression: string): void;
  onSetScript(nodeId: string, patch: { language?: 'java' | 'javascript' | 'python'; source?: string; returnType?: string }): void;
  onSetMapFromSource(nodeId: string, sourcePath: string): void;
  onApplySuggestedMapping(nodeId: string): void;
  onApplySuggestedMappingsBatch(): void;
  onHoverConcatSegment(index: number | null): void;
}

const bindingModes: Array<{ id: WorkbenchMode; label: string }> = [
  { id: 'alias', label: 'Alias' },
  { id: 'concat', label: 'Concat' },
  { id: 'defaultLiteral', label: 'Default fixo' },
  { id: 'defaultSource', label: 'Default da origem' },
  { id: 'eval', label: 'Eval' },
  { id: 'script', label: 'Script' }
];

export function WorkbenchPanel(props: WorkbenchPanelProps): JSX.Element {
  const node = props.selectedTargetNode;
  const [draftConcatSource, setDraftConcatSource] = useState('');
  const [draftAliasFallback, setDraftAliasFallback] = useState('');
  const [draftManualSourcePath, setDraftManualSourcePath] = useState('');
  const [manualSourceQuery, setManualSourceQuery] = useState('');
  const [assistantsExpanded, setAssistantsExpanded] = useState(false);
  const [hoveredLinkLane, setHoveredLinkLane] = useState<LinkLaneKind | null>(null);

  const fieldTargets = useMemo(() => flattenFieldTargets(props.targetTree), [props.targetTree]);
  const mappedTargets = useMemo(() => fieldTargets.filter((item) => (item.binding?.mode ?? 'unmapped') !== 'unmapped'), [fieldTargets]);
  const sourceChoices = useMemo(() => buildSourceChoices(node, props.targetTree, props.sourceFieldOptions, props.sourceNodeOptions), [node, props.targetTree, props.sourceFieldOptions, props.sourceNodeOptions]);
  const suggestedSourceChoices = useMemo(() => rankSuggestedSourceChoices(node, sourceChoices).slice(0, 5), [node, sourceChoices]);
  const manualSourceChoices = useMemo(() => {
    const query = manualSourceQuery.trim().toLowerCase();
    if (!query) return sourceChoices.slice(0, 12);
    return sourceChoices.filter((choice) => choice.label.toLowerCase().includes(query) || choice.value.toLowerCase().includes(query)).slice(0, 12);
  }, [manualSourceQuery, sourceChoices]);
  const bindingMode = node?.binding?.mode ?? 'unmapped';
  const evalLanguage = detectCodeLanguage(node?.binding?.evalExpression ?? '');
  const evalLooksLikeScript = shouldPersistEvalAsScript(node?.binding?.evalExpression ?? '');
  const focusedSourcePath = props.draggedSourcePath || draftManualSourcePath.trim();
  const reviewTargets = useMemo(
    () => ({
      empty: props.reviewTargetIds.empty.map((id) => findNodeById(props.targetTree, id)).filter(Boolean) as SchemaNodeDraft[],
      rule: props.reviewTargetIds.rule.map((id) => findNodeById(props.targetTree, id)).filter(Boolean) as SchemaNodeDraft[],
      error: props.reviewTargetIds.error.map((id) => findNodeById(props.targetTree, id)).filter(Boolean) as SchemaNodeDraft[]
    }),
    [props.reviewTargetIds, props.targetTree]
  );

  return (
    <section className="rewrite-panel workbench-panel" data-testid="react-workbench-panel">
      <div className="panel-header">
        <div>
          <p className="panel-kicker">INSPECTOR</p>
          <h3>Refino do campo</h3>
          <p>Selecione o destino, escolha o modo de preenchimento e refine alias, defaults, eval, script e map_from.</p>
        </div>
      </div>

      <div className="flow-card">
        <strong>Como revisar o campo selecionado</strong>
        <ol>
          <li>Escolha o campo ou container no seletor abaixo.</li>
          <li>Defina o modo de binding ou o <code>map_from</code>.</li>
          <li>Revise os contadores e alertas antes de persistir.</li>
        </ol>
      </div>

      <div className="review-nav">
        <div className="review-card"><strong>{props.reviewCounts.empty}</strong><span>Sem preenchimento</span><small>Campos que ainda precisam de origem ou regra.</small></div>
        <div className="review-card"><strong>{props.reviewCounts.rule}</strong><span>Eval ou script</span><small>Campos gerados por regra visual ou código.</small></div>
        <div className="review-card"><strong>{props.reviewCounts.error}</strong><span>Com alerta</span><small>Bindings que merecem revisão antes do save.</small></div>
      </div>

      {reviewTargets.empty.length > 0 || reviewTargets.rule.length > 0 || reviewTargets.error.length > 0 ? (
        <div className="review-buckets">
          {reviewTargets.empty.length > 0 ? <ReviewBucket title="Revisar campos vazios" tone="empty" items={reviewTargets.empty} onSelectTarget={props.onSelectTarget} /> : null}
          {reviewTargets.rule.length > 0 ? <ReviewBucket title="Campos com eval ou script" tone="rule" items={reviewTargets.rule} onSelectTarget={props.onSelectTarget} /> : null}
          {reviewTargets.error.length > 0 ? <ReviewBucket title="Campos com alerta" tone="error" items={reviewTargets.error} onSelectTarget={props.onSelectTarget} /> : null}
        </div>
      ) : null}

      <div className="panel-stats">
        <div className="stat-chip"><strong>{fieldTargets.length}</strong><span>campos no destino</span></div>
        <div className="stat-chip"><strong>{props.mappedCount}</strong><span>campos mapeados</span></div>
        {node ? <div className="stat-chip selected"><strong>{node.kind === 'field' ? node.type : node.kind}</strong><span>{node.displayPath}</span></div> : null}
      </div>

      <div className="toolbar">
        <label className="field-label" htmlFor="workbench-target-select">Campo ou container de destino</label>
        <select id="workbench-target-select" value={node?.id ?? ''} onChange={(event) => props.onSelectTarget(event.target.value)}>
          <option value="">Selecione um destino</option>
          {flattenSelectableTargets(props.targetTree).map((item) => <option key={item.id} value={item.id}>{item.displayPath}</option>)}
        </select>
      </div>

      {!node ? (
        <div className="empty-state-card">
          <strong>Selecione um nó do destino</strong>
          <p>O inspector nativo em React já consegue editar bindings dos campos e o map_from dos containers.</p>
        </div>
      ) : (
        <>
          <div className="selection-summary">
            <strong>{node.displayPath}</strong>
            <div className="summary-badges">
              <span className="badge">{node.kind === 'field' ? node.type : node.kind}</span>
              {node.mapFrom?.sourcePaths?.[0] ? <span className="item-badge">map_from ativo</span> : null}
              {node.binding?.mode && node.binding.mode !== 'unmapped' ? <span className="map-badge">{node.binding.mode}</span> : null}
              {node.binding?.mode === 'concat' ? <span className="item-badge">fan-in {node.binding.sourcePaths.filter(Boolean).length}</span> : null}
            </div>
          </div>

          {selectedSourceLabels(node, props.sourceFieldOptions, props.sourceNodeOptions).length > 0 ? (
            <div className="source-strip">
              {selectedSourceLabels(node, props.sourceFieldOptions, props.sourceNodeOptions).map((label) => <span key={`${node.id}-${label}`}>{label}</span>)}
            </div>
          ) : null}

          <div className="summary-card compact">
            <div><strong>{mappedTargets.length}</strong><span>campos configurados</span></div>
            <div className="summary-pills">
              <span className="mode-pill subtle">alias {mappingsByMode(mappedTargets, 'alias')}</span>
              <span className="mode-pill subtle">concat {mappingsByMode(mappedTargets, 'concat')}</span>
              <span className="mode-pill subtle">default {mappingsByMode(mappedTargets, 'defaultLiteral') + mappingsByMode(mappedTargets, 'defaultSource')}</span>
              <span className="mode-pill subtle">gera eval/script {props.ruleCount}</span>
            </div>
          </div>

          {node.kind === 'field' ? (
            <>
              <div className="mode-switch mode-switch--wide">
                {bindingModes.map((mode) => <button key={mode.id} type="button" className={bindingMode === mode.id ? 'active' : ''} onClick={() => props.onSetBindingMode(node.id, mode.id)}>{mode.label}</button>)}
              </div>

              <div className="assistants-card">
                <div className="assistants-head">
                  <div>
                    <strong>Ajuda opcional</strong>
                    <small>Sugestões, automapeamento e ligação manual para acelerar a configuração.</small>
                  </div>
                  <button type="button" className="ghost" onClick={() => setAssistantsExpanded((current) => !current)}>{assistantsExpanded ? 'Fechar assistentes' : 'Abrir assistentes'}</button>
                </div>
              </div>

              {assistantsExpanded ? (
                <>
                  <div className="quick-actions">
                    <button type="button" onClick={() => props.onApplySuggestedMapping(node.id)}>Melhor sugestão</button>
                    <button type="button" className="ghost" onClick={() => props.onApplySuggestedMappingsBatch()}>Automapear campos vazios</button>
                  </div>

                  {suggestedSourceChoices.length > 0 ? (
                    <div className="suggestion-card">
                      <div className="suggestion-head">
                        <strong>Sugestões para o campo selecionado</strong>
                        <small>{bindingMode === 'concat' ? 'Clique para adicionar rapidamente uma origem ao concat atual.' : bindingMode === 'defaultSource' ? 'Clique para usar uma origem como default dinâmico.' : 'Clique para preencher rapidamente o campo selecionado.'}</small>
                      </div>
                      <div className="suggestion-list">
                        {suggestedSourceChoices.map((source) => (
                          <button key={source.id} type="button" className="ghost suggestion-btn" onClick={() => applySourceForMode(node.id, bindingMode, source.value, props)}>
                            <span>{source.label}</span>
                            <small>{source.value}</small>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="manual-link-card">
                    <div className="manual-link-head">
                      <div>
                        <strong>Ligação manual</strong>
                        <small>Busque uma origem, fixe o caminho e conecte visualmente ao binding certo do campo.</small>
                      </div>
                    </div>
                    <div className="binding-block">
                      <label className="field-label" htmlFor="manual-source-search">Buscar origem</label>
                      <input id="manual-source-search" value={manualSourceQuery} onChange={(event) => setManualSourceQuery(event.target.value)} placeholder="Buscar por nome ou caminho" />
                      <div className="manual-source-list">
                        {manualSourceChoices.map((source) => (
                          <button
                            key={source.id}
                            type="button"
                            className="ghost manual-source-btn"
                            draggable
                            onDragStart={(event) => {
                              event.dataTransfer.effectAllowed = 'copy';
                              event.dataTransfer.setData('text/plain', source.value);
                              setDraftManualSourcePath(source.value);
                            }}
                            onClick={() => setDraftManualSourcePath(source.value)}
                          >
                            <span>{source.label}</span>
                            <small>{source.value}</small>
                          </button>
                        ))}
                      </div>
                      <div className={`link-builder-frame ${focusedSourcePath ? 'ready' : ''} ${hoveredLinkLane ? `lane-${hoveredLinkLane}` : ''}`}>
                        <div className="link-canvas">
                          <div className="link-canvas-source">
                            <span className="canvas-label">Origem em foco</span>
                            <strong>{focusedSourcePath || 'Escolha ou arraste um campo da origem'}</strong>
                            <small>O campo arrastado da origem ou o caminho digitado aqui aparece como ponto de partida.</small>
                          </div>
                          <div className="link-canvas-target">
                            <span className="canvas-label">Destino selecionado</span>
                            <strong>{node.displayPath}</strong>
                            <small>{node.kind === 'field' ? 'Use as lanes abaixo para definir como esse campo será preenchido.' : 'Use map_from para iterar a origem antes de preencher os filhos.'}</small>
                          </div>
                        </div>

                        <div className="link-lanes">
                          {(['alias', 'concat', 'defaultSource', 'fallback'] as LinkLaneKind[]).map((lane) => (
                            <button
                              key={lane}
                              type="button"
                              className={`link-lane ${focusedSourcePath ? 'ready' : ''} ${hoveredLinkLane === lane ? 'hovered' : ''}`}
                              onMouseEnter={() => setHoveredLinkLane(lane)}
                              onMouseLeave={() => setHoveredLinkLane((current) => (current === lane ? null : current))}
                              onDragOver={(event) => {
                                if (!focusedSourcePath && !event.dataTransfer.getData('text/plain')) {
                                  return;
                                }
                                event.preventDefault();
                                event.dataTransfer.dropEffect = 'copy';
                                setHoveredLinkLane(lane);
                              }}
                              onDragLeave={() => setHoveredLinkLane((current) => (current === lane ? null : current))}
                              onDrop={(event) => {
                                event.preventDefault();
                                const droppedPath = event.dataTransfer.getData('text/plain') || focusedSourcePath;
                                setHoveredLinkLane(null);
                                if (!droppedPath) {
                                  return;
                                }
                                setDraftManualSourcePath(droppedPath);
                                applyLane(node.id, lane, droppedPath, props);
                              }}
                              onClick={() => {
                                if (!focusedSourcePath) {
                                  return;
                                }
                                applyLane(node.id, lane, focusedSourcePath, props);
                              }}
                            >
                              <strong>{formatLaneTitle(lane)}</strong>
                              <small>{describeLane(lane, node)}</small>
                            </button>
                          ))}
                        </div>
                      </div>
                      <label className="field-label" htmlFor="manual-source-path">Caminho selecionado</label>
                      <input id="manual-source-path" value={draftManualSourcePath} onChange={(event) => setDraftManualSourcePath(event.target.value)} placeholder="$.dadosApolice.codigoMarca" />
                      <div className="manual-actions">
                        <button type="button" disabled={!draftManualSourcePath.trim()} onClick={() => props.onSetAliasSource(node.id, draftManualSourcePath.trim())}>Usar como alias</button>
                        <button type="button" className="ghost" disabled={!draftManualSourcePath.trim()} onClick={() => props.onAddConcatSource(node.id, draftManualSourcePath.trim())}>Adicionar ao concat</button>
                        <button type="button" className="ghost" disabled={!draftManualSourcePath.trim()} onClick={() => props.onSetDefaultSource(node.id, draftManualSourcePath.trim())}>Usar como default</button>
                        <button type="button" className="ghost" disabled={!draftManualSourcePath.trim()} onClick={() => props.onAddAliasFallback(node.id, draftManualSourcePath.trim())}>Adicionar fallback</button>
                      </div>
                    </div>
                  </div>
                </>
              ) : null}

              {(bindingMode === 'unmapped' || !node.binding) ? <div className="empty-state-card"><strong>Campo ainda sem binding</strong><p>Escolha um modo acima para começar a preencher esse campo no rewrite React.</p></div> : null}

              {bindingMode === 'alias' ? (
                <div className="inspector-section">
                  <label className="field-label" htmlFor="alias-source-select">Origem principal</label>
                  <select id="alias-source-select" value={node.binding?.sourcePaths?.[0] ?? ''} onChange={(event) => props.onSetAliasSource(node.id, event.target.value)}>
                    <option value="">Selecione um campo da origem</option>
                    {sourceChoices.map((source) => <option key={source.id} value={source.value}>{source.label}</option>)}
                  </select>
                  <label className="field-label" htmlFor="alias-strategy-select">Estratégia de fallback</label>
                  <select id="alias-strategy-select" value={node.binding?.aliasStrategy ?? 'fallback'} onChange={(event) => props.onUpdateAliasStrategy(node.id, event.target.value as 'first' | 'fallback')}>
                    <option value="fallback">Primeiro valor disponível</option>
                    <option value="first">Sempre primeiro alias</option>
                  </select>
                  {(node.binding?.sourcePaths?.slice(1).length ?? 0) > 0 ? (
                    <div className="segment-list">
                      {node.binding?.sourcePaths.slice(1).map((sourcePath, index) => (
                        <div key={`${sourcePath}-${index}`} className="segment-row alias-row">
                          <select value={sourcePath} onChange={(event) => props.onReplaceAliasFallback(node.id, index + 1, event.target.value)}>
                            {sourceChoices.map((source) => <option key={source.id} value={source.value}>{source.label}</option>)}
                          </select>
                          <button type="button" className="danger-button compact-button" onClick={() => props.onRemoveAliasFallback(node.id, index + 1)}>×</button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  <div className="inline-actions">
                    <select value={draftAliasFallback} onChange={(event) => setDraftAliasFallback(event.target.value)}>
                      <option value="">Adicionar alias de fallback</option>
                      {sourceChoices.map((source) => <option key={source.id} value={source.value}>{source.label}</option>)}
                    </select>
                    <button type="button" className="ghost" disabled={!draftAliasFallback} onClick={() => { props.onAddAliasFallback(node.id, draftAliasFallback); setDraftAliasFallback(''); }}>Adicionar</button>
                  </div>
                </div>
              ) : null}

              {bindingMode === 'concat' ? (
                <div className="inspector-section">
                  <label className="field-label" htmlFor="concat-source-select">Adicionar origem ao concat</label>
                  <div className="inline-actions">
                    <select id="concat-source-select" value={draftConcatSource} onChange={(event) => setDraftConcatSource(event.target.value)}>
                      <option value="">Selecione um campo da origem</option>
                      {sourceChoices.map((source) => <option key={source.id} value={source.value}>{source.label}</option>)}
                    </select>
                    <button type="button" className="ghost" disabled={!draftConcatSource} onClick={() => { props.onAddConcatSource(node.id, draftConcatSource); setDraftConcatSource(''); }}>Adicionar</button>
                  </div>
                  <div className="segment-list">
                    {(node.binding?.sourcePaths ?? []).filter(Boolean).map((sourcePath, index, items) => (
                      <div key={`${sourcePath}-${index}`} className="segment-card" onMouseEnter={() => props.onHoverConcatSegment(index)} onMouseLeave={() => props.onHoverConcatSegment(null)}>
                        <div className="segment-head"><span className="segment-index">Entrada {index + 1}</span><small>Porta {index + 1} no destino</small></div>
                        <div className="segment-row">
                          <div className="token-chip token-chip--full">{contextualSourceLabel(sourcePath, node, props.sourceFieldOptions, props.sourceNodeOptions)}</div>
                          <button type="button" className="ghost" onClick={() => props.onMoveConcatSource(node.id, index, -1)} disabled={index === 0}>↑</button>
                          <button type="button" className="ghost" onClick={() => props.onMoveConcatSource(node.id, index, 1)} disabled={index === items.length - 1}>↓</button>
                          <button type="button" className="danger-button compact-button" onClick={() => props.onRemoveConcatSource(node.id, sourcePath)}>×</button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <label className="field-label" htmlFor="concat-separator-input">Separador entre segmentos</label>
                  <div className="preset-row">
                    <button type="button" className="ghost" onClick={() => props.onUpdateConcatSeparator(node.id, '')}>Sem separador</button>
                    <button type="button" className="ghost" onClick={() => props.onUpdateConcatSeparator(node.id, '-')}>-</button>
                    <button type="button" className="ghost" onClick={() => props.onUpdateConcatSeparator(node.id, '|')}>|</button>
                    <button type="button" className="ghost" onClick={() => props.onUpdateConcatSeparator(node.id, ' ')}>Espaço</button>
                  </div>
                  <input id="concat-separator-input" value={node.binding?.separator ?? ''} onChange={(event) => props.onUpdateConcatSeparator(node.id, event.target.value)} placeholder="Ex.: -" />
                  {(node.binding?.sourcePaths ?? []).filter(Boolean).map((sourcePath, index) => {
                    const formatter = node.binding?.formatters?.[index];
                    const hasFormatter = (formatter?.length ?? 0) > 0;
                    return (
                      <div key={`formatter-${sourcePath}-${index}`} className="segment-card">
                        <div className="segment-head"><span className="segment-index">Formatação {index + 1}</span><small>{contextualSourceLabel(sourcePath, node, props.sourceFieldOptions, props.sourceNodeOptions)}</small></div>
                        {hasFormatter ? (
                          <div className="format-row">
                            <select value={formatter?.pad ?? 'left'} onChange={(event) => props.onUpdateConcatFormat(node.id, index, { pad: event.target.value as 'left' | 'right' })}>
                              <option value="left">pad left</option>
                              <option value="right">pad right</option>
                            </select>
                            <input type="number" value={formatter?.length ?? 0} onChange={(event) => props.onUpdateConcatFormat(node.id, index, { length: Number(event.target.value) })} placeholder="tamanho" />
                            <input value={formatter?.char ?? '0'} onChange={(event) => props.onUpdateConcatFormat(node.id, index, { char: event.target.value })} placeholder="char" />
                            <button type="button" className="ghost" onClick={() => props.onClearConcatFormat(node.id, index)}>Sem formatação</button>
                          </div>
                        ) : (
                          <button type="button" className="ghost inline-action" onClick={() => props.onUpdateConcatFormat(node.id, index, { pad: 'left', length: 1, char: '0' })}>Configurar formatação</button>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : null}

              {bindingMode === 'defaultLiteral' ? (
                <div className="inspector-section">
                  <label className="field-label" htmlFor="default-literal-input">Valor fixo</label>
                  <div className="preset-row">
                    <button type="button" className="ghost" onClick={() => props.onSetDefaultLiteral(node.id, 'APOLICE')}>APOLICE</button>
                    <button type="button" className="ghost" onClick={() => props.onSetDefaultLiteral(node.id, '61199164000160')}>CNPJ produtor</button>
                    <button type="button" className="ghost" onClick={() => props.onSetDefaultLiteral(node.id, 'Porto')}>Porto</button>
                  </div>
                  <input id="default-literal-input" value={node.binding?.defaultValue ?? ''} onChange={(event) => props.onSetDefaultLiteral(node.id, event.target.value)} placeholder="Ex.: APOLICE" />
                </div>
              ) : null}

              {bindingMode === 'defaultSource' ? (
                <div className="inspector-section">
                  <label className="field-label" htmlFor="default-source-select">Campo da origem usado como fallback</label>
                  <select id="default-source-select" value={node.binding?.defaultSourcePath ?? ''} onChange={(event) => props.onSetDefaultSource(node.id, event.target.value)}>
                    <option value="">Selecione um campo da origem</option>
                    {sourceChoices.map((source) => <option key={source.id} value={source.value}>{source.label}</option>)}
                  </select>
                </div>
              ) : null}

              {bindingMode === 'eval' ? (
                <div className="inspector-section">
                  <div className="section-head"><strong>Expressão eval</strong><span className={evalLooksLikeScript ? 'rule-badge' : 'badge'}>{evalLooksLikeScript ? 'Script detectado' : 'Expressão declarativa'}</span></div>
                  <div className="helper-copy">Linguagem detectada: <strong>{formatLanguage(evalLanguage)}</strong></div>
                  <textarea value={node.binding?.evalExpression ?? ''} onChange={(event) => props.onSetEvalExpression(node.id, event.target.value, shouldPersistEvalAsScript(event.target.value) ? 'script' : undefined)} placeholder={'resultado = "Porto" if dadosApolice.codigoMarca == 1001 else "Não identificado"\nreturn resultado'} />
                </div>
              ) : null}

              {bindingMode === 'script' ? (
                <div className="inspector-section">
                  <div className="section-head"><strong>Script</strong><span className="rule-badge">Vai para eval_type = script</span></div>
                  <label className="field-label" htmlFor="script-language-select">Linguagem</label>
                  <select id="script-language-select" value={node.binding?.script?.language ?? 'java'} onChange={(event) => props.onSetScript(node.id, { language: event.target.value as 'java' | 'javascript' | 'python' })}>
                    <option value="java">Java</option>
                    <option value="javascript">JavaScript / TypeScript</option>
                    <option value="python">Python</option>
                  </select>
                  <label className="field-label" htmlFor="script-source-input">Bloco de código</label>
                  <textarea id="script-source-input" value={node.binding?.script?.source ?? ''} onChange={(event) => props.onSetScript(node.id, { source: event.target.value })} placeholder={'return dadosApolice.codigoMarca == 1001 ? "Porto" : "Não identificado";'} />
                  <label className="field-label" htmlFor="script-return-type-input">Tipo de retorno</label>
                  <input id="script-return-type-input" value={node.binding?.script?.returnType ?? node.type} onChange={(event) => props.onSetScript(node.id, { returnType: event.target.value })} placeholder={node.type} />
                </div>
              ) : null}

              <div className="inspector-section">
                <div className="section-head"><strong>Campo avançado (opcional)</strong><span className="badge">Quando alias, default, concat e eval não bastarem</span></div>
                <textarea value={node.binding?.advancedExpression ?? ''} onChange={(event) => props.onSetAdvancedExpression(node.id, event.target.value)} placeholder={"concat(src('$.dadosApolice.codigoSucursal'), '-', src('$.dadosApolice.numeroApolice'))"} />
              </div>
            </>
          ) : (
            <div className="inspector-section">
              <label className="field-label" htmlFor="map-from-select">map_from da origem</label>
              <select id="map-from-select" value={node.mapFrom?.sourcePaths?.[0] ?? ''} onChange={(event) => props.onSetMapFromSource(node.id, event.target.value)}>
                <option value="">Sem map_from</option>
                {props.sourceNodeOptions.filter((item) => item.kind === 'array' || item.kind === 'object').map((source) => <option key={source.id} value={source.path}>{contextualSourceLabel(source.path, node, props.sourceFieldOptions, props.sourceNodeOptions)}</option>)}
              </select>
              <p className="helper-copy">Use em arrays e objetos container quando o backend precisa iterar a origem antes de preencher os filhos.</p>
            </div>
          )}

          <div className="mapping-list">
            {mappedTargets.map((item) => (
              <button key={item.id} type="button" className="mapping-item" onClick={() => props.onSelectTarget(item.id)}>
                <span className="mapping-head"><strong>{item.displayPath}</strong><span className="mode-pill">{item.binding?.mode}</span></span>
                <small>{describeBinding(item, props.sourceFieldOptions, props.sourceNodeOptions)}</small>
              </button>
            ))}
            {mappedTargets.length === 0 ? <p className="empty-hint">Nenhum campo configurado ainda.</p> : null}
          </div>
        </>
      )}

      {props.validationErrors.length > 0 ? (
        <div className="errors-card">
          <strong>Alertas de validação</strong>
          <ul>{props.validationErrors.map((error) => <li key={error}>{error}</li>)}</ul>
        </div>
      ) : null}
    </section>
  );
}

function flattenSelectableTargets(nodes: SchemaNodeDraft[]): SchemaNodeDraft[] {
  return nodes.flatMap((node) => [ ...(node.kind === 'root' ? [] : [node]), ...flattenSelectableTargets(node.children) ]);
}

function flattenFieldTargets(nodes: SchemaNodeDraft[]): SchemaNodeDraft[] {
  return nodes.flatMap((node) => [ ...(node.kind === 'field' ? [node] : []), ...flattenFieldTargets(node.children) ]);
}

function formatLanguage(value: 'javascript' | 'java' | 'python'): string {
  return value === 'python' ? 'Python' : value === 'java' ? 'Java' : 'JavaScript / TypeScript';
}

function mappingsByMode(nodes: SchemaNodeDraft[], mode: WorkbenchMode | 'rule'): number {
  return nodes.filter((node) => node.binding?.mode === mode).length;
}

function selectedSourceLabels(selectedTargetNode: SchemaNodeDraft, sourceFields: SchemaNodeDraft[], sourceNodes: SchemaNodeDraft[]): string[] {
  const binding = selectedTargetNode.binding;
  if (!binding) return [];
  const paths = binding.mode === 'defaultSource' ? [binding.defaultSourcePath] : binding.sourcePaths;
  return paths.filter(Boolean).map((path) => contextualSourceLabel(path, selectedTargetNode, sourceFields, sourceNodes));
}

function contextualSourceLabel(sourcePath: string, targetNode: SchemaNodeDraft | null, sourceFields: SchemaNodeDraft[], sourceNodes: SchemaNodeDraft[]): string {
  const fallback = sourceFields.find((node) => node.path === sourcePath)?.displayPath ?? sourceNodes.find((node) => node.path === sourcePath)?.displayPath ?? sourcePath;
  return targetNode ? fallback.replace(/^\$\./, '') : fallback;
}

function buildSourceChoices(selectedTargetNode: SchemaNodeDraft | null, targetTree: SchemaNodeDraft[], sourceFields: SchemaNodeDraft[], sourceNodes: SchemaNodeDraft[]) {
  return sourceFields.map((source) => {
    const contextualValue = selectedTargetNode ? relativizeSourcePathForTarget(targetTree, selectedTargetNode, source.path) : source.path;
    const labelBase = contextualSourceLabel(contextualValue, selectedTargetNode, sourceFields, sourceNodes);
    return { id: source.id, value: contextualValue, label: contextualValue.startsWith('$.') && !source.path.startsWith(contextualValue) ? `${labelBase} · item atual` : labelBase };
  });
}

function rankSuggestedSourceChoices(selectedTargetNode: SchemaNodeDraft | null, sourceChoices: Array<{ id: string; value: string; label: string }>) {
  if (!selectedTargetNode) return sourceChoices;
  const targetKey = normalizeToken(selectedTargetNode.key);
  const targetPath = normalizeToken(selectedTargetNode.displayPath);
  return [...sourceChoices].sort((left, right) => scoreChoice(right, targetKey, targetPath) - scoreChoice(left, targetKey, targetPath));
}

function scoreChoice(choice: { label: string; value: string }, targetKey: string, targetPath: string): number {
  const label = normalizeToken(choice.label);
  const value = normalizeToken(choice.value);
  if (label === targetKey || value.endsWith(targetKey)) return 100;
  if (label.includes(targetKey) || value.includes(targetKey)) return 60;
  if (targetPath && (label.includes(targetPath) || value.includes(targetPath))) return 40;
  return 0;
}

function normalizeToken(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9.]+/g, '').toLowerCase();
}

function applySourceForMode(targetNodeId: string, mode: WorkbenchMode | 'unmapped', sourcePath: string, props: Pick<WorkbenchPanelProps, 'onSetAliasSource' | 'onAddConcatSource' | 'onSetDefaultSource'>) {
  if (mode === 'concat') return props.onAddConcatSource(targetNodeId, sourcePath);
  if (mode === 'defaultSource') return props.onSetDefaultSource(targetNodeId, sourcePath);
  return props.onSetAliasSource(targetNodeId, sourcePath);
}

function applyLane(
  targetNodeId: string,
  lane: LinkLaneKind,
  sourcePath: string,
  props: Pick<WorkbenchPanelProps, 'onSetAliasSource' | 'onAddConcatSource' | 'onSetDefaultSource' | 'onAddAliasFallback'>
) {
  if (lane === 'concat') {
    props.onAddConcatSource(targetNodeId, sourcePath);
    return;
  }

  if (lane === 'defaultSource') {
    props.onSetDefaultSource(targetNodeId, sourcePath);
    return;
  }

  if (lane === 'fallback') {
    props.onAddAliasFallback(targetNodeId, sourcePath);
    return;
  }

  props.onSetAliasSource(targetNodeId, sourcePath);
}

function formatLaneTitle(lane: LinkLaneKind): string {
  if (lane === 'alias') return 'Alias principal';
  if (lane === 'concat') return 'Concat';
  if (lane === 'defaultSource') return 'Default da origem';
  return 'Fallback';
}

function describeLane(lane: LinkLaneKind, node: SchemaNodeDraft): string {
  if (lane === 'alias') {
    return node.binding?.sourcePaths?.[0]
      ? 'Substitui a origem principal atual desse campo.'
      : 'Liga uma origem principal diretamente a esse campo.';
  }

  if (lane === 'concat') {
    const count = node.binding?.mode === 'concat' ? node.binding.sourcePaths.filter(Boolean).length : 0;
    return count > 0
      ? `Acrescenta mais uma entrada ao fan-in atual (${count} ligada${count > 1 ? 's' : ''}).`
      : 'Cria ou complementa o concat desse campo.';
  }

  if (lane === 'defaultSource') {
    return node.binding?.defaultSourcePath
      ? 'Troca o default dinâmico vindo da origem.'
      : 'Usa uma origem como valor padrão quando o campo vier vazio.';
  }

  return (node.binding?.sourcePaths?.slice(1).length ?? 0) > 0
    ? 'Adiciona mais uma origem de fallback para esse campo.'
    : 'Registra uma origem alternativa para fallback.';
}

function relativizeSourcePathForTarget(targetTree: SchemaNodeDraft[], targetNode: SchemaNodeDraft, sourcePath: string): string {
  const mapFromAncestors = findMapFromAncestors(targetTree, targetNode);
  if (mapFromAncestors.length === 0) return sourcePath;
  const candidatePrefixes = buildMapFromCandidatePrefixes(mapFromAncestors);
  const matchedPrefix = candidatePrefixes.sort((left, right) => right.length - left.length).find((prefix) => sourcePath === prefix || sourcePath.startsWith(`${prefix}.`));
  if (!matchedPrefix) return sourcePath;
  if (sourcePath === matchedPrefix) return '$';
  const relativeSourcePath = sourcePath.slice(matchedPrefix.length + 1);
  const contextual = stripTargetObjectContext(targetTree, targetNode, mapFromAncestors[mapFromAncestors.length - 1]?.id ?? null, relativeSourcePath);
  return contextual ? `$.${contextual}` : '$';
}

function findMapFromAncestors(nodes: SchemaNodeDraft[], node: SchemaNodeDraft): SchemaNodeDraft[] {
  const ancestors: SchemaNodeDraft[] = [];
  let currentParentId = node.parentId;
  while (currentParentId) {
    const parent = findNodeById(nodes, currentParentId);
    if (!parent) return ancestors;
    if (parent.kind === 'array' && parent.mapFrom?.sourcePaths?.some(Boolean)) ancestors.unshift(parent);
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
    if (sourcePaths.length === 0) return;
    if (prefixes.length === 0) {
      prefixes = sourcePaths.map((path) => ensureIndexedCollectionPath(path));
      return;
    }
    const nextPrefixes = new Set<string>();
    sourcePaths.forEach((path) => {
      nextPrefixes.add(ensureIndexedCollectionPath(path));
      const normalizedSegment = stripDollarPrefix(path);
      prefixes.forEach((prefix) => nextPrefixes.add(ensureIndexedCollectionPath(`${prefix}.${normalizedSegment}`)));
    });
    prefixes = Array.from(nextPrefixes);
  });
  return prefixes;
}

function buildTargetObjectContextSegments(nodes: SchemaNodeDraft[], targetNode: SchemaNodeDraft, nearestMapFromAncestorId: string): string[] {
  const segments: string[] = [];
  let currentNodeId = targetNode.kind === 'object' && !targetNode.itemModel ? targetNode.id : targetNode.parentId;
  while (currentNodeId && currentNodeId !== nearestMapFromAncestorId) {
    const currentNode = findNodeById(nodes, currentNodeId);
    if (!currentNode) break;
    if (currentNode.kind === 'object' && !currentNode.itemModel) segments.unshift(currentNode.key);
    currentNodeId = currentNode.parentId;
  }
  return segments;
}

function stripTargetObjectContext(nodes: SchemaNodeDraft[], targetNode: SchemaNodeDraft, nearestMapFromAncestorId: string | null, relativeSourcePath: string): string {
  if (!nearestMapFromAncestorId) return relativeSourcePath;
  const objectContextSegments = buildTargetObjectContextSegments(nodes, targetNode, nearestMapFromAncestorId);
  if (objectContextSegments.length === 0) return relativeSourcePath;
  const candidates = Array.from({ length: objectContextSegments.length }, (_, index) => objectContextSegments.slice(index).join('.'));
  for (const candidate of candidates) {
    if (relativeSourcePath === candidate) return '';
    if (relativeSourcePath.startsWith(`${candidate}.`)) return relativeSourcePath.slice(candidate.length + 1);
  }
  return relativeSourcePath;
}

function describeBinding(node: SchemaNodeDraft, sourceFields: SchemaNodeDraft[], sourceNodes: SchemaNodeDraft[]): string {
  const binding = node.binding;
  if (!binding) return 'Sem binding';
  if (binding.mode === 'alias') return contextualSourceLabel(binding.sourcePaths[0] ?? '', node, sourceFields, sourceNodes);
  if (binding.mode === 'concat') return binding.sourcePaths.map((path) => contextualSourceLabel(path, node, sourceFields, sourceNodes)).join(' + ');
  if (binding.mode === 'defaultLiteral') return `Default fixo: ${binding.defaultValue || '(vazio)'}`;
  if (binding.mode === 'defaultSource') return `Default da origem: ${contextualSourceLabel(binding.defaultSourcePath, node, sourceFields, sourceNodes)}`;
  if (binding.mode === 'eval') return binding.evalExpression ? 'Eval configurado' : 'Eval vazio';
  if (binding.mode === 'script') return binding.script?.source ? `Script ${binding.script.language} configurado` : 'Script vazio';
  return 'Sem binding';
}

function ReviewBucket(props: { title: string; tone: 'empty' | 'rule' | 'error'; items: SchemaNodeDraft[]; onSelectTarget(nodeId: string): void }): JSX.Element {
  return (
    <div className={`review-bucket review-bucket--${props.tone}`}>
      <strong>{props.title}</strong>
      <div className="review-bucket-list">
        {props.items.map((item) => (
          <button key={item.id} type="button" className="review-bucket-item" onClick={() => props.onSelectTarget(item.id)}>
            <span>{item.displayPath}</span>
            <small>{item.binding?.mode ?? item.kind}</small>
          </button>
        ))}
      </div>
    </div>
  );
}
