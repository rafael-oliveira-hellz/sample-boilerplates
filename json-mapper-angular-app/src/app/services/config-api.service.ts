import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import {
  EventTypeResponse,
  PersistedMapperDocument,
  PersistenceMetadataDraft,
  SavedConfigResponse,
  SpringPageResponse
} from '@models/mapper.models';
import { Observable, map } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ConfigApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = 'http://localhost:8080/api/configs';
  private readonly eventTypesUrl = 'http://localhost:8080/api/eventos';

  saveConfig(config: PersistedMapperDocument): Observable<SavedConfigResponse> {
    return this.http.post<SavedConfigResponse>(this.baseUrl, config);
  }

  loadEventTypes(page = 1, size = 100, search = ''): Observable<SpringPageResponse<EventTypeResponse>> {
    const params: Record<string, string> = {
      page: String(page),
      size: String(size)
    };
    if (search.trim()) {
      params['name'] = search.trim();
    }

    return this.http
      .get<SpringPageResponse<EventTypeResponse> | EventTypeResponse[]>(this.eventTypesUrl, {
        params
      })
      .pipe(
        map((response) => {
          if (Array.isArray(response)) {
            return {
              items: response,
              page,
              size,
              totalItems: response.length,
              totalPages: 1,
              hasNext: false,
              hasPrevious: false
            } satisfies SpringPageResponse<EventTypeResponse>;
          }

          const items = Array.isArray(response?.items)
            ? response.items
            : Array.isArray(response?.content)
              ? response.content
              : [];
          return {
            ...response,
            items: items.filter(
              (item): item is EventTypeResponse =>
                typeof item?.id == 'string' &&
                typeof item?.name == 'string'
            ),
            page: typeof response?.page == 'number' ? response.page : page,
            size: typeof response?.size == 'number' ? response.size : size,
            totalItems: typeof response?.totalItems == 'number'
              ? response.totalItems
              : typeof response?.totalElements == 'number'
                ? response.totalElements
                : items.length,
            totalPages: typeof response?.totalPages == 'number' ? response.totalPages : 1,
            hasNext: response?.hasNext === true,
            hasPrevious: response?.hasPrevious === true
          } satisfies SpringPageResponse<EventTypeResponse>;
        })
      );
  }

  loadLatestConfig(metadata?: Partial<PersistenceMetadataDraft>): Observable<SavedConfigResponse> {
    const params: Record<string, string> = {};

    if (typeof metadata?.codigoParceiro == 'number' && Number.isInteger(metadata.codigoParceiro)) {
      params['codigo_parceiro'] = String(metadata.codigoParceiro);
    }

    if (metadata?.eventoParceiro?.trim()) {
      params['id_evento'] = metadata.eventoParceiro.trim();
    }

    if (metadata?.dataInicioVigencia?.trim()) {
      params['data_inicio_vigencia'] = metadata.dataInicioVigencia.trim();
    }

    if (metadata?.tipoSchema?.trim()) {
      params['tipo_schema'] = metadata.tipoSchema.trim();
    }

    if (metadata?.versaoSchema?.trim()) {
      params['versao_schema'] = metadata.versaoSchema.trim();
    }

    return this.http.get<SavedConfigResponse>(`${this.baseUrl}/latest`, { params });
  }
}
