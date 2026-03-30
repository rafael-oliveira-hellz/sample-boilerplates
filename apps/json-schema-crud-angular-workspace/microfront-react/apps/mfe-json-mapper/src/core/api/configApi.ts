import type { PersistenceMetadata } from '../../features/preview/schemaPreview';

type PersistedMapperDocument = Record<string, unknown> & {
  nome_parceiro: string;
  tipo_schema: 'origem' | 'destino';
  versao_schema: string;
  evento_parceiro: string;
  schema_origem: Record<string, unknown>;
  schema_destino: Record<string, unknown>;
};

export interface SavedConfigResponse extends PersistedMapperDocument {
  id?: string;
  fileName?: string;
  savedAt?: string;
}

function buildConfigBaseUrl(apiBaseUrl: string): string {
  const normalized = apiBaseUrl.replace(/\/+$/, '');
  return normalized.endsWith('/configs') ? normalized : `${normalized}/configs`;
}

export async function saveConfig(apiBaseUrl: string, document: PersistedMapperDocument): Promise<SavedConfigResponse> {
  const response = await fetch(buildConfigBaseUrl(apiBaseUrl), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(document)
  });

  if (!response.ok) {
    throw new Error('Não foi possível salvar a configuração.');
  }

  return response.json() as Promise<SavedConfigResponse>;
}

export async function loadLatestConfig(apiBaseUrl: string, metadata: PersistenceMetadata): Promise<SavedConfigResponse> {
  const params = new URLSearchParams();
  if (metadata.nomeParceiro.trim()) params.set('nome_parceiro', metadata.nomeParceiro.trim());
  if (metadata.eventoParceiro.trim()) params.set('evento_parceiro', metadata.eventoParceiro.trim());
  if (metadata.tipoSchema.trim()) params.set('tipo_schema', metadata.tipoSchema.trim());
  if (metadata.versaoSchema.trim()) params.set('versao_schema', metadata.versaoSchema.trim());

  const response = await fetch(`${buildConfigBaseUrl(apiBaseUrl)}/latest?${params.toString()}`);
  if (!response.ok) {
    throw new Error('Não foi possível carregar a última configuração.');
  }

  return response.json() as Promise<SavedConfigResponse>;
}
