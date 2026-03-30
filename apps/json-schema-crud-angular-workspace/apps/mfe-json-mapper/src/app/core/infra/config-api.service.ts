import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom, Observable } from 'rxjs';
import { PersistedMapperDocument, PersistenceMetadataDraft, SavedConfigResponse } from '../models';

@Injectable({
  providedIn: 'root'
})
export class ConfigApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = 'http://localhost:8080/api/configs';

  saveConfig(config: PersistedMapperDocument): Observable<SavedConfigResponse> {
    return this.http.post<SavedConfigResponse>(this.baseUrl, config);
  }

  loadLatestConfig(metadata?: Partial<PersistenceMetadataDraft>): Observable<SavedConfigResponse> {
    const params: Record<string, string> = {};

    if (metadata?.nomeParceiro?.trim()) {
      params['nome_parceiro'] = metadata.nomeParceiro.trim();
    }

    if (metadata?.eventoParceiro?.trim()) {
      params['evento_parceiro'] = metadata.eventoParceiro.trim();
    }

    if (metadata?.tipoSchema?.trim()) {
      params['tipo_schema'] = metadata.tipoSchema.trim();
    }

    if (metadata?.versaoSchema?.trim()) {
      params['versao_schema'] = metadata.versaoSchema.trim();
    }

    return this.http.get<SavedConfigResponse>(`${this.baseUrl}/latest`, { params });
  }

  save(config: PersistedMapperDocument): Promise<SavedConfigResponse> {
    return firstValueFrom(this.saveConfig(config));
  }

  loadLatest(metadata?: Partial<PersistenceMetadataDraft>): Promise<SavedConfigResponse> {
    return firstValueFrom(this.loadLatestConfig(metadata));
  }
}
