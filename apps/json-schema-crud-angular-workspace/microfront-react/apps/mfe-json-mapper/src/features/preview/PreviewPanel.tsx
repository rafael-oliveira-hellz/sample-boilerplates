import { useMemo, useState } from 'react';
import type { MappingRule, SchemaNodeDraft } from '../../core/models/mapperModels';
import { buildPersistenceDocument, collectValidationErrors, countJsonLines, stringifyJson, type PersistenceMetadata } from './schemaPreview';

interface PreviewPanelProps {
  sourceTree: SchemaNodeDraft[];
  targetTree: SchemaNodeDraft[];
  metadata: PersistenceMetadata;
  rules: MappingRule[];
}

export function PreviewPanel({ sourceTree, targetTree, metadata, rules }: PreviewPanelProps): JSX.Element {
  const [activeTab, setActiveTab] = useState<'schema' | 'errors'>('schema');

  const persistedDocument = useMemo(() => buildPersistenceDocument(sourceTree, targetTree, metadata, rules), [metadata, rules, sourceTree, targetTree]);
  const persistedJson = useMemo(() => stringifyJson(persistedDocument), [persistedDocument]);
  const validationErrors = useMemo(() => collectValidationErrors(targetTree, rules), [rules, targetTree]);

  const exportFileName = `${sanitizeFileName(metadata.nomeParceiro)}_${sanitizeFileName(metadata.eventoParceiro)}_${sanitizeFileName(metadata.tipoSchema)}_${sanitizeFileName(metadata.versaoSchema)}_${activeTab}_${buildTimestamp()}.json`;

  function exportActiveTab(): void {
    const content = activeTab === 'schema' ? persistedJson : stringifyJson({ errors: validationErrors });
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = exportFileName;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function copyActiveTab(): Promise<void> {
    const content = activeTab === 'schema' ? persistedJson : stringifyJson({ errors: validationErrors });
    await navigator.clipboard.writeText(content);
  }

  return (
    <section className="rewrite-panel preview-panel-react" data-testid="react-preview-panel">
      <div className="panel-header">
        <div>
          <p className="panel-kicker">PREVIEW</p>
          <h3>Painel de conferência</h3>
          <p>Confira o documento salvo e os alertas do mapper antes de seguir com a publicação do fluxo.</p>
        </div>
        <div className="mode-switch">
          <button type="button" className={activeTab === 'schema' ? 'active' : ''} onClick={() => setActiveTab('schema')}>Schema</button>
          <button type="button" className={activeTab === 'errors' ? 'active' : ''} onClick={() => setActiveTab('errors')}>Erros</button>
        </div>
      </div>

      <div className="panel-stats">
        <div className="stat-chip"><strong>{countJsonLines(persistedJson)}</strong><span>linhas de schema</span></div>
        <div className="stat-chip"><strong>{validationErrors.length}</strong><span>alertas</span></div>
        <div className="stat-chip selected"><strong>{metadata.tipoSchema}</strong><span>{metadata.nomeParceiro}</span></div>
      </div>

      <div className="preview-actions">
        <button type="button" className="ghost" onClick={() => void copyActiveTab()}>Copiar JSON</button>
        <button type="button" className="ghost" onClick={exportActiveTab}>Exportar JSON</button>
      </div>

      {activeTab === 'schema' ? (
        <pre className="preview-code">{persistedJson}</pre>
      ) : validationErrors.length > 0 ? (
        <div className="errors-box">
          <ul>
            {validationErrors.map((error) => <li key={error}>{error}</li>)}
          </ul>
        </div>
      ) : (
        <div className="empty-state-card">
          <strong>Nenhum erro de validação</strong>
          <p>O schema visual já está consistente para seguir no fluxo React.</p>
        </div>
      )}
    </section>
  );
}

function sanitizeFileName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .toLowerCase();
}

function buildTimestamp(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const mi = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  return `${yyyy}${mm}${dd}-${hh}${mi}${ss}`;
}
