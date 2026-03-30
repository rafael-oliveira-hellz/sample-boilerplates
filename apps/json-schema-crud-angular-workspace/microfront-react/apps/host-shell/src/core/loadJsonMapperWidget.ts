import type { ComponentType } from 'react';
import type { JsonMapperWidgetProps } from '@porto/shared-contracts';

export async function loadJsonMapperWidget(): Promise<ComponentType<JsonMapperWidgetProps>> {
  const remote = await import('json_mapper_remote/json-mapper-widget');
  const candidate =
    remote.JsonMapperSummaryWidget ??
    remote.default?.JsonMapperSummaryWidget ??
    remote.default;

  if (typeof candidate !== 'function') {
    throw new Error('O widget público do json mapper não expôs um componente React válido.');
  }

  return candidate as ComponentType<JsonMapperWidgetProps>;
}
