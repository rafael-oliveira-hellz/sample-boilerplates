import { useMemo, useState, type ChangeEvent, type DragEvent } from 'react';
import { PROGRAMMING_TYPE_OPTION_GROUPS, type SchemaNodeDraft, type SchemaPanelState } from '../../core/models/mapperModels';
import { flattenLeafNodes } from '../schema/treeState';

type UsageFilter = 'all' | 'used' | 'unused' | 'leaves';

interface SourcePanelProps {
  panelState: SchemaPanelState;
  nodes: SchemaNodeDraft[];
  selectedNode: SchemaNodeDraft | null;
  usedPaths: Set<string>;
  onPanelStateChange(nextState: SchemaPanelState | ((current: SchemaPanelState) => SchemaPanelState)): void;
  onImportFile(file: File): Promise<void>;
  onApplyText(): void;
  onToggleNode(nodeId: string): void;
  onSelectNode(nodeId: string): void;
  onSetAllExpanded(expanded: boolean): void;
  onAddNode(kind: 'field' | 'object' | 'array'): void;
  onRemoveSelected(): void;
  onRenameNode(nodeId: string, nextKey: string): void;
  onUpdateNodeType(nodeId: string, nextType: string): void;
  onUpdateNodeNullable(nodeId: string, nullable: boolean): void;
  onDragSourceStart(sourcePath: string): void;
  onDragSourceEnd(): void;
}

export function SourcePanel(props: SourcePanelProps): JSX.Element {
  const { panelState, nodes, selectedNode, usedPaths } = props;
  const [typeFilter, setTypeFilter] = useState('all');
  const [usageFilter, setUsageFilter] = useState<UsageFilter>('all');
  const search = panelState.search.trim().toLowerCase();

  const visibleLeafCount = useMemo(
    () => flattenLeafNodes(nodes).filter((node) => matchesNode(node, search) && matchesLeafFilters(node, typeFilter, usageFilter, usedPaths)).length,
    [nodes, search, typeFilter, usageFilter, usedPaths]
  );
  const searchMatchesCount = useMemo(
    () => flattenLeafNodes(nodes).filter((node) => directSearchMatch(node, search) && matchesLeafFilters(node, typeFilter, usageFilter, usedPaths)).length,
    [nodes, search, typeFilter, usageFilter, usedPaths]
  );

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    if (!file) return;
    await props.onImportFile(file);
    event.target.value = '';
  };

  const selectedType = selectedNode?.kind === 'field' ? selectedNode.type : '';

  return (
    <section className="rewrite-panel" data-testid="react-source-panel">
      <div className="panel-header">
        <div>
          <p className="panel-kicker">ORIGEM</p>
          <h3>Dados de entrada</h3>
          <p>Importe o JSON ou monte a leitura técnica do schema de origem.</p>
        </div>
        <div className="mode-switch">
          <button type="button" className={!panelState.technicalMode ? 'active' : ''} onClick={() => props.onPanelStateChange((current) => ({ ...current, technicalMode: false }))}>
            Builder
          </button>
          <button type="button" className={panelState.technicalMode ? 'active' : ''} onClick={() => props.onPanelStateChange((current) => ({ ...current, technicalMode: true }))}>
            JSON
          </button>
        </div>
      </div>

      <div className="panel-stats">
        <div className="stat-chip">
          <strong>{visibleLeafCount}</strong>
          <span>campos visíveis</span>
        </div>
        <div className="stat-chip">
          <strong>{usedPaths.size}</strong>
          <span>campos em uso</span>
        </div>
        {selectedNode ? (
          <div className="stat-chip selected">
            <strong>{selectedNode.kind === 'field' ? selectedNode.type : selectedNode.kind}</strong>
            <span>{selectedNode.displayPath}</span>
          </div>
        ) : null}
      </div>

      {panelState.technicalMode ? (
        <div className="technical-box">
          <div className="technical-actions">
            <label className="pill-button">
              Selecionar arquivo JSON
              <input type="file" accept="application/json" onChange={handleFileChange} />
            </label>
            <button type="button" className="ghost" onClick={props.onApplyText}>
              Aplicar texto
            </button>
          </div>
          {panelState.importedFile ? <div className="file-summary">{panelState.importedFile.name} · {panelState.importedFile.sizeLabel}</div> : null}
          <textarea
            value={panelState.rawJsonText}
            onChange={(event) => props.onPanelStateChange((current) => ({ ...current, rawJsonText: event.target.value }))}
            placeholder="Cole o JSON Schema de origem aqui."
          />
          {panelState.error ? <p className="panel-error">{panelState.error}</p> : null}
        </div>
      ) : (
        <>
          <div className="toolbar">
            <input
              value={panelState.search}
              onChange={(event) => props.onPanelStateChange((current) => ({ ...current, search: event.target.value }))}
              placeholder="Buscar por nome ou caminho"
            />
            <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
              <option value="all">Todos os tipos</option>
              {PROGRAMMING_TYPE_OPTION_GROUPS.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.options.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <select value={usageFilter} onChange={(event) => setUsageFilter(event.target.value as UsageFilter)}>
              <option value="all">Tudo</option>
              <option value="used">Só usados</option>
              <option value="unused">Só livres</option>
              <option value="leaves">Só folhas</option>
            </select>
            <button
              type="button"
              className="ghost"
              onClick={() => {
                setTypeFilter('all');
                setUsageFilter('all');
                props.onPanelStateChange((current) => ({ ...current, search: '' }));
              }}
            >
              Limpar filtros
            </button>
          </div>

          <div className="toolbar compact search-nav">
            <span className="search-count">{searchMatchesCount} correspondências</span>
          </div>

          {selectedNode ? (
            <div className="selection-card">
              <div className="selection-top">
                <strong>{selectedNode.label}</strong>
                <span className="badge">{selectedNode.kind === 'field' ? selectedNode.type : selectedNode.kind}</span>
              </div>

              {!selectedNode.itemModel && selectedNode.kind !== 'root' ? (
                <label className="field-label">
                  Nome
                  <input value={selectedNode.key} onChange={(event) => props.onRenameNode(selectedNode.id, event.target.value)} />
                </label>
              ) : null}

              {selectedNode.kind === 'field' ? (
                <label className="field-label">
                  Tipo
                  <select value={selectedType} onChange={(event) => props.onUpdateNodeType(selectedNode.id, event.target.value)}>
                    {PROGRAMMING_TYPE_OPTION_GROUPS.map((group) => (
                      <optgroup key={group.label} label={group.label}>
                        {group.options.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </label>
              ) : null}

              {selectedNode.kind !== 'root' ? (
                <label className="checkbox-line">
                  <input type="checkbox" checked={Boolean(selectedNode.nullable)} onChange={(event) => props.onUpdateNodeNullable(selectedNode.id, event.target.checked)} />
                  <span>Aceita nulo</span>
                </label>
              ) : null}

              <div className="breadcrumbs">
                {breadcrumb(selectedNode).map((step) => (
                  <span key={`${selectedNode.id}-${step}`}>{step}</span>
                ))}
              </div>

              <small>{selectedNode.path}</small>
            </div>
          ) : null}

          <div className="toolbar compact">
            <button type="button" className="ghost" onClick={() => props.onSetAllExpanded(true)}>
              Expandir tudo
            </button>
            <button type="button" className="ghost" onClick={() => props.onSetAllExpanded(false)}>
              Recolher tudo
            </button>
          </div>

          <div className="toolbar compact">
            <button type="button" className="ghost" onClick={() => props.onAddNode('field')}>
              + Campo
            </button>
            <button type="button" className="ghost" onClick={() => props.onAddNode('object')}>
              + Objeto
            </button>
            <button type="button" className="ghost" onClick={() => props.onAddNode('array')}>
              + Array
            </button>
            <button type="button" className="danger-button" onClick={props.onRemoveSelected} disabled={!selectedNode || selectedNode.kind === 'root'}>
              Remover selecionado
            </button>
          </div>

          <div className="guide-card">
            <strong>Como montar manualmente</strong>
            <ol>
              <li>Escolha o nó pai na árvore.</li>
              <li>Use <code>+ Campo</code>, <code>+ Objeto</code> ou <code>+ Array</code>.</li>
              <li>Renomeie e ajuste tipo ou nulabilidade no card acima.</li>
              <li>Arraste os campos folha para o destino quando estiver pronto.</li>
            </ol>
          </div>

          <div className="tree-shell">
            {renderNodes(nodes, {
              search,
              typeFilter,
              usageFilter,
              usedPaths,
              selectedNodeId: panelState.selectedNodeId,
              onSelectNode: props.onSelectNode,
              onToggleNode: props.onToggleNode,
              onRenameNode: props.onRenameNode,
              onDragSourceStart: props.onDragSourceStart,
              onDragSourceEnd: props.onDragSourceEnd
            })}
            {visibleLeafCount === 0 ? <div className="empty-tree">Nenhum campo encontrado com os filtros atuais.</div> : null}
          </div>
        </>
      )}
    </section>
  );
}

function renderNodes(
  nodes: SchemaNodeDraft[],
  options: {
    search: string;
    typeFilter: string;
    usageFilter: UsageFilter;
    usedPaths: Set<string>;
    selectedNodeId: string;
    onSelectNode(nodeId: string): void;
    onToggleNode(nodeId: string): void;
    onRenameNode(nodeId: string, nextKey: string): void;
    onDragSourceStart(sourcePath: string): void;
    onDragSourceEnd(): void;
  },
  depth = 0
): JSX.Element[] {
  return nodes.flatMap((node) => {
    if (!matchesTree(node, options.search, options.typeFilter, options.usageFilter, options.usedPaths)) return [];

    const used = options.usedPaths.has(node.path);
    const isSelected = options.selectedNodeId === node.id;
    const row = (
      <div key={node.id} className={`tree-row ${isSelected ? 'selected' : ''} ${used ? 'used' : ''}`} style={{ ['--depth' as string]: depth }}>
        <button type="button" className="expander" onClick={() => (node.children.length > 0 ? options.onToggleNode(node.id) : options.onSelectNode(node.id))}>
          {node.children.length > 0 ? (node.expanded ? '▾' : '▸') : '•'}
        </button>
        <button
          type="button"
          className="node-card"
          draggable={node.kind === 'field'}
          onClick={() => options.onSelectNode(node.id)}
          onDragStart={(event: DragEvent<HTMLButtonElement>) => {
            if (node.kind !== 'field') return;
            event.dataTransfer.effectAllowed = 'copy';
            event.dataTransfer.setData('text/plain', node.path);
            options.onDragSourceStart(node.path);
          }}
          onDragEnd={options.onDragSourceEnd}
        >
          <span className="node-main">
            {isSelected && !node.itemModel && node.kind !== 'root' ? (
              <input
                className="tree-inline-input"
                value={node.key}
                onClick={(event) => event.stopPropagation()}
                onChange={(event) => options.onRenameNode(node.id, event.target.value)}
                aria-label={`Renomear ${node.displayPath}`}
              />
            ) : (
              <strong>{highlightText(node.label, options.search)}</strong>
            )}
            <span className="badge">{node.kind === 'field' ? node.type : node.kind}</span>
            {node.itemModel ? <span className="item-badge">item-modelo</span> : null}
            {used ? <span className="map-badge">em uso</span> : null}
          </span>
          <small>{renderHighlightedPath(node.displayPath, options.search)}</small>
        </button>
      </div>
    );

    return !node.expanded || node.children.length === 0 ? [row] : [row, ...renderNodes(node.children, options, depth + 1)];
  });
}

function matchesTree(node: SchemaNodeDraft, search: string, typeFilter: string, usageFilter: UsageFilter, usedPaths: Set<string>): boolean {
  if (matchesNode(node, search) && matchesLeafFilters(node, typeFilter, usageFilter, usedPaths)) return true;
  return node.children.some((child) => matchesTree(child, search, typeFilter, usageFilter, usedPaths));
}

function matchesNode(node: SchemaNodeDraft, search: string): boolean {
  return !search || node.label.toLowerCase().includes(search) || node.displayPath.toLowerCase().includes(search);
}

function directSearchMatch(node: SchemaNodeDraft, search: string): boolean {
  return matchesNode(node, search);
}

function matchesLeafFilters(node: SchemaNodeDraft, typeFilter: string, usageFilter: UsageFilter, usedPaths: Set<string>): boolean {
  if (usageFilter === 'leaves' && node.kind !== 'field') return false;
  if (node.kind === 'field' && typeFilter !== 'all' && node.type !== typeFilter) return false;
  if (usageFilter === 'used' && !usedPaths.has(node.path)) return false;
  if (usageFilter === 'unused' && node.kind === 'field' && usedPaths.has(node.path)) return false;
  return true;
}

function breadcrumb(node: SchemaNodeDraft): string[] {
  return node.displayPath === 'origem' ? ['origem'] : ['origem', ...node.displayPath.split('.')];
}

function highlightText(value: string, search: string): JSX.Element | string {
  if (!search) {
    return value;
  }

  const normalized = value.toLowerCase();
  const index = normalized.indexOf(search);

  if (index === -1) {
    return value;
  }

  const before = value.slice(0, index);
  const match = value.slice(index, index + search.length);
  const after = value.slice(index + search.length);

  return (
    <>
      {before}
      <mark className="tree-highlight">{match}</mark>
      {after}
    </>
  );
}

function renderHighlightedPath(value: string, search: string): JSX.Element | string {
  return highlightText(value, search);
}
